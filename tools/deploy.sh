#!/bin/bash
# Выгрузка сайта на хостинг.
#
#   npm run deploy              — собрать и залить
#   npm run deploy -- --dry-run — показать, что изменилось бы, ничего не трогая
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
  DEPLOY_PATH=/www/torapava.by

Пароль сюда НЕ вписывайте — он лежит в ~/.netrc.
Подробности — docs/vykladka-hoster-by.md
HELP
  exit 1
fi

# shellcheck disable=SC1090
. "./$CONF"

: "${DEPLOY_METHOD:?не задан DEPLOY_METHOD в .deploy.env (rsync или lftp)}"
: "${DEPLOY_HOST:?не задан DEPLOY_HOST в .deploy.env}"
: "${DEPLOY_PATH:?не задан DEPLOY_PATH в .deploy.env}"

DRY=no
if [ "${1:-}" = "--dry-run" ]; then
  DRY=yes
fi

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

echo "→ Заливаю dist → ${DEPLOY_HOST}:${DEPLOY_PATH}"
[ "$DRY" = yes ] && echo "  (пробный запуск, ничего не меняется)"

case "$DEPLOY_METHOD" in
rsync)
  : "${DEPLOY_USER:?не задан DEPLOY_USER в .deploy.env}"
  PORT="${DEPLOY_PORT:-22}"
  ARGS=(-rlvz --delete --exclude "$KEEP" --no-perms --no-owner --no-group)
  [ "$DRY" = yes ] && ARGS+=(--dry-run)
  rsync "${ARGS[@]}" -e "ssh -p $PORT" dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"
  ;;
curl)
  # Способ без установки чего-либо: curl уже есть в macOS.
  # Отличие от lftp — не удаляет с сервера файлы, которых больше нет в сборке.
  #
  # FTP у hoster.by рвёт передачу произвольно: файл приходит обрезанным, а
  # curl при этом рапортует об успехе. Поэтому после каждой загрузки размер
  # сверяется с локальным по http, и несовпавшие файлы грузятся заново.
  BASE="ftp://${DEPLOY_HOST}${DEPLOY_PATH%/}"
  SITE="${DEPLOY_SITE_URL:-http://${DEPLOY_HOST}}"

  # --ssl-reqd: соединение всегда шифруется, открытым текстом пароль не уйдёт.
  # Сертификат на FTP самоподписанный, обычным удостоверяющим центрам он
  # неизвестен — поэтому не отключаем проверку, а доверяем конкретному
  # сертификату сервера из .deploy-cert.pem.
  FTP_ARGS=(--netrc --ssl-reqd --ftp-create-dirs -sS --fail --connect-timeout 20)
  CACERT="${DEPLOY_CACERT:-.deploy-cert.pem}"
  [ -f "$CACERT" ] && FTP_ARGS+=(--cacert "$CACERT")

  FILES=()
  while IFS= read -r f; do
    rel="${f#dist/}"
    [ "$rel" = "$KEEP" ] && continue
    FILES+=("$rel")
  done < <(find dist -type f | sort)

  if [ "$DRY" = yes ]; then
    printf '  %s\n' "${FILES[@]}"
    echo "  — всего файлов: ${#FILES[@]}"
  else
    echo "  файлов: ${#FILES[@]}"

    TODO=("${FILES[@]}")
    for pass in 1 2 3 4 5 6 7 8; do
      [ ${#TODO[@]} -eq 0 ] && break
      [ "$pass" -gt 1 ] && echo "  повтор $pass: осталось ${#TODO[@]}"

      for rel in "${TODO[@]}"; do
        curl "${FTP_ARGS[@]}" -T "dist/$rel" "$BASE/$rel" || true
      done

      # Сверка: размер файла глазами обычного посетителя сайта.
      # .php и .htaccess сервер наружу не отдаёт — их так не проверить.
      FAILED=()
      for rel in "${TODO[@]}"; do
        case "$rel" in
        *.php | *.htaccess) continue ;;
        esac
        want=$(wc -c <"dist/$rel" | tr -d ' ')
        got=$(curl -sS -o /dev/null -w '%{size_download}' --max-time 30 "$SITE/$rel" 2>/dev/null)
        [ "$got" != "$want" ] && FAILED+=("$rel")
      done
      TODO=("${FAILED[@]}")
    done

    if [ ${#TODO[@]} -gt 0 ]; then
      echo "Не удалось залить целиком после восьми попыток:" >&2
      printf '  %s\n' "${TODO[@]}" >&2
      exit 1
    fi
    echo "  все файлы сверены по размеру — совпадают"
  fi
  ;;
lftp)
  if ! command -v lftp >/dev/null 2>&1; then
    echo "Не установлен lftp. Поставьте его: brew install lftp" >&2
    echo "Либо укажите DEPLOY_METHOD=curl — он есть в системе изначально" >&2
    exit 1
  fi
  MIRROR="mirror -R --delete --parallel=4 --exclude-glob $KEEP"
  [ "$DRY" = yes ] && MIRROR="$MIRROR --dry-run"
  lftp -c "set ftp:ssl-allow true; set net:max-retries 2; open $DEPLOY_HOST; $MIRROR dist $DEPLOY_PATH"
  ;;
*)
  echo "Неизвестный DEPLOY_METHOD=$DEPLOY_METHOD — ожидается curl, lftp или rsync" >&2
  exit 1
  ;;
esac

if [ "$DRY" = yes ]; then
  echo "✓ Пробный запуск закончен, на сервере ничего не изменилось"
else
  echo "✓ Готово. Проверьте https://torapava.by и отправьте тестовую заявку"
fi
