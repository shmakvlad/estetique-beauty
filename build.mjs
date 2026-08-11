#!/usr/bin/env node
// Сборка сайта Estétique Beauty из data/*.json.
// Запуск: node build.mjs   (или npm run build)
// Результат: dist/

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const site = read('data/site.json');
const db = read('data/procedures.json');

// Локальная сборка: ссылки на index.html, чтобы страницы открывались с диска
// без веб-сервера. Для боевой выкладки — npm run build:prod (чистые адреса).
const LOCAL = process.argv.includes('--local');
const IDX = LOCAL ? 'index.html' : '';

const C = site.contacts;
const cats = [...db.categories].sort((a, b) => a.order - b.order);
const catsByCard = [...db.categories].sort((a, b) => a.cardOrder - b.cardOrder);
const cat = (id) => db.categories.find((c) => c.id === id);
const procsOf = (id) => db.procedures.filter((p) => p.category === id);
const signature = db.procedures.filter((p) => p.signature);
const pages = db.procedures.filter((p) => p.page);

// ——— помощники ———
const money = (p) => `${p.priceFrom ? 'от ' : ''}${p.price} BYN`;
const moneyShort = (p) => `${p.priceFrom ? 'от ' : ''}${p.price}`;
const minPrice = (id) => Math.min(...procsOf(id).map((p) => p.price));
// Ссылка на главную/её якорь. С корня — обычный якорь, со вложенной страницы —
// путь до index.html, иначе браузер при открытии с диска показывает список папки.
const hrefHome = (root, hash = '') => (root ? `${root}${IDX}${hash}` : hash || '#');
const link = (p, root) => (p.page ? `${root}uslugi/${p.slug}/${IDX}` : hrefHome(root, '#dir'));
const tel = `tel:${C.phoneHref}`;
const ph = (v) => (v ? ` ${v}` : '');
const list = (a, f) => a.map(f).join('\n');
// Экранирование для значений атрибутов: & в адресе иначе читается как начало спецсимвола
const attr = (v = '') => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Фото из src/images или градиентная заглушка, если файла ещё нет.
// В data достаточно указать имя файла: "photo": "mariya.webp"
const isFile = (v) => typeof v === 'string' && /\.(webp|jpg|jpeg|png|avif)$/i.test(v);
function pic(photo, { root = '', alt = '', cls = '', w, h, eager = false, pos = '' } = {}) {
  if (isFile(photo)) {
    const size = w && h ? ` width="${w}" height="${h}"` : '';
    const load = eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"';
    // pos — какая часть снимка остаётся видимой при обрезке: "center 25%", "top", "left center"
    const style = pos ? ` style="object-position:${pos}"` : '';
    return `<img class="ph-img${cls ? ' ' + cls : ''}" src="${root}images/${photo}" alt="${alt}"${size}${load}${style}>`;
  }
  return `<div class="ph${ph(photo)}"></div>`;
}

// Аватар: фото, если указан файл, иначе первая буква имени на градиенте —
// брать чужие фото из профилей без разрешения нельзя, инициал выглядит осознанно.
const avatar = (src, name, root = '') =>
  isFile(src)
    ? `<span class="ava has-img">${pic(src, { root, alt: name, w: 120, h: 120 })}</span>`
    : `<span class="ava${ph(src)}"><i>${(name || '').trim().charAt(0)}</i></span>`;

// ——— иконки ———
const sprite = `<svg style="display:none">
  <symbol id="i-phone" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></symbol>
  <symbol id="i-tg" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/></symbol>
  <symbol id="i-viber" viewBox="0 0 24 24"><path d="M12 2a9 9 0 0 0-9 9 8.8 8.8 0 0 0 2 5.6L4 22l5.6-1.9A9 9 0 1 0 12 2z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24"><path d="M21 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
  <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.4-2.9 8.3-7 9.5C7.9 19.3 5 15.4 5 11V6z"/><path d="m9 11.8 2 2 4-4"/></symbol>
  <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M4.5 20c0-8 5-13 15.5-13 0 8-5 13-13 13H4.5z"/><path d="M9 15.5c2-3.2 4.6-5.3 8-6.8"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><path d="M20 14.5a3 3 0 0 1-3 3H8.5L4.5 21V6a3 3 0 0 1 3-3H17a3 3 0 0 1 3 3z"/></symbol>
  <symbol id="i-wa" viewBox="0 0 24 24"><path d="M12 2.7a9.3 9.3 0 0 0-8 14.1L2.8 21.2l4.5-1.2A9.3 9.3 0 1 0 12 2.7z"/><path d="M8.7 8.2c.3-.1.6 0 .8.3l.8 1.4c.1.3.1.6-.1.8l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.2-.2.5-.3.8-.1l1.4.8c.3.2.4.5.3.8-.3.9-1.2 1.4-2.1 1.2a8.6 8.6 0 0 1-6.1-6.1c-.2-.9.3-1.8 1.2-2.1z"/></symbol>
  <symbol id="i-ig" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1"/></symbol>
  <symbol id="i-ar" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
</svg>`;

const icon = (n) => `<svg><use href="#i-${n}"/></svg>`;
const msgButtons = (
  extra = ''
) => `<a class="cbtn tg" href="${C.telegram}" target="_blank" rel="noopener">${icon('tg')}Telegram</a>
        <a class="cbtn vb" href="${C.viber}">${icon('viber')}Viber</a>${extra}`;

