# Выкладка на Netlify

Проект к выкладке готов: есть `netlify.toml`, формы принимают заявки,
лишнее исключено из репозитория. Осталось четыре шага — примерно 20 минут.

---

## Шаг 1. Завести репозиторий на GitHub

Netlify собирает сайт из репозитория, локальная папка ему недоступна.

1. Создайте пустой приватный репозиторий на [github.com/new](https://github.com/new).
   Название любое, например `estetique-beauty`. **Не** добавляйте README и .gitignore —
   они уже есть.
2. Подключите его и отправьте код:

```bash
cd /Users/shmakvlad/Documents/Home/Ai/beauty-site
git remote add origin https://github.com/ВАШ_ЛОГИН/estetique-beauty.git
git branch -M main
git push -u origin main
```

Если GitHub попросит пароль — нужен не пароль, а токен доступа:
Settings → Developer settings → Personal access tokens → Fine-grained tokens,
права `Contents: Read and write`.

---

## Шаг 2. Подключить Netlify

1. Откройте [app.netlify.com/start](https://app.netlify.com/start)
2. **Import from Git** → GitHub → выберите репозиторий
3. Настройки сборки Netlify подхватит из `netlify.toml`, менять ничего не нужно.
   Для проверки — там должно быть:

   | Поле | Значение |
   |---|---|
   | Build command | `npm run build:prod` |
   | Publish directory | `dist` |

4. **Deploy**

Первая сборка занимает около минуты. Сайт появится по адресу вида
`случайное-имя.netlify.app` — его можно переименовать в настройках,
Site configuration → Change site name.

**Дальше каждый `git push` пересобирает сайт автоматически.**

---

## Шаг 3. Настроить уведомления о заявках

Формы уже подключены к Netlify Forms — заявки собираются без всякого сервера.

1. В панели сайта: **Forms** — там появятся две формы,
   `zayavka-stranica` (блок «Быстрая запись») и `zayavka-popap` (всплывающее окно)
2. **Form notifications → Add notification → Email notification**
3. Укажите почту, куда присылать заявки

Заявка содержит имя, телефон, услугу и желаемое время. У заявок из поп-апа
в поле «услуга» подставляется название процедуры, с кнопки которой пришёл человек.

Бесплатный тариф — 100 заявок в месяц.

### Уведомления в Telegram

Почта работает сразу, но мастеру удобнее Telegram. Два пути:

- **Через Make или Zapier** — связать Netlify Forms с Telegram-ботом без кода
- **Через Netlify Function** — небольшой обработчик, который шлёт заявку боту.
  Скажите, если нужно, — напишу

---

## Шаг 4. Домен

1. Купить домен у любого регистратора
2. В Netlify: **Domain management → Add a domain**
3. Netlify покажет свои NS-серверы — прописать их у регистратора

Сертификат HTTPS выпускается автоматически, отдельно ничего делать не нужно.

---

## Что важно помнить

**Правки вносятся локально, а не на Netlify.** Меняете `data/*.json` или `src/`,
проверяете через `npm run build`, затем:

```bash
git add -A && git commit -m "что изменили" && git push
```

Через минуту изменения на сайте.

**Папка `dist` в репозиторий не попадает** — Netlify собирает её сам.
Так же исключены `originals/` и `images-deprecated/`.

**Локальная сборка и боевая различаются.** `npm run build` делает ссылки
на `index.html`, чтобы страницы открывались с диска. Netlify использует
`npm run build:prod` — там чистые адреса вида `/uslugi/chistka-lica/`.
