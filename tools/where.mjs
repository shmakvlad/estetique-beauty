#!/usr/bin/env node
// Ищет, из какого исходника берётся текст на собранной странице.
// Запуск:  npm run where -- "часть текста"

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const q = process.argv.slice(2).join(' ').trim();

if (!q) {
  console.log('Укажите текст: npm run where -- "Записаться на консультацию"');
  process.exit(0);
}

const targets = [
  ['data/site.json', 'тексты главной — правьте здесь, потом npm run build'],
  ['data/procedures.json', 'услуги и цены — правьте здесь, потом npm run build'],
  ['build.mjs', 'разметка блока — правьте здесь, потом npm run build'],
  ['src/assets/site.css', 'оформление'],
  ['src/assets/site.js', 'поведение'],
];

const needle = q.toLowerCase();
let found = 0;

for (const [file, hint] of targets) {
  const p = join(ROOT, file);
  if (!existsSync(p)) continue;
  const lines = readFileSync(p, 'utf8').split('\n');
  const hits = [];
  lines.forEach((l, i) => {
    if (l.toLowerCase().includes(needle)) hits.push([i + 1, l.trim()]);
  });
  if (!hits.length) continue;
  found += hits.length;
  console.log(`\n\x1b[1m${file}\x1b[0m  — ${hint}`);
  for (const [n, l] of hits.slice(0, 6)) {
    console.log(`  строка ${String(n).padStart(4)}  ${l.length > 110 ? l.slice(0, 110) + '…' : l}`);
  }
  if (hits.length > 6) console.log(`  …ещё ${hits.length - 6}`);
}

if (!found) {
  console.log(`\nНичего не нашлось по запросу «${q}».`);
  console.log('Попробуйте кусок покороче — например, два-три слова без окончаний.');
} else {
  console.log('\nПравьте в исходнике, затем: npm run build');
}