// ——— общие части ———
const header = (root) => `<header class="hdr" id="hdr">
  <div class="hdr-in">
    <a href="${hrefHome(root)}" class="logo"><b>${site.brand.name}</b><span>${site.brand.suffix}</span></a>

    <ul class="nav" id="nav">
      <li id="navSvc"><button aria-expanded="false">Услуги <span class="caret">▼</span></button></li>
      ${list(site.nav, (n) => `<li><a href="${hrefHome(root, n.href)}">${n.label}</a></li>`)}
    </ul>

    <div class="hdr-contact">
      <a class="hdr-tel" href="${tel}"><span class="ico">${icon('phone')}</span>${C.phone}</a>
      <button class="btn" data-book>Записаться</button>
      <button class="burger" id="burger" aria-label="Меню"><i></i><i></i><i></i></button>
    </div>
  </div>

  <div class="mega" id="mega">
    <div class="mega-in">
${list(
  cats,
  (c) => `      <div>
        <span class="cap">${c.capMega}</span><h5>${c.titleMega}</h5>
${list(
  procsOf(c.id).filter((p) => p.inMega),
  (p) =>
    `        <a class="item" href="${link(p, root)}">${p.titleMega || p.title} <em>${moneyShort(p)}</em></a>`
)}
      </div>`
)}
      <div class="mega-feat">
        <div class="ph${isFile(site.megaFeature.photo) ? '' : ' d'}">${
          isFile(site.megaFeature.photo)
            ? pic(site.megaFeature.photo, {
                root,
                alt: site.megaFeature.caption,
                w: 700,
                h: 320,
                pos: site.megaFeature.photoPos,
              })
            : ''
        }<div class="ph-grad"></div><span class="cap-abs">${site.megaFeature.caption}</span></div>
        <div class="bd">
          <p>${site.megaFeature.text}</p>
          <button class="btn" data-book data-svc="${site.megaFeature.service}">${site.megaFeature.cta}</button>
        </div>
      </div>
    </div>
  </div>
</header>`;

const mmenu = (root) => `<nav class="mmenu" id="mmenu">
  <div class="grp" id="mgrp">
    <button>Услуги <i>+</i></button>
    <div class="sub"><div>
      ${list(cats, (c) => `<a href="${hrefHome(root, '#dir')}">${c.title}</a>`)}
      <a href="${hrefHome(root, '#signature')}">Авторские протоколы</a>
    </div></div>
  </div>
  ${list(site.nav, (n) => `<a href="${hrefHome(root, n.href)}">${n.label}</a>`)}
  <a href="${hrefHome(root, '#gift')}">Сертификат</a>
  <div class="mmenu-foot">
    <button class="btn" data-book>Записаться</button>
    <a class="btn btn-w" href="${tel}">${C.phone}</a>
    <div class="mm-msgs">
      <a class="tg" href="${C.telegram}" target="_blank" rel="noopener" aria-label="Telegram">${icon('tg')}</a>
      <a class="vb" href="${C.viber}" aria-label="Viber">${icon('viber')}</a>
      <a href="${tel}" aria-label="Позвонить">${icon('phone')}</a>
    </div>
    <p style="font-size:13.5px;color:var(--muted);margin:6px 0 0">${C.address}<br>${C.hoursShort}</p>
  </div>
</nav>`;

const footer = (root) => `<footer class="ftr">
  <div class="wrap ftr-in">
    <div>
      <a href="${hrefHome(root)}" class="logo" style="margin-bottom:14px"><b>${site.brand.name}</b><span>${site.brand.suffix}</span></a>
      <p style="font-size:14.5px; color:var(--muted); line-height:1.6; margin:0">
        Косметический кабинет в ${C.city}е.<br>Уход за лицом и телом, обучение массажу.</p>
    </div>
    <div>
      <h5>Услуги</h5>
      ${list(cats, (c) => `<a class="lnk" href="${hrefHome(root, '#dir')}">${c.title}</a>`)}
      <a class="lnk" href="${hrefHome(root, '#signature')}">Авторские протоколы</a>
    </div>
    <div>
      <h5>Кабинет</h5>
      <a class="lnk" href="${hrefHome(root, '#about')}">О мастере</a><a class="lnk" href="${hrefHome(root, '#results')}">Результаты</a>
      <a class="lnk" href="${hrefHome(root, '#reviews')}">Отзывы</a><a class="lnk" href="${hrefHome(root, '#edu')}">Обучение</a>
      <a class="lnk" href="${hrefHome(root, '#gift')}">Сертификат</a>
    </div>
    <div>
      <h5>Контакты</h5>
      <a class="lnk" href="${tel}">${C.phone}</a>
      <a class="lnk" href="${hrefHome(root, '#contacts')}">${C.address}</a>
      <a class="lnk" href="${hrefHome(root, '#contacts')}">${C.hoursShort}</a>
      <a class="lnk" href="${C.telegram}" target="_blank" rel="noopener">Telegram</a>
      <a class="lnk" href="${C.viber}">Viber</a>
      <a class="lnk" href="${attr(C.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="lnk" href="${attr(C.instagram)}" target="_blank" rel="noopener">Instagram</a>
    </div>
  </div>
  <div class="wrap"><div class="legal">
    ${site.brand.legal}<br>
    ${site.brand.disclaimer} © ${site.brand.year} ${site.brand.name} ${site.brand.suffix.toLowerCase().replace(/^./, (m) => m.toUpperCase())}
  </div></div>
</footer>`;

const sticky = () => `<div class="sticky" id="sticky">
  <button class="btn" data-book>Записаться</button>
  <a class="ico" href="${tel}" aria-label="Позвонить">${icon('phone')}</a>
</div>`;

