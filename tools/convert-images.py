#!/usr/bin/env python3
"""Переводит фотографии из src/images в WebP и обновляет ссылки в data/*.json.

Запуск:  npm run images

Что делает:
  • находит .jpg/.jpeg/.png в src/images
  • разворачивает по EXIF (снимки с телефона часто лежат боком)
  • ужимает, если длинная сторона больше 2000 px
  • сохраняет .webp, качество 82
  • переносит исходник в originals/
  • заменяет имя файла во всех data/*.json
"""
from PIL import Image, ImageOps
import os, shutil, sys, glob

SRC, ORIG, MAX, Q = 'src/images', 'originals', 2000, 82
EXT = ('.jpg', '.jpeg', '.png')

if not os.path.isdir(SRC):
    sys.exit(f'Нет папки {SRC}')
os.makedirs(ORIG, exist_ok=True)

todo = [f for f in sorted(os.listdir(SRC)) if os.path.splitext(f)[1].lower() in EXT]
if not todo:
    print('Все фотографии уже в WebP — конвертировать нечего.')
    sys.exit(0)

done, before, after = [], 0, 0
for f in todo:
    src = os.path.join(SRC, f)
    out_name = os.path.splitext(f)[0] + '.webp'
    out = os.path.join(SRC, out_name)

    im = ImageOps.exif_transpose(Image.open(src))
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGB')
    w0, h0 = im.size
    if max(im.size) > MAX:
        k = MAX / max(im.size)
        im = im.resize((round(w0 * k), round(h0 * k)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=Q, method=6)

    b, a = os.path.getsize(src), os.path.getsize(out)
    before += b; after += a
    resized = f'  {w0}×{h0} → {im.size[0]}×{im.size[1]}' if (w0, h0) != im.size else ''
    print(f'  {f:<32} {b // 1024:>5} КБ → {a // 1024:>4} КБ{resized}')
    done.append((f, out_name))
    shutil.move(src, os.path.join(ORIG, f))

print(f'\nИтого: {before // 1024} КБ → {after // 1024} КБ '
      f'(минус {100 - after * 100 // before}%)')

changed = []
for p in glob.glob('data/*.json'):
    s = old = open(p, encoding='utf-8').read()
    for f, o in done:
        s = s.replace(f'"{f}"', f'"{o}"')
    if s != old:
        open(p, 'w', encoding='utf-8').write(s)
        changed.append(os.path.basename(p))
print(f'Ссылки обновлены в: {", ".join(changed) if changed else "— (имён не встретилось)"}')
print(f'Исходники перенесены в {ORIG}/ — можно удалить, когда проверите качество.')
print('\nДальше: npm run build')
