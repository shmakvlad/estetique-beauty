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
lftp)
  if ! command -v lftp >/dev/null 2>&1; then
    echo "Не установлен lftp. Поставьте его: brew install lftp" >&2
    exit 1
  fi
  MIRROR="mirror -R --delete --parallel=4 --exclude-glob $KEEP"
  [ "$DRY" = yes ] && MIRROR="$MIRROR --dry-run"
  lftp -c "set ftp:ssl-allow true; set net:max-retries 2; open $DEPLOY_HOST; $MIRROR dist $DEPLOY_PATH"
  ;;
*)
  echo "Неизвестный DEPLOY_METHOD=$DEPLOY_METHOD — ожидается rsync или lftp" >&2
  exit 1
  ;;
esac

if [ "$DRY" = yes ]; then
  echo "✓ Пробный запуск закончен, на сервере ничего не изменилось"
else
  echo "✓ Готово. Проверьте https://torapava.by и отправьте тестовую заявку"
fi
