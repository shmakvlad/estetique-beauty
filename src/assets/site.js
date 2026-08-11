(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var hdr = document.getElementById('hdr'),
    sticky = document.getElementById('sticky');
  addEventListener(
    'scroll',
    function () {
      var y = scrollY;
      hdr.classList.toggle('small', y > 40);
      sticky.classList.toggle('on', y > 600);
    },
    { passive: true }
  );

  var li = document.getElementById('navSvc'),
    mega = document.getElementById('mega');
  if (li && mega) {
    var btn = li.querySelector('button'),
      oT,
      cT;
    var open = function () {
      clearTimeout(cT);
      oT = setTimeout(function () {
        mega.classList.add('on');
        li.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }, 120);
    };
    var close = function () {
      clearTimeout(oT);
      cT = setTimeout(function () {
        mega.classList.remove('on');
        li.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }, 250);
    };
    li.addEventListener('mouseenter', open);
    li.addEventListener('mouseleave', close);
    mega.addEventListener('mouseenter', function () {
      clearTimeout(cT);
    });
    mega.addEventListener('mouseleave', close);
    btn.addEventListener('click', function () {
      mega.classList.contains('on') ? close() : open();
    });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        clearTimeout(oT);
        mega.classList.remove('on');
        li.classList.remove('open');
      }
    });
  }

  var bg = document.getElementById('burger'),
    mm = document.getElementById('mmenu');
  bg.addEventListener('click', function () {
    var on = mm.classList.toggle('on');
    bg.classList.toggle('on', on);
    document.body.style.overflow = on ? 'hidden' : '';
  });
  mm.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      mm.classList.remove('on');
      bg.classList.remove('on');
      document.body.style.overflow = '';
    });
  });
  var mgrp = document.getElementById('mgrp');
  mgrp.querySelector('button').addEventListener('click', function () {
    mgrp.classList.toggle('on');
  });

  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('on');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px' }
    );
    document.querySelectorAll('.rv').forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(el);
    });
  } else {
    document.querySelectorAll('.rv').forEach(function (el) {
      el.classList.add('on');
    });
  }

  var ba = document.getElementById('ba'),
    bf = document.getElementById('baBefore'),
    hd = document.getElementById('baHandle');
  if (ba) {
    var set = function (p, anim) {
      p = Math.max(2, Math.min(98, p));
      bf.style.transition = hd.style.transition = anim
        ? 'clip-path 1.1s cubic-bezier(.22,1,.36,1), left 1.1s cubic-bezier(.22,1,.36,1)'
        : 'none';
      bf.style.clipPath = 'inset(0 ' + (100 - p) + '% 0 0)';
      hd.style.left = p + '%';
    };
    var drag = false,
      move = function (x) {
        var r = ba.getBoundingClientRect();
        set(((x - r.left) / r.width) * 100, false);
      };
    ba.addEventListener('pointerdown', function (e) {
      drag = true;
      ba.setPointerCapture(e.pointerId);
      move(e.clientX);
    });
    ba.addEventListener('pointermove', function (e) {
      if (drag) move(e.clientX);
    });
    ba.addEventListener('pointerup', function () {
      drag = false;
    });
    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) {
              setTimeout(function () {
                set(74, true);
              }, 400);
              setTimeout(function () {
                set(50, true);
              }, 1600);
            }
          });
        },
        { threshold: 0.5 }
      ).observe(ba);
    }
  }

  var hs = document.getElementById('heroStats'),
    cntDone = false;
  var runCnt = function () {
    if (cntDone || !hs) return;
    cntDone = true;
    hs.querySelectorAll('b[data-to]').forEach(function (el) {
      var to = parseFloat(el.dataset.to),
        dec = parseInt(el.dataset.dec || 0),
        suf = el.dataset.suf || '';
      if (isNaN(to)) return;
      if (reduce) {
        el.textContent = to.toFixed(dec) + suf;
        return;
      }
      var t0 = null;
      requestAnimationFrame(function step(ts) {
        if (!t0) t0 = ts;
        var pr = Math.min((ts - t0) / 1200, 1),
          e = 1 - Math.pow(1 - pr, 3);
        el.textContent = (to * e).toFixed(dec) + (pr === 1 ? suf : '');
        if (pr < 1) requestAnimationFrame(step);
      });
    });
  };
  if (hs) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) runCnt();
          });
        },
        { threshold: 0.4 }
      ).observe(hs);
    } else runCnt();
  }

  document.querySelectorAll('#faq .faq-q').forEach(function (q) {
    q.addEventListener('click', function () {
      q.parentElement.classList.toggle('on');
    });
  });

  document.querySelectorAll('.amt-b').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.amt-b').forEach(function (x) {
        x.classList.remove('on');
      });
      b.classList.add('on');
    });
  });

  var ov = document.getElementById('ov'),
    mSvc = document.getElementById('mSvc'),
    last = null;
  var openM = function (svc, src) {
    last = src || null;
    mSvc.textContent = svc || 'Услугу уточним при звонке';
    var f = document.getElementById('mSvcField');
    if (f) f.value = svc || 'не указана';
    ov.classList.add('on');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      document.getElementById('m-tel').focus();
    }, 320);
  };
  var closeM = function () {
    ov.classList.remove('on');
    document.body.style.overflow = '';
    if (last) last.focus();
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-book]');
    if (t) {
      e.preventDefault();
      openM(t.dataset.svc, t);
      return;
    }
    if (e.target === ov) closeM();
  });
  document.getElementById('mX').addEventListener('click', closeM);
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ov.classList.contains('on')) closeM();
  });

  var submit = function (form, okEl) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var tel = form.querySelector('input[required]');
      if (!tel.value.trim()) {
        tel.focus();
        tel.style.borderColor = '#B4564A';
        return;
      }
      var prev = form.querySelector('.form-error');
      if (prev) prev.remove();

      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Отправляю…';
      }
      // Заявка уходит на серверный обработчик, тот пересылает её в Telegram
      var data = new FormData(form);
      data.append('istochnik', location.pathname + location.hash);

      fetch(form.dataset.endpoint || '/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
      })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.style.display = 'none';
          okEl.classList.add('on');
        })
        .catch(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = label;
          }
          var msg = form.querySelector('.form-error');
          if (!msg) {
            msg = document.createElement('p');
            msg.className = 'form-error';
            btn.insertAdjacentElement('afterend', msg);
          }
          // Открытый с диска файл не может достучаться до серверной функции —
          // при локальной проверке это ожидаемо, а не поломка
          msg.textContent =
            location.protocol === 'file:'
              ? 'Локальный просмотр: отправка работает только на опубликованном сайте.'
              : 'Не получилось отправить. Позвоните или напишите в мессенджер — кнопки ниже.';
        });
    });
  };
  submit(document.getElementById('mForm'), document.getElementById('mOk'));
  submit(document.getElementById('bookForm'), document.getElementById('bookOk'));
})();