const modal = () => `<div class="ov" id="ov">
  <div class="modal" role="dialog" aria-modal="true" aria-label="Запись">
    <div class="modal-hd">
      <div><h3>Запись</h3><div class="svc" id="mSvc">Выберите услугу</div></div>
      <button class="modal-x" id="mX" aria-label="Закрыть">✕</button>
    </div>
    <form id="mForm" data-endpoint="${site.forms.endpoint}" novalidate>
      <input type="hidden" name="usluga" id="mSvcField" value="">
      <p class="hp"><label>Не заполняйте: <input name="bot-field"></label></p>
      <div class="fld-row">
        <div class="fld"><label for="m-name">Ваше имя</label>
          <input id="m-name" name="imya" placeholder="Как к вам обращаться"></div>
        <div class="fld"><label for="m-tel">Телефон или мессенджер</label>
          <input id="m-tel" name="telefon" type="tel" required placeholder="+375 __ ___-__-__"></div>
      </div>
      <div class="fld"><label for="m-when">Желаемое время</label>
        <input id="m-when" name="vremya" placeholder="Например: будни после 18:00"></div>
      <button class="btn" type="submit" style="width:100%">${site.booking.cta}</button>
      <p class="consent">${site.booking.consent}</p>
      <div style="text-align:center; font-size:13px; color:var(--muted); margin:18px 0 10px">или сразу в мессенджер</div>
      <div class="msg-grid">
        ${msgButtons()}
      </div>
    </form>
    <div class="ok" id="mOk">
      <div class="circle">✓</div>
      <h3 style="font-size:21px; margin-bottom:9px">${site.booking.successTitle}</h3>
      <p style="color:var(--muted); font-size:14.5px; margin:0">Свяжусь с вами в течение рабочего дня.</p>
    </div>
  </div>
</div>`;

const lightbox =
  () => `<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Просмотр изображения">
  <button class="lb-btn lb-x" id="lbX" aria-label="Закрыть">✕</button>
  <button class="lb-btn lb-prev" id="lbPrev" aria-label="Предыдущее">‹</button>
  <figure class="lb-fig"><img id="lbImg" src="" alt=""></figure>
  <button class="lb-btn lb-next" id="lbNext" aria-label="Следующее">›</button>
  <div class="lb-count" id="lbCount"></div>
</div>`;

const layout = ({ title, description, root, body, canonical }) => `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${canonical ? `<link rel="canonical" href="${canonical}">\n` : ''}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Inter:wght@400;500;600&display=swap&subset=cyrillic" rel="stylesheet">
<link rel="stylesheet" href="${root}assets/site.css">
</head>
<body>

${sprite}

${header(root)}

${mmenu(root)}

${body}
${footer(root)}

${sticky()}

${modal()}

${lightbox()}

<script src="${root}assets/site.js"></script>
</body>
</html>
`;

// ——— контактные полосы ———
const stripValue = (type) =>
  type === 'phone'
    ? `<a href="${tel}">${C.phone}</a>`
    : type === 'address'
      ? `<span class="v">${C.address}</span>`
      : `<span class="v">${C.hoursShort}</span>`;

const strip = (s) => `<section class="strip">
  <div class="wrap strip-in">
    <div class="strip-i"><span class="ic">${icon(s.icon)}</span>
      <div><span class="lb">${s.label}</span>${stripValue(s.type)}</div></div>
    <div class="strip-i"><span class="ic">${icon(s.icon2)}</span>
      <div><span class="lb">${s.label2}</span>${stripValue(s.type2)}</div></div>
    ${
      s.ctaType === 'book'
        ? `<button class="btn" data-book>${s.cta}</button>`
        : `<a class="btn" href="${C.telegram}" target="_blank" rel="noopener">${s.cta}</a>`
    }
  </div>
</section>`;

// ——— блок «до/после» ———
// pairs: [{ label, before, after }] — если файлов нет, остаётся градиентная заглушка
const realPairs = (pairs) => (pairs || []).filter((p) => isFile(p.before) && isFile(p.after));

const beforeAfter = (pairs = [], root = '', ratio = '') => {
  const ok = realPairs(pairs);
  const first = ok[0];
  // пропорция окна шторки: вертикальные портреты в горизонтальном кадре сильно обрезаются
  const ar = ratio ? ` style="aspect-ratio:${ratio}"` : '';
  return `<div class="ba rv" id="ba"${ar}>
      <div class="after" id="baAfter">${first ? `<img src="${root}images/${first.after}" alt="После процедуры" loading="lazy" decoding="async">` : ''}</div>
      <div class="before" id="baBefore">${first ? `<img src="${root}images/${first.before}" alt="До процедуры" loading="lazy" decoding="async">` : ''}</div>
      <div class="hd" id="baHandle"><span class="kn">↔</span></div>
      <span class="tg" style="left:12px">ДО</span>
      <span class="tg" style="right:12px">ПОСЛЕ</span>
    </div>`;
};

// подписи-переключатели: если пар с фото несколько, ими листают
const baTabs = (pairs, fallback, root = '') => {
  const ok = realPairs(pairs);
  if (ok.length < 2) {
    const labels = ok.length === 1 ? [ok[0].label] : fallback || [];
    return labels.map((t) => `<span class="chip">${t}</span>`).join('');
  }
  return ok
    .map(
      (p, i) =>
        `<button class="chip ba-tab${i ? '' : ' on'}" data-before="${root}images/${p.before}" data-after="${root}images/${p.after}">${p.label}</button>`
    )
    .join('');
};

// ═══════════════════ ГЛАВНАЯ ═══════════════════
const H = site.hero;

