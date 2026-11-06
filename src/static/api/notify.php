<?php
/**
 * Приём заявки с сайта и отправка её в Telegram.
 *
 * Серверный обработчик для обычного PHP-хостинга (hoster.by и любой другой).
 * Код выполняется на сервере, поэтому токен бота не попадает в браузер.
 *
 * Обращаться по адресу /api/notify.php методом POST.
 *
 * ТОКЕН В ЭТОТ ФАЙЛ НЕ ВПИСЫВАТЬ — он лежит в репозитории и перезаписывается
 * при каждой выгрузке. Токен берётся из одного из трёх мест, в таком порядке:
 *
 *   1. Переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID
 *   2. Файл notify-config.php на уровень выше корня сайта  ← так надёжнее всего
 *   3. Файл config.php рядом с этим скриптом
 *
 * Как создать файл с токеном — в docs/vykladka-hoster-by.md
 */

header('Content-Type: application/json; charset=utf-8');

/** Отдать ответ и закончить */
function reply(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    reply(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

// ── Где лежит токен ──────────────────────────────────────────────────────
$token = getenv('TELEGRAM_BOT_TOKEN') ?: '';
$chat = getenv('TELEGRAM_CHAT_ID') ?: '';

if ($token === '' || $chat === '') {
    $root = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $places = [];
    if ($root !== '') {
        $places[] = dirname($root) . '/notify-config.php';
    }
    $places[] = __DIR__ . '/config.php';

    foreach ($places as $file) {
        if (!is_readable($file)) {
            continue;
        }
        $cfg = include $file;
        if (is_array($cfg)) {
            $token = $token !== '' ? $token : ($cfg['token'] ?? '');
            $chat = $chat !== '' ? $chat : ($cfg['chat'] ?? '');
        }
        if ($token !== '' && $chat !== '') {
            break;
        }
    }
}

if ($token === '' || $chat === '') {
    error_log('notify.php: не найдены токен бота и id чата');
    reply(500, ['ok' => false, 'error' => 'not_configured']);
}

// ── Данные формы ─────────────────────────────────────────────────────────
$d = $_POST;

// На случай, если заявку пришлёт другой клиент — JSON тоже принимаем.
// strpos вместо str_contains: тот появился только в PHP 8, а на хостинге
// может стоять 7.4 — и файл не запустится вовсе
if (!$d && strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $parsed = json_decode($raw ?: '', true);
    if (is_array($parsed)) {
        $d = $parsed;
    }
}

$field = static fn(string $k): string => trim((string) ($d[$k] ?? ''));

// Ловушка для спам-ботов: поле скрыто от людей, заполнить его может только робот.
// Отвечаем успехом, чтобы отправитель не понял, что заявка отброшена.
if ($field('bot-field') !== '') {
    reply(200, ['ok' => true]);
}

if ($field('telefon') === '') {
    reply(400, ['ok' => false, 'error' => 'no_phone']);
}

// ── Текст сообщения ──────────────────────────────────────────────────────
$rows = [];
foreach (
    [
        'Телефон' => 'telefon',
        'Имя' => 'imya',
        'Услуга' => 'usluga',
        'Удобное время' => 'vremya',
        'Страница' => 'istochnik',
    ] as $label => $key
) {
    $value = $field($key);
    if ($value !== '') {
        $rows[] = $label . ': <b>' . htmlspecialchars($value, ENT_NOQUOTES, 'UTF-8') . '</b>';
    }
}

$when = (new DateTime('now', new DateTimeZone('Europe/Minsk')))->format('d.m, H:i');
$text = "<b>🔔 Новая заявка с сайта</b>\n\n" . implode("\n", $rows) . "\n\n<i>" . $when . '</i>';

// ── Отправка ─────────────────────────────────────────────────────────────
$payload = json_encode([
    'chat_id' => $chat,
    'text' => $text,
    'parse_mode' => 'HTML',
    'disable_web_page_preview' => true,
], JSON_UNESCAPED_UNICODE);

$ch = curl_init('https://api.telegram.org/bot' . $token . '/sendMessage');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    error_log('notify.php: не удалось связаться с Telegram: ' . $curlError);
    reply(502, ['ok' => false, 'error' => 'network']);
}

if ($status < 200 || $status >= 300) {
    // В лог пишем ответ Telegram, но не токен — он есть в адресе запроса
    error_log('notify.php: Telegram ответил ' . $status . ' ' . substr((string) $response, 0, 300));
    reply(502, ['ok' => false, 'error' => 'telegram_failed']);
}

reply(200, ['ok' => true]);
