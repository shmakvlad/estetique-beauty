#!/bin/bash
# Выгрузка сайта на хостинг.
#
#   npm run deploy              — собрать и залить
#   npm run deploy -- --dry-run — показать, что уехало бы, ничего не трогая
#
# Настройки берутся из файла .deploy.env в корне проекта. Он в .gitignore,
# в репозиторий не попадает. Пароля в нём нет: для SSH используется ключ,
# для FTP — ваш ~/.netrc. Как всё это завести — docs/vykladka-hoster-by.md

set -euo pipefail

cd "$(dirname "$0")/.."

CONF=.deploy.env
if [ ! -f "$CONF" ]; then
  cat <<'HELP'
Нет файла .deploy.env — без него непонятно, куда заливать.

Создайте его в корне проекта:

  DEPLOY_METHOD=lftp
  DEPLOY_HOST=vh171.hoster.by
  DEPLOY_PATH=/
  DEPLOY_SITE_URL=https://torapava.by

Пароль сюда НЕ вписывайте — он лежит в ~/.netrc.
Подробности — docs/vykladka-hoster-by.md
HELP
  exit 1
fi

# shellcheck disable=SC1090
. "./$CONF"

: "${DEPLOY_METHOD:?не задан DEPLOY_METHOD в .deploy.env (lftp, curl или rsync)}"
: "${DEPLOY_HOST:?не задан DEPLOY_HOST в .deploy.env}"
: "${DEPLOY_PATH:?не задан DEPLOY_PATH в .deploy.env}"

DRY=no
[ "${1:-}" = "--dry-run" ] && DRY=yes

echo "→ Собираю боевую версию"
npm run build:prod

if [ ! -f dist/index.html ]; then
  echo "Сборка не создала dist/index.html — выгрузка отменена" >&2
  exit 1
fi

# Файл с токеном бота лежит на сервере и в сборке его нет.
# Без этого исключения синхронизация удалила бы его при первой же выгрузке.
KEEP='api/config.php'

# Пробел или кириллица в имени файла ломают адрес на сервере, и выгрузка
# обрывается на середине. Ловим это здесь, пока ничего не отправлено.
BAD=$(find dist -type f | grep -E ' |[^ -~]' || true)
if [ -n "$BAD" ]; then
  echo "Выгрузка отменена: в именах файлов пробелы или нелатинские символы." >&2
  echo "$BAD" >&2
  echo "Переименуйте их в src/images и поправьте ссылки в data/*.json" >&2
  exit 1
fi

FILES=()
while IFS= read -r f; do
  rel="${f#dist/}"
  [ "$rel" = "$KEEP" ] && continue
  FILES+=("$rel")
done < <(find dist -type f | sort)

# Сертификат FTP-сервера самоподписанный, обычным удостоверяющим центрам он
# неизвестен. Поэтому не отключаем проверку, а доверяем конкретному
# сертификату сервера — он лежит в .deploy-cert.pem
CACERT="${DEPLOY_CACERT:-.deploy-cert.pem}"
SITE="${DEPLOY_SITE_URL:-https://${DEPLOY_HOST}}"
BASE="ftp://${DEPLOY_HOST}${DEPLOY_PATH%/}"

CURL_FTP=(--netrc --ssl-reqd --ftp-create-dirs -sS --fail --connect-timeout 20)
[ -f "$CACERT" ] && CURL_FTP+=(--cacert "$CACERT")

echo "→ Заливаю dist → ${DEPLOY_HOST}:${DEPLOY_PATH} (${#FILES[@]} файлов, способ $DEPLOY_METHOD)"
if [ "$DRY" = yes ]; then
  printf '  %s\n' "${FILES[@]}"
  echo "✓ Пробный запуск закончен, на сервере ничего не изменилось"
  exit 0
fi

case "$DEPLOY_METHOD" in
rsync)
  : "${DEPLOY_USER:?не задан DEPLOY_USER в .deploy.env}"
  rsync -rlvz --delete --exclude "$KEEP" --no-perms --no-owner --no-group \
    -e "ssh -p ${DEPLOY_PORT:-22}" dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"
  ;;
lftp)
  if ! command -v lftp >/dev/null 2>&1; then
    echo "Не установлен lftp. Поставьте его: brew install lftp" >&2
    echo "Либо укажите DEPLOY_METHOD=curl — он есть в системе изначально" >&2
    exit 1
  fi
  # mirror -R заливает и удаляет с сервера то, чего больше нет в сборке.
  # Файл с токеном исключён, поэтому удаление его не касается.
  # dns:order inet — только IPv4: у сервера есть адрес IPv6, но маршрута
  # до него с этой машины нет, и lftp упирается в Network is unreachable
  lftp -c "
    set dns:order inet
    set ssl:ca-file $CACERT
    set ftp:ssl-force true
    set ftp:ssl-protect-data true
    set net:max-retries 3
    set net:timeout 20
    set mirror:parallel-transfer-count 2
    open $DEPLOY_HOST
    mirror -R --delete --exclude-glob $KEEP dist $DEPLOY_PATH
  "
  ;;
curl)
  # Без установки чего-либо: curl есть в macOS изначально.
  # В отличие от lftp не удаляет с сервера лишнее.
  for rel in "${FILES[@]}"; do
    curl "${CURL_FTP[@]}" -T "dist/$rel" "$BASE/$rel" || true
  done
  ;;
*)
  echo "Неизвестный DEPLOY_METHOD=$DEPLOY_METHOD — ожидается lftp, curl или rsync" >&2
  exit 1
  ;;
esac

# ── Сверка целостности ───────────────────────────────────────────────────
# FTP у hoster.by произвольно рвёт передачу: файл приходит обрезанным, а
# программа выгрузки при этом рапортует об успехе. Поэтому размер каждого
# файла сверяется с локальным по адресу сайта, а несовпавшие льются заново.
# .php и .htaccess сервер наружу не отдаёт — их так не проверить.
echo "→ Сверяю размеры через $SITE"

TODO=()
for rel in "${FILES[@]}"; do
  case "$rel" in *.php | *.htaccess) continue ;; esac
  TODO+=("$rel")
done

# Пустой массив в bash 3.2 из macOS при set -u разворачивать нельзя —
# отсюда проверки длины перед каждым перебором
for pass in 1 2 3 4 5 6 7 8; do
  [ ${#TODO[@]} -eq 0 ] && break

  FAILED=()
  for rel in "${TODO[@]}"; do
    want=$(wc -c <"dist/$rel" | tr -d ' ')
    got=$(curl -sS -o /dev/null -w '%{size_download}' --max-time 30 "$SITE/$rel" 2>/dev/null || echo 0)
    [ "$got" != "$want" ] && FAILED+=("$rel")
  done

  if [ ${#FAILED[@]} -eq 0 ]; then
    TODO=()
    break
  fi

  TODO=("${FAILED[@]}")
  echo "  недогружено: ${#TODO[@]}, перезаливаю (попытка $pass)"
  for rel in "${TODO[@]}"; do
    curl "${CURL_FTP[@]}" -T "dist/$rel" "$BASE/$rel" || true
  done
done

if [ ${#TODO[@]} -gt 0 ]; then
  echo "Не удалось залить целиком после восьми попыток:" >&2
  printf '  %s\n' "${TODO[@]}" >&2
  exit 1
fi

echo "✓ Готово: все файлы сверены по размеру, совпадают"
echo "  Проверьте $SITE и отправьте тестовую заявку"