const indexBody = `<!-- ============ HERO ============ -->
<section class="hero">
  <div class="wrap hero-in">
    <div>
      <span class="badge">${icon('spark')}${H.badge}</span>
      <h1>${H.h1}</h1>
      <p class="lead">${H.lead}</p>
      <div class="hero-actions">
        <button class="btn" data-book>${H.cta} <svg class="ar" width="17" height="17" style="stroke:#fff;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><use href="#i-ar"/></svg></button>
        <a class="cbtn tg" href="${C.telegram}" target="_blank" rel="noopener">${icon('tg')}Telegram</a>
        <a class="cbtn vb" href="${C.viber}">${icon('viber')}Viber</a>

        <div class="hero-rev-row">
          <a class="bb bb-sm bb-103" href="${attr(site.reviews.platforms[0].url)}" target="_blank" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="11.5" fill="#fff"/><circle cx="12" cy="12" r="9.6" fill="#D8443D"/>
              <path d="M10.35 6.4h3.3v3.95h3.95v3.3H13.65V17.6h-3.3v-3.95H6.4v-3.3h3.95z" fill="#fff"/>
            </svg>${site.reviews.platforms[0].label}</a>
          <a class="bb bb-sm bb-relax" href="${attr(site.reviews.platforms[1].url)}" target="_blank" rel="noopener">${site.reviews.platforms[1].label}<i>${site.reviews.platforms[1].suffix}</i></a>
        </div>
        <a class="cbtn wa" href="${attr(C.whatsapp)}" target="_blank" rel="noopener">${icon('wa')}WhatsApp</a>
        <a class="cbtn ig" href="${attr(C.instagram)}" target="_blank" rel="noopener">${icon('ig')}Instagram</a>
      </div>

      <ul class="facts">
        ${list(H.facts, (f) => `<li>${f}</li>`)}
      </ul>
    </div>
    <div class="hero-media">
      <div class="hero-ph">
        <div class="frame ph">${pic(H.photo, { alt: H.photoAlt || H.h1, w: 940, h: 1175, eager: true })}</div>
        <div class="hero-stats" id="heroStats">
${list(H.stats, (s) => `          <div><b data-to="${s.to}"${s.suffix ? ` data-suf="${s.suffix}"` : ''}${s.decimals ? ` data-dec="${s.decimals}"` : ''}>0</b><span>${s.label}</span></div>`)}
        </div>
        <div class="hero-promo">
          <a href="${H.promo.linkHref}">${H.promo.linkText}</a>
          ${H.promo.text}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ УСЛУГИ И ЦЕНЫ ============ -->
<section class="sec" id="services">
  <div class="wrap">
    <p class="eyebrow rv">${site.services.eyebrow}</p>
    <h2 class="sec-h rv">${site.services.title}</h2>
    <p class="sec-sub rv">${site.services.lead}</p>

    <div class="cat-grid">
${list(
  catsByCard,
  (c) => `      <div class="cat rv">
        <div class="im">${pic(c.photo, { alt: c.title, w: 1200, h: 800, pos: c.photoPos })}</div>
        <div class="bd">
          <h3>${c.title}</h3><div class="rule"></div>
          <ul>
${list(procsOf(c.id), (p) => `            <li><a href="${link(p, '')}">${p.title}</a></li>`)}
          </ul>
          <div class="ft"><span class="pr">от <b>${minPrice(c.id)} BYN</b></span>
            <a class="arrow" href="#dir" aria-label="Все процедуры направления">${icon('ar')}</a></div>
        </div>
      </div>`
)}
    </div>
  </div>
</section>

${strip(site.strips[0])}

<!-- ============ АВТОРСКИЕ ПРОТОКОЛЫ ============ -->
<section class="sec" id="signature">
  <div class="wrap">
    <p class="eyebrow rv">${site.signature.eyebrow}</p>
    <h2 class="sec-h rv">${site.signature.title}</h2>
    <p class="sec-sub rv">${site.signature.lead}</p>

    <div class="sig-grid">
${list(
  signature,
  (p) => `      <a class="sig rv" href="${link(p, '')}">
        <div class="im">${pic(p.photo, { alt: p.title, w: 1200, h: 515 })}<span class="tagm">${site.signature.badge}</span></div>
        <div class="bd">
          <h3>${p.title}</h3>
          <p>${p.signatureText}</p>
          <div class="ft"><span class="pr">${money(p)} · ${p.duration} мин</span>
            <span class="arrow">${icon('ar')}</span></div>
        </div>
      </a>`
)}
    </div>
  </div>
</section>

<!-- ============ НАПРАВЛЕНИЯ ============ -->
<section class="sec" id="dir" style="background:var(--soft)">
  <div class="wrap">
    <p class="eyebrow rv">${site.directions.eyebrow}</p>
    <h2 class="sec-h rv" style="margin-bottom:30px">${site.directions.title}</h2>

${list(
  cats,
  (c) => `    <div class="dir rv">
      <div class="im">${pic(c.photoDir || c.photo, { cls: 'in', alt: c.title, w: 1200, h: 800, pos: c.photoDirPos || c.photoPos })}<div class="ph-grad"></div><span class="cap">${c.titleDir || c.title}</span></div>
      <div>
