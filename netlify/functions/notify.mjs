/**
 * Приём заявки с сайта и отправка её в Telegram.
 *
 * Это серверная функция: код выполняется на хостинге, а не в браузере.
 * Благодаря этому токен бота не попадает на страницу и его нельзя украсть.
 *
 * Обращаться по адресу /api/notify методом POST.
 *
 * Нужны две переменные окружения (задаются в настройках хостинга,
 * в коде их нет и в репозиторий они не попадают):
 *   TELEGRAM_BOT_TOKEN — токен бота, выдаёт @BotFather
 *   TELEGRAM_CHAT_ID   — куда слать: ваш числовой id или id группы
 *
 * Написано на веб-стандартах (Request/Response), поэтому переносится
 * на Vercel, Cloudflare Workers и Deno Deploy почти без правок.
 */

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.error('Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 });
  }

  // Данные приходят как обычная форма; JSON тоже принимаем — на случай другого клиента
  let d = {};
  try {
    const ct = request.headers.get('content-type') || '';
    d = ct.includes('application/json')
      ? await request.json()
      : Object.fromEntries(new URLSearchParams(await request.text()));
  } catch {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  // Ловушка для спам-ботов: поле скрыто от людей, заполнить его может только робот.
  // Отвечаем успехом, чтобы отправитель не понял, что заявка отброшена.
  if (d['bot-field']) return Response.json({ ok: true });

  if (!String(d.telefon || '').trim()) {
    return Response.json({ ok: false, error: 'no_phone' }, { status: 400 });
  }

  const rows = [
    ['Телефон', d.telefon],
    ['Имя', d.imya],
    ['Услуга', d.usluga],
    ['Удобное время', d.vremya],
    ['Страница', d.istochnik],
  ].filter(([, v]) => String(v || '').trim());

  const when = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Minsk',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const text =
    '<b>🔔 Новая заявка с сайта</b>\n\n' +
    rows.map(([k, v]) => `${k}: <b>${esc(v)}</b>`).join('\n') +
    `\n\n<i>${when}</i>`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!r.ok) {
      console.error('Telegram ответил', r.status, await r.text());
      return Response.json({ ok: false, error: 'telegram_failed' }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error('Не удалось отправить в Telegram:', e);
    return Response.json({ ok: false, error: 'network' }, { status: 502 });
  }
};

export const config = { path: '/api/notify' };