/* ---------- ПРОСМОТРЩИК ИЗОБРАЖЕНИЙ ---------- */
(function () {
  var lb = document.getElementById('lb');
  if (!lb) return;
  var img = document.getElementById('lbImg');
  var counter = document.getElementById('lbCount');
  var items = [];
  var idx = 0;
  var opener = null;

  function show(i) {
    idx = (i + items.length) % items.length;
    var a = items[idx];
    img.src = a.getAttribute('href');
    img.alt = (a.querySelector('img') || {}).alt || '';
    counter.textContent = idx + 1 + ' / ' + items.length;
    lb.classList.toggle('single', items.length < 2);
    // подгружаем соседей заранее, чтобы перелистывание было мгновенным
    [items[(idx + 1) % items.length], items[(idx - 1 + items.length) % items.length]].forEach(function (n) {
      if (n) new Image().src = n.getAttribute('href');
    });
  }

  function open(group, i, from) {
    items = [].slice.call(document.querySelectorAll('[data-lb="' + group + '"]'));
    if (!items.length) return;
    opener = from || null;
    show(i);
    lb.classList.add('on');
    document.body.style.overflow = 'hidden';
    document.getElementById('lbX').focus();
  }

  function close() {
    lb.classList.remove('on');
    document.body.style.overflow = '';
    if (opener) opener.focus();
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-lb]');
    if (a) {
      e.preventDefault();
      var group = a.getAttribute('data-lb');
      var all = [].slice.call(document.querySelectorAll('[data-lb="' + group + '"]'));
      open(group, all.indexOf(a), a);
    }
  });

  document.getElementById('lbX').addEventListener('click', close);
  document.getElementById('lbPrev').addEventListener('click', function () {
    show(idx - 1);
  });
  document.getElementById('lbNext').addEventListener('click', function () {
    show(idx + 1);
  });
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target.classList.contains('lb-fig')) close();
  });

  addEventListener('keydown', function (e) {
    if (!lb.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'ArrowLeft') show(idx - 1);
  });

  // перелистывание пальцем
  var x0 = null;
  lb.addEventListener('pointerdown', function (e) {
    x0 = e.clientX;
  });
  lb.addEventListener('pointerup', function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  });
})();

/* ---------- ПЕРЕКЛЮЧЕНИЕ ПАР «ДО/ПОСЛЕ» ---------- */
(function () {
  var tabs = document.getElementById('baTabs');
  var before = document.getElementById('baBefore');
  var after = document.getElementById('baAfter');
  if (!tabs || !before || !after) return;

  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.ba-tab');
    if (!b) return;
    tabs.querySelectorAll('.ba-tab').forEach(function (x) {
      x.classList.remove('on');
    });
    b.classList.add('on');
    var bi = before.querySelector('img');
    var ai = after.querySelector('img');
    if (bi) bi.src = b.dataset.before;
    if (ai) ai.src = b.dataset.after;
  });

  // соседние пары подгружаем заранее
  tabs.querySelectorAll('.ba-tab').forEach(function (b) {
    new Image().src = b.dataset.before;
    new Image().src = b.dataset.after;
  });
})();