${list(
  procsOf(c.id),
  (
    p
  ) => `        <div class="row"><div><a class="nm" href="${link(p, '')}">${p.title}</a><div class="du">${p.duration} мин</div></div>
          <div class="pr">${money(p)}</div><button class="bk" data-book data-svc="${p.title}">Записаться</button></div>`
)}
      </div>
    </div>`
)}
  </div>
</section>

<!-- ============ ДО / ПОСЛЕ ============ -->
<section class="sec" id="results">
  <div class="wrap ba-wrap">
    <div class="rv">
      <p class="eyebrow">${site.results.eyebrow}</p>
      <h2 class="sec-h">${site.results.title}</h2>
      <p class="sec-sub" style="margin-bottom:20px">${site.results.lead}</p>
      <div class="chips" id="baTabs">${baTabs(site.results.pairs, site.results.tags)}</div>
    </div>
    ${beforeAfter(site.results.pairs, '', site.results.ratio)}
  </div>
</section>

<!-- ============ О МАСТЕРЕ ============ -->
<section class="sec" id="about" style="background:var(--soft)">
  <div class="wrap about">
    <div class="im ph rv"${site.about.photoRatio ? ` style="aspect-ratio:${site.about.photoRatio}"` : ''}>${pic(site.about.photo, { alt: site.about.photoAlt || site.about.name, w: 600, h: 750, pos: site.about.photoPos })}</div>
    <div class="rv bio">
      <p class="eyebrow">${site.about.eyebrow}</p>
      <h2 class="sec-h">${site.about.name}</h2>
      <p class="bio-role">${site.about.role}</p>
      <p class="bio-lead">${site.about.lead}</p>

      <div class="brands">
        <span class="brands-lb">${site.about.brandsLabel}</span>
        <div class="brands-row">${site.about.brands.map((b) => `<span class="brand-chip">${b}</span>`).join('')}</div>
      </div>

      <blockquote class="bio-quote">${site.about.quote}</blockquote>

      <div class="docs">
        ${site.about.docs
          .map((d, i) =>
            isFile(d)
              ? `<a class="doc has-img" href="images/${d}" data-lb="docs" aria-label="Документ ${i + 1}, открыть крупно"><img src="images/${d}" alt="Диплом или сертификат ${i + 1}" loading="lazy" width="300" height="380"></a>`
              : `<span class="doc">${d}</span>`
          )
          .join('')}
      </div>
    </div>

    <div class="qual rv">
      <h3>${site.about.qualificationTitle}</h3>
      <ul class="tl">
${list(
  site.about.qualification,
  (q) => `        <li><span class="yr">${q.year}</span>
          <p>${q.text}</p></li>`
)}
      </ul>
    </div>
  </div>
</section>

<!-- ============ ОТЗЫВЫ ============ -->
<section class="sec" id="reviews">
  <div class="wrap">
    <div class="sec-head rv">
      <div>
        <p class="eyebrow">${site.reviews.eyebrow}</p>
        <h2 class="sec-h">${site.reviews.title}</h2>
      </div>
      <div class="rev-links">
        <span class="cap">${site.reviews.platformsNote}</span>
        <a class="bb bb-103" href="${site.reviews.platforms[0].url}" target="_blank" rel="noopener"
           aria-label="Отзывы на 103.by">
          <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11.5" fill="#fff"/>
            <circle cx="12" cy="12" r="9.6" fill="#D8443D"/>
            <path d="M10.35 6.4h3.3v3.95h3.95v3.3H13.65V17.6h-3.3v-3.95H6.4v-3.3h3.95z" fill="#fff"/>
          </svg>${site.reviews.platforms[0].label}</a>
        <a class="bb bb-relax" href="${site.reviews.platforms[1].url}"
           target="_blank" rel="noopener" aria-label="Отзывы на Relax.by">${site.reviews.platforms[1].label}<i>${site.reviews.platforms[1].suffix}</i></a>
      </div>
    </div>
    <div class="rev-grid">
${list(
  site.reviews.items,
  (r) => `      <div class="rev rv"><div class="stars">${'★'.repeat(r.stars)}</div>
        <p>${r.text}</p>
        <div class="who">${avatar(r.avatar, r.name)}<div><div class="nm">${r.name}</div><div class="src">${r.source}</div></div></div></div>`
)}
    </div>
  </div>
</section>

<!-- ============ КАК ПРОХОДИТ ============ -->
<section class="sec" style="background:var(--soft)">
  <div class="wrap">
    <p class="eyebrow rv">${site.visit.eyebrow}</p>
    <h2 class="sec-h rv" style="margin-bottom:28px">${site.visit.title}</h2>
    <div class="steps">
${list(
  site.visit.steps,
  (s, i) => `      <div class="step rv"><span class="n">${i + 1}</span><div><h4>${s.title}</h4>
        <p>${s.text}</p></div></div>`
)}
    </div>
  </div>
</section>

${strip(site.strips[1])}

<!-- ============ ОБУЧЕНИЕ ============ -->
<section class="edu" id="edu">
  <div class="wrap edu-in">
    <div class="rv">
      <div class="im ph">${pic(site.education.photo, { alt: site.education.title, w: 900, h: 620 })}<span class="bdg">${site.education.badge}</span></div>
      <div class="edu-side">
        <div class="edu-flow">
          <span class="lb">${site.education.flow.label}</span>
          <b>${site.education.flow.date}</b>
          <span class="left">${site.education.flow.left}</span>
        </div>
        <div class="edu-quote">
          <p>${site.education.quote.text}</p>
          <div class="who">${avatar(site.education.quote.avatar, site.education.quote.name)}<div><div class="nm">${site.education.quote.name}</div>
            <div class="src">${site.education.quote.source}</div></div></div>
        </div>
      </div>
    </div>
    <div class="rv">
      <p class="eyebrow" style="color:var(--sand)">${site.education.eyebrow}</p>
      <h2>${site.education.title}</h2>
      <p class="lead">${site.education.lead}</p>

${list(
  site.education.courses,
  (c) => `      <div class="crs">
        <div>
          <h4>${c.title}</h4>
          <p class="m">${c.text}</p>
          <div class="tags">${c.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        </div>
        <div class="rt"><span class="pr">${c.price} BYN</span>
          <button class="btn" data-book data-svc="Курс «${c.title}»">Записаться</button></div>
      </div>`
)}

      <p style="font-size:12.5px; color:#8A7F73; margin:14px 0 0">
        ${site.education.note}</p>
    </div>
  </div>
</section>

<!-- ============ СЕРТИФИКАТ ============ -->
<section class="gift" id="gift">
  <div class="wrap gift-in">
    <div class="gift-card rv${isFile(site.gift.photo) ? ' has-photo' : ''}">
      ${
        isFile(site.gift.photo)
          ? pic(site.gift.photo, { alt: site.gift.photoAlt || site.gift.title, w: 900, h: 900 })
          : `<div class="gift-frame"><b>${site.brand.name}</b><span>${site.brand.suffix}</span>
        <div class="amt">ПОДАРОЧНЫЙ СЕРТИФИКАТ</div></div>`
      }
    </div>
    <div class="rv">
      <p class="eyebrow">${site.gift.eyebrow}</p>
      <h2 class="sec-h">${site.gift.title}</h2>
      <p class="sec-sub" style="margin-bottom:22px">${site.gift.lead}</p>
      <ul>
${list(site.gift.items, (i) => `        <li>${i}</li>`)}
      </ul>
      <div class="amounts">
        ${site.gift.amounts.map((a) => `<button class="amt-b${a === site.gift.amountDefault ? ' on' : ''}">${a} BYN</button>`).join('')}<button class="amt-b">${site.gift.amountsCustom}</button>
      </div>
      <div class="hero-cta" style="margin:0">
        <button class="btn" data-book data-svc="${site.gift.title}">${site.gift.cta}</button>
        <a class="cbtn" href="${tel}">${icon('phone')}Позвонить</a>
      </div>
    </div>
  </div>
</section>

<!-- ============ ГАЛЕРЕЯ ============ -->
<section class="sec">
  <div class="wrap">
    <p class="eyebrow rv">${site.gallery.eyebrow}</p>
    <h2 class="sec-h rv" style="margin-bottom:26px">${site.gallery.title}</h2>
    <div class="gal">
      ${site.gallery.photos.map((p, i) => `<div class="ph rv">${pic(p, { alt: `${site.gallery.eyebrow} — фото ${i + 1}`, w: 900, h: 900 })}</div>`).join('\n      ')}
    </div>
  </div>
</section>

<!-- ============ ПОЧЕМУ ВЫБИРАЮТ ============ -->
<section class="sec">
  <div class="wrap">
    <p class="eyebrow rv">${site.why.eyebrow}</p>
    <h2 class="sec-h rv" style="margin-bottom:30px">${site.why.title}</h2>
    <div class="why-grid">
${list(
  site.why.items,
  (w) => `      <div class="why rv"><span class="ic">${icon(w.icon)}</span>
        <h3>${w.title}</h3>
        <p>${w.text}</p></div>`
)}
    </div>
  </div>
</section>

<!-- ============ FAQ ============ -->
<section class="sec" style="background:var(--soft)">
  <div class="wrap" style="max-width:840px">
    <p class="eyebrow rv">${site.faq.eyebrow}</p>
    <h2 class="sec-h rv" style="margin-bottom:20px">${site.faq.title}</h2>
    <div id="faq">
${list(
  site.faq.items,
  (f) => `      <div class="faq-i"><button class="faq-q">${f.q}<i>+</i></button>
        <div class="faq-a"><div><p>${f.a}</p></div></div></div>`
)}
    </div>
  </div>
</section>

<!-- ============ ЗАПИСЬ: 3 КОЛОНКИ ============ -->
<section class="sec" id="contacts">
  <div class="wrap book-in">

    <div class="col rv">
      <p class="eyebrow">${site.booking.eyebrow}</p>
      <h2>${site.booking.title}</h2>
      <p class="lead">${site.booking.lead}</p>
      <div class="call-row">
        <a class="cbtn-row" href="${tel}">
          <span class="ic">${icon('phone')}</span>
          <span><span class="lb">Позвонить</span><span class="vl">${C.phone}</span></span>
        </a>
        <a class="cbtn ig" href="${attr(C.instagram)}" target="_blank" rel="noopener">${icon('ig')}Instagram</a>
      </div>
      <div class="msg-grid three">
        <a class="cbtn tg" href="${C.telegram}" target="_blank" rel="noopener">${icon('tg')}Telegram</a>
        <a class="cbtn wa" href="${attr(C.whatsapp)}" target="_blank" rel="noopener">${icon('wa')}WhatsApp</a>
        <a class="cbtn vb" href="${C.viber}">${icon('viber')}Viber</a>
      </div>
      <p class="note">${site.booking.note}</p>
    </div>

    <div class="col rv">
      <div class="form-card">
        <form id="bookForm" data-endpoint="${site.forms.endpoint}" novalidate>
          <p class="hp"><label>Не заполняйте: <input name="bot-field"></label></p>
          <div class="fld-row">
            <div class="fld"><label for="f-name">Ваше имя</label>
              <input id="f-name" name="imya" placeholder="Как к вам обращаться"></div>
            <div class="fld"><label for="f-tel">Телефон или мессенджер</label>
              <input id="f-tel" name="telefon" type="tel" required placeholder="+375 __ ___-__-__"></div>
          </div>
          <div class="fld">
            <label for="f-svc">Услуга</label>
            <select id="f-svc" name="usluga">
              <option value="">Выберите направление</option>
              ${site.booking.serviceOptions.map((o) => `<option>${o}</option>`).join('')}
            </select>
          </div>
          <button class="btn" type="submit" style="width:100%">${site.booking.cta}</button>
          <p class="consent">${site.booking.consent}</p>
        </form>
        <div class="ok" id="bookOk">
          <div class="circle">✓</div>
          <h3 style="font-size:22px; margin-bottom:9px">${site.booking.successTitle}</h3>
          <p style="color:var(--muted); font-size:14.5px; margin:0">${site.booking.successText}</p>
        </div>
      </div>
    </div>

    <div class="col rv book-map">
      <div class="map">
        <div class="canvas${C.mapEmbed ? ' has-map' : ''}">${
          C.mapEmbed
            ? `<iframe src="${attr(C.mapEmbed)}" title="Карта проезда: ${C.address}"
              loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>`
            : `Яндекс.Карта<br>${C.address}`
        }</div>
        <div class="info">
          <span class="lb">Адрес</span>
          <b>${C.address}</b>
          <span>${C.addressNote}</span>
          <ul class="hours">
${list(C.hours, (h) => `            <li><span>${h.days}</span><b>${h.time}</b></li>`)}
          </ul>
          <a class="map-link" href="${C.mapLink}"
             target="_blank" rel="noopener">
            <span class="mi"><svg width="16" height="16"><use href="#i-pin"/></svg></span>
            Открыть в Яндекс.Картах
            <svg class="ar" width="14" height="14"><use href="#i-ar"/></svg></a>
        </div>
      </div>
    </div>

  </div>
</section>
`;

// ═══════════════════ СТРАНИЦА ПРОЦЕДУРЫ ═══════════════════
function procedurePage(p) {
  const c = cat(p.category);
  const root = '../../';
  const related = procsOf(p.category)
    .filter((x) => x.slug !== p.slug)
    .slice(0, 3);
  const svc = `${p.titleFull || p.title} · ${p.duration} мин · ${money(p)}`;

  const body = `<!-- ============ ХЛЕБНЫЕ КРОШКИ ============ -->
<div class="wrap crumbs">
  <a href="${hrefHome(root)}">Главная</a><span>→</span>
  <a href="${hrefHome(root, '#services')}">Услуги</a><span>→</span>
  <a href="${hrefHome(root, '#dir')}">${c.title}</a><span>→</span>
  <span style="color:var(--ink); opacity:1">${p.title}</span>
</div>

<!-- ============ ШАПКА ПРОЦЕДУРЫ ============ -->
<section class="wrap proc-hero">
  <div>
    <p class="eyebrow">${c.title}${p.specs?.find((s) => s.label === 'Косметика') ? ` · ${p.specs.find((s) => s.label === 'Косметика').value}` : ''}</p>
    <h1 class="proc-h1">${p.titleFull || p.title}</h1>
    <p class="proc-lead">${p.lead}</p>

    <div class="proc-gal">
      <div class="main ph">${pic(p.photoCover, { root, alt: p.titleFull || p.title, w: 1400, h: 875, eager: true })}</div>
      <div class="thumbs">
${list(
  p.gallery && p.gallery.length ? p.gallery : ['b', 'c', 'd'],
  (g, i) =>
    `        <div class="ph">${pic(g, { root, alt: `${p.title} — фото ${i + 1}`, w: 600, h: 450 })}</div>`
)}
      </div>
    </div>
  </div>

  <div class="panel-wrap">
    <div class="panel">
      <div class="price">${money(p)}<small>за сеанс</small></div>
      <ul class="specs">
${list(p.specs, (s) => `        <li><span>${s.label}</span><b>${s.value}</b></li>`)}
      </ul>
      <button class="btn" data-book data-svc="${svc}">Записаться на процедуру</button>
      <div class="msg-grid">
        ${msgButtons()}
      </div>
      <p class="hint">Не уверены, подойдёт ли вам? Напишите — отвечу до записи, это бесплатно.</p>
    </div>
  </div>
</section>

<!-- ============ КОМУ ПОДХОДИТ ============ -->
<section class="sec">
  <div class="wrap">
    <p class="eyebrow rv">Показания</p>
    <h2 class="sec-h rv">Кому подходит</h2>
    <p class="sec-sub rv">${p.indicationsLead}</p>
    <ul class="ind rv">
${list(p.indications, (i) => `      <li>${i}</li>`)}
    </ul>
    <div class="chips rv" style="margin-top:26px">
      ${p.tags.map((t) => `<span class="chip">${t}</span>`).join('')}
    </div>
  </div>
</section>

<!-- ============ ДО / ПОСЛЕ ============ -->
<section class="sec" style="background:var(--soft)">
  <div class="wrap ba-wrap">
    <div class="rv">
      <p class="eyebrow">Результат</p>
      <h2 class="sec-h">До и после одной процедуры</h2>
      <p class="sec-sub" style="margin-bottom:20px">Один и тот же свет, ракурс и расстояние, без ретуши
        и фильтров. Фото публикуются с согласия клиентов. Потяните ползунок, чтобы сравнить.</p>
      <div class="chips" id="baTabs">${baTabs(p.beforeAfter, [p.beforeAfterNote], root)}</div>
    </div>
    ${beforeAfter(p.beforeAfter, root, p.beforeAfterRatio || site.results.ratio)}
  </div>
</section>

<!-- ============ КАК ПРОХОДИТ ============ -->
<section class="sec">
  <div class="wrap">
    <p class="eyebrow rv">Ход процедуры</p>
    <h2 class="sec-h rv" style="margin-bottom:30px">Как проходит — ${['один', 'два', 'три', 'четыре', 'пять', 'шесть'][p.stages.length - 1]} этап${p.stages.length > 4 ? 'ов' : 'а'}</h2>
    <div class="stage-grid">
${list(
  p.stages,
  (
    s,
    i
  ) => `      <div class="stage rv"><div class="im">${pic(s.photo, { root, alt: `${p.title}, этап ${i + 1}: ${s.title}`, w: 1000, h: 625 })}<span class="n">${i + 1}</span></div>
        <div class="bd"><h3>${s.title}</h3>
          <p>${s.text}</p></div></div>`
)}
    </div>
  </div>
</section>

<!-- ============ ПРЕИМУЩЕСТВА ============ -->
<section class="sec" style="background:var(--soft)">
  <div class="wrap">
    <p class="eyebrow rv">Особенности</p>
    <h2 class="sec-h rv" style="margin-bottom:30px">${p.advantagesTitle}</h2>
    <div class="adv-grid">
${list(
  p.advantages,
  (a) => `      <div class="adv rv"><span class="ic">${icon(a.icon)}</span>
        <div><h3>${a.title}</h3>
          <p>${a.text}</p></div></div>`
)}
    </div>
  </div>
</section>

<!-- ============ ПРОТИВОПОКАЗАНИЯ И УХОД ============ -->
<section class="sec">
  <div class="wrap">
    <p class="eyebrow rv">Важно знать</p>
    <h2 class="sec-h rv" style="margin-bottom:30px">Противопоказания и уход</h2>
    <div class="care-grid">
      <div class="care warn rv">
        <h3>${icon('shield')}Противопоказания</h3>
        <ul>
${list(p.contraindications, (i) => `          <li>${i}</li>`)}
        </ul>
        <p class="foot">${p.contraindicationsNote}</p>
      </div>
      <div class="care ok rv">
        <h3>${icon('clock')}Подготовка и уход после</h3>
        <p style="margin:0 0 12px; font-size:13px; letter-spacing:.1em; text-transform:uppercase; color:var(--hl)">За неделю до</p>
        <ul>
${list(p.prepare, (i) => `          <li>${i}</li>`)}
        </ul>
        <p style="margin:18px 0 12px; font-size:13px; letter-spacing:.1em; text-transform:uppercase; color:var(--hl)">Первые 2–3 дня после</p>
        <ul>
${list(p.aftercare, (i) => `          <li>${i}</li>`)}
        </ul>
        <p class="foot">${p.careNote}</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ ЗАПИСЬ ============ -->
<section class="sec" style="padding-top:0">
  <div class="wrap">
    <div class="book-slim rv">
      <div>
        <h2>Записаться на ${p.title[0].toLowerCase() + p.title.slice(1)}</h2>
        <p>Оставьте заявку или напишите в мессенджер — согласуем удобное время. ${money(p)}, ${p.duration} минут.</p>
      </div>
      <div class="row">
        <button class="btn" data-book data-svc="${svc}">Записаться</button>
        ${msgButtons()}
      </div>
    </div>
  </div>
</section>

<!-- ============ ПОХОЖИЕ ============ -->
<section class="sec" style="background:var(--soft); padding-top:56px">
  <div class="wrap">
    <p class="eyebrow rv">Другие процедуры направления</p>
    <h2 class="sec-h rv" style="margin-bottom:28px">Похожие процедуры</h2>
    <div class="sig-grid">
${list(
  related,
  (
    r
  ) => `      <a class="sig rv" href="${link(r, root)}"><div class="im">${pic(r.photo, { root, alt: r.title, w: 1200, h: 515 })}</div>
        <div class="bd"><h3>${r.title}</h3>
          <p>${r.signatureText || `Процедура направления «${c.title}». Подробности и показания уточню на консультации.`}</p>
          <div class="ft"><span class="pr">${money(r)} · ${r.duration} мин</span>
            <span class="arrow">${icon('ar')}</span></div></div></a>`
)}
    </div>
  </div>
</section>
`;

  return layout({
    title: p.meta?.title || `${p.titleFull || p.title} — ${p.price} BYN | ${site.brand.name} Beauty`,
    description: p.meta?.description || p.lead.slice(0, 160),
    root,
    body,
  });
}

// ═══════════════════ СБОРКА ═══════════════════
const dist = join(ROOT, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(ROOT, 'src/assets'), join(dist, 'assets'), { recursive: true });
if (existsSync(join(ROOT, 'src/images'))) {
  cpSync(join(ROOT, 'src/images'), join(dist, 'images'), { recursive: true });
}

writeFileSync(
  join(dist, 'index.html'),
  layout({
    title: `Косметический кабинет ${site.brand.name} Beauty в ${site.contacts.city}е — чистки, пилинги, массаж лица`,
    description: `${site.hero.lead} ${C.address}. Запись: ${C.phone}.`,
    root: '',
    body: indexBody,
  })
);

for (const p of pages) {
  const dir = join(dist, 'uslugi', p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), procedurePage(p));
}

// ——— отчёт ———
const todo = db.procedures.filter((p) => p.priceTodo);
console.log(`Собрано: 1 главная + ${pages.length} страниц процедур`);
console.log(`Категорий: ${cats.length}, процедур в прайсе: ${db.procedures.length}`);
if (todo.length) {
  console.log(`\nЦены требуют проверки (priceTodo) — ${todo.length}:`);
  for (const p of todo) console.log(`  ${p.title} — ${p.price} BYN`);
}
const noPage = db.procedures.filter((p) => !p.page).length;
console.log(`\nБез собственной страницы: ${noPage} — ведут на якорь #dir`);

const slots = [
  ['Первый экран', site.hero.photo],
  ['О мастере', site.about.photo],
  ['Обучение', site.education.photo],
  ['Сертификат', site.gift.photo],
  ['Карточка в меню «Услуги»', site.megaFeature.photo],
  ...site.reviews.items.map((r) => [`Отзыв: ${r.name}`, r.avatar]),
  ...cats.map((c) => [`Направление: ${c.title} — карточка`, c.photo]),
  ...cats.map((c) => [`Направление: ${c.title} — таблица`, c.photoDir || c.photo]),
  ...site.gallery.photos.map((v, i) => [`Кабинет ${i + 1}`, v]),
  ...pages.flatMap((p) => [
    [`${p.title}: обложка`, p.photoCover],
    ...p.stages.map((s, i) => [`${p.title}: этап ${i + 1}`, s.photo]),
  ]),
];
const baCount = realPairs(site.results.pairs).length;
const empty = slots.filter(([, v]) => !isFile(v));
console.log(`\nФото: ${slots.length - empty.length} из ${slots.length} на месте, ${empty.length} — заглушки`);
console.log(`Пар «до/после» на главной: ${baCount || 'ни одной — показывается заглушка'}`);
if (LOCAL) console.log('\nЛокальная сборка: ссылки ведут на index.html, откроется с диска');
