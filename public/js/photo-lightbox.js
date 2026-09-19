/* Photo viewer for phones and tablets.
   Loaded ONLY when matchMedia('(max-width: 960px), (pointer: coarse)') matches (see the loader
   at the end of destination.html / project.html), so desktop never requests or runs this.

   Tap any photo → it expands from its own spot to a fitted full-screen view (the same motion as
   the homepage About gallery). A bar at the bottom steps through the page's photos:  ‹  3 / 15  ›.
   The photo follows a finger: swipe left/right to step, swipe down to dismiss. The phone's Back
   gesture closes the viewer instead of leaving the page. Captions come along where a photo has one.

   Config (set before this script loads):  window.PHOTO_LIGHTBOX = { selector: 'css for the <img>s' }  */
(function () {
  if (window.__photoLightbox) return;
  window.__photoLightbox = true;
  var cfg = window.PHOTO_LIGHTBOX || {};
  var SELECTOR = cfg.selector;
  if (!SELECTOR) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';

  // ── styles (injected, so the pages' own stylesheets — and desktop — are untouched) ──
  var css = document.createElement('style');
  css.id = 'plb-style';
  css.textContent = [
    SELECTOR.split(',').map(function (s) { return s.trim(); }).join(', ') + ' { cursor: zoom-in; -webkit-tap-highlight-color: transparent; }',
    '.plb { position: fixed; inset: 0; z-index: 8000; display: none; touch-action: pinch-zoom; overscroll-behavior: contain; -webkit-user-select: none; user-select: none; }',
    '.plb.is-open { display: block; }',
    '.plb-scrim { position: absolute; inset: 0; background: rgba(26, 25, 23, 0.96); opacity: 0; transition: opacity 0.5s ' + EXPO + '; }',
    '.plb.is-in .plb-scrim { opacity: 1; }',
    '.plb-img { position: absolute; top: 0; left: 0; display: block; object-fit: cover; transform-origin: 0 0; will-change: transform, opacity; box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.6); -webkit-user-drag: none; -webkit-touch-callout: none; }',
    '.plb-btn { position: absolute; width: 48px; height: 48px; display: grid; place-items: center; border: 0; padding: 0; background: transparent; color: #fff; cursor: pointer; opacity: 0; transition: opacity 0.3s ' + EXPO + ', transform 0.3s cubic-bezier(0.625, 0.05, 0, 1); -webkit-tap-highlight-color: transparent; }',
    '.plb.is-in .plb-btn { opacity: 0.86; }',
    '.plb-btn:active { transform: scale(0.9); }',
    '.plb-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; border-radius: 4px; opacity: 1; }',
    '.plb-btn[disabled] { opacity: 0.25 !important; }',
    '.plb-btn svg { width: 24px; height: 24px; display: block; stroke: currentColor; stroke-width: 1.6; fill: none; stroke-linecap: round; stroke-linejoin: round; }',
    '.plb-close { top: calc(10px + env(safe-area-inset-top, 0px)); right: calc(10px + env(safe-area-inset-right, 0px)); }',
    /* the bar: previous · counter · next — out of the iOS toolbar / home-indicator zone */
    '.plb-bar { position: absolute; left: 0; right: 0; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); height: 48px; display: flex; align-items: center; justify-content: center; gap: 20px; }',
    '.plb-bar .plb-btn { position: static; }',
    '.plb-count { min-width: 76px; text-align: center; font-family: var(--font-mono, ui-monospace, Menlo, monospace); font-size: 12px; letter-spacing: var(--tracking-caps, 0.1em); text-transform: uppercase; font-feature-settings: "case", "tnum"; color: rgba(255, 255, 255, 0.78); opacity: 0; transition: opacity 0.3s ' + EXPO + '; }',
    '.plb.is-in .plb-count { opacity: 1; }',
    '.plb-cap { position: absolute; left: 20px; right: 20px; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); margin: 0; text-align: center; font-family: var(--font-sans, system-ui, sans-serif); font-size: 13px; line-height: 1.5; color: rgba(255, 255, 255, 0.82); opacity: 0; transition: opacity 0.3s ' + EXPO + '; pointer-events: none; }',
    '.plb.is-in .plb-cap { opacity: 1; }',
    '.plb-cap:empty { display: none; }',
    '@media (orientation: landscape) and (max-height: 500px) { .plb-bar { bottom: 4px; } .plb-cap { display: none; } }'
  ].join('\n');
  document.head.appendChild(css);

  // ── markup ──
  var lb = document.createElement('div');
  lb.className = 'plb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Photo viewer');
  lb.setAttribute('aria-hidden', 'true');
  lb.innerHTML =
    '<div class="plb-scrim"></div>' +
    '<img class="plb-img" alt="" draggable="false">' +
    '<p class="plb-cap"></p>' +
    '<button class="plb-btn plb-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<div class="plb-bar">' +
      '<button class="plb-btn plb-prev" type="button" aria-label="Previous photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<span class="plb-count" aria-live="polite"></span>' +
      '<button class="plb-btn plb-next" type="button" aria-label="Next photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
    '</div>';
  document.body.appendChild(lb);
  var scrim = lb.querySelector('.plb-scrim'), img = lb.querySelector('.plb-img'), cap = lb.querySelector('.plb-cap');
  var btnX = lb.querySelector('.plb-close'), btnP = lb.querySelector('.plb-prev'), btnN = lb.querySelector('.plb-next'), count = lb.querySelector('.plb-count');

  var items = [], idx = -1, fitted = null, busy = false, isOpen = false, lastFocus = null, lockY = 0, prevRestoration = null;

  // every eligible photo on the page, in the order the eye reads them (rows top → bottom, left → right)
  function collect() {
    var list = Array.prototype.slice.call(document.querySelectorAll(SELECTOR)).filter(function (el) {
      var r = el.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && (el.currentSrc || el.getAttribute('src'));
    });
    var y = window.scrollY;
    return list.map(function (el) { var r = el.getBoundingClientRect(); return { el: el, top: r.top + y, left: r.left }; })
      .sort(function (a, b) { return Math.abs(a.top - b.top) > 12 ? a.top - b.top : a.left - b.left; })
      .map(function (o) { return o.el; });
  }
  function captionOf(el) {
    var fig = el.closest('figure');
    var fc = fig && fig.querySelector('figcaption');
    return fc ? fc.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  // largest rect with the photo's own aspect that fits between the close button and the bar
  function fitRect(el, withCaption) {
    var W = lb.clientWidth, H = lb.clientHeight, landscape = W > H && H < 500;
    var top = landscape ? 8 : 64, bottom = landscape ? 56 : (withCaption ? 132 : 88);
    var nw = el.naturalWidth || el.width || 4, nh = el.naturalHeight || el.height || 3;
    var s = Math.min(W / nw, (H - top - bottom) / nh);
    var w = nw * s, h = nh * s;
    return { w: w, h: h, x: (W - w) / 2, y: top + (H - top - bottom - h) / 2 };
  }
  function place(i) {
    var el = items[i], text = captionOf(el);
    var t = fitRect(el, !!text);
    img.src = el.currentSrc || el.src;
    img.alt = el.alt || '';
    img.style.width = t.w + 'px'; img.style.height = t.h + 'px';
    img.style.left = t.x + 'px'; img.style.top = t.y + 'px';
    cap.textContent = text;
    count.textContent = (i + 1) + ' / ' + items.length;
    btnP.disabled = items.length < 2; btnN.disabled = items.length < 2;
    fitted = t; idx = i;
    // warm the neighbours (lazy thumbnails further down the page may not have loaded yet)
    [i - 1, i + 1].forEach(function (n) { var e = items[(n + items.length) % items.length]; if (e && !e.complete) { var pre = new Image(); pre.src = e.currentSrc || e.src; } });
    return t;
  }
  function toThumb(i, t) {
    var f = items[i].getBoundingClientRect();
    return 'translate(' + (f.left - t.x) + 'px,' + (f.top - t.y) + 'px) scale(' + (f.width / t.w) + ',' + (f.height / t.h) + ')';
  }
  function setT(transform, opacity, transition) {
    img.style.transition = transition || 'none';
    img.style.transform = transform;
    if (opacity !== null && opacity !== undefined) img.style.opacity = opacity;
  }

  function open(el) {
    if (isOpen || busy) return;
    items = collect();
    var i = items.indexOf(el);
    if (i < 0) return;
    busy = true; isOpen = true;
    lastFocus = document.activeElement;
    lockY = window.scrollY;
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    var t = place(i);
    if (reduced) {
      setT('none', '0');
      requestAnimationFrame(function () { lb.classList.add('is-in'); setT('none', '1', 'opacity 0.25s ease-out'); });
    } else {
      setT(toThumb(i, t), '1');
      void img.offsetWidth;                                   // commit the start state
      requestAnimationFrame(function () { lb.classList.add('is-in'); setT('none', null, 'transform 0.6s ' + EXPO); });
    }
    // Popping this entry on close would make the browser restore the scroll position it saved for
    // it — undoing the "land on the photo you ended on" scroll. Own scroll restoration while open.
    try { prevRestoration = history.scrollRestoration; history.scrollRestoration = 'manual'; history.pushState({ plb: true }, ''); } catch (e) {}
    setTimeout(function () { busy = false; btnX.focus({ preventScroll: true }); }, reduced ? 260 : 380);
  }

  var closing = false;
  function close(fromPop) {
    if (!isOpen || busy || closing) return;
    busy = true; closing = true;
    // land on the photo you ended on: bring its thumbnail into view behind the scrim first
    document.documentElement.style.overflow = ''; document.body.style.overflow = '';
    var thumb = items[idx], r = thumb.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight - 20) window.scrollTo(0, Math.max(0, r.top + window.scrollY - (window.innerHeight - r.height) / 2));
    lb.classList.remove('is-in');
    if (reduced) setT('none', '0', 'opacity 0.25s ease-out');
    else { var t = fitted; requestAnimationFrame(function () { setT(toThumb(idx, t), null, 'transform 0.5s ' + EXPO); }); }
    setTimeout(function () {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      img.removeAttribute('src'); img.style.transform = 'none'; img.style.opacity = '1';
      scrim.style.opacity = '';
      isOpen = false; busy = false; closing = false;
      try { if (prevRestoration) history.scrollRestoration = prevRestoration; } catch (e) {}
      if (thumb && thumb.focus) thumb.focus({ preventScroll: true });
    }, reduced ? 260 : 520);
    if (!fromPop) { try { if (history.state && history.state.plb) history.back(); } catch (e) {} }
  }

  // step with a short directional slide: the old photo leaves toward the swipe, the new one arrives from the other side
  function step(d, fromX) {
    if (!isOpen || busy || items.length < 2) return;
    busy = true;
    var n = (idx + d + items.length) % items.length;
    var out = reduced ? 0 : -d * 56;
    setT('translateX(' + ((fromX || 0) + out) + 'px)', '0', 'transform 0.2s ease-in, opacity 0.2s ease-in');
    var go = function () {
      place(n);
      setT('translateX(' + (reduced ? 0 : d * 56) + 'px)', '0');
      void img.offsetWidth;
      setT('none', '1', 'transform 0.4s ' + EXPO + ', opacity 0.3s ease-out');
      setTimeout(function () { busy = false; }, 240);
    };
    var el = items[n], ready = false, run = function () { if (!ready) { ready = true; go(); } };
    setTimeout(function () {
      if (el.complete && el.naturalWidth) return run();
      var pre = new Image(); pre.onload = pre.onerror = run; pre.src = el.currentSrc || el.src;
      setTimeout(run, 1200);                                   // never hang on a slow photo
    }, 190);
  }

  // ── touch: the photo follows the finger ──
  var sx = 0, sy = 0, tracking = false, axis = null, st = 0;
  lb.addEventListener('touchstart', function (e) {
    if (busy || e.touches.length !== 1 || e.target.closest('.plb-btn')) { tracking = false; return; }
    tracking = true; axis = null; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  lb.addEventListener('touchmove', function (e) {
    if (!tracking) return;
    if (e.touches.length !== 1) { tracking = false; setT('none', '1', 'transform 0.3s ' + EXPO); scrim.style.opacity = ''; return; }
    var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if (!axis) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; }
    if (axis === 'x') setT('translateX(' + dx + 'px)', null);
    else if (dy > 0) { var k = Math.min(1, dy / 320); setT('translateY(' + dy + 'px) scale(' + (1 - k * 0.12) + ')', null); img.style.transformOrigin = '50% 50%'; scrim.style.opacity = String(1 - k * 0.7); }
  }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, fast = Date.now() - st < 260;
    img.style.transformOrigin = '0 0';
    if (axis === 'x' && (Math.abs(dx) > 64 || (fast && Math.abs(dx) > 28)) && items.length > 1) { step(dx < 0 ? 1 : -1, dx); return; }
    if (axis === 'y' && (dy > 96 || (fast && dy > 48))) { scrim.style.opacity = ''; setT('none', null); close(false); return; }
    scrim.style.opacity = '';
    if (axis) setT('none', '1', 'transform 0.35s ' + EXPO);
    else if (!e.target.closest('.plb-btn')) close(false);      // a plain tap on the photo or the scrim closes
  }, { passive: true });
  lb.addEventListener('touchcancel', function () { tracking = false; scrim.style.opacity = ''; setT('none', '1', 'transform 0.3s ' + EXPO); }, { passive: true });

  // mouse / keyboard (tablets with a keyboard, or a narrow desktop window)
  // (on touch screens the tap-to-close is handled in touchend above; the click that follows is ignored)
  lb.addEventListener('click', function (e) {
    if (e.target.closest('.plb-btn') || 'ontouchstart' in window) return;
    close(false);
  });
  btnX.addEventListener('click', function () { close(false); });
  btnP.addEventListener('click', function () { step(-1); });
  btnN.addEventListener('click', function () { step(1); });
  document.addEventListener('keydown', function (e) {
    if (!isOpen) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches(SELECTOR)) { e.preventDefault(); open(e.target); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Tab') { e.preventDefault(); var order = [btnP, btnN, btnX], at = order.indexOf(document.activeElement); order[(at + (e.shiftKey ? -1 : 1) + order.length) % order.length].focus(); }
  });
  // the phone's Back gesture closes the viewer (our own close() also pops this entry — hence the guard)
  window.addEventListener('popstate', function () { if (isOpen && !closing) { busy = false; close(true); } });
  window.addEventListener('resize', function () { if (isOpen && !busy) { setT('none', '1'); place(idx); } });

  // open on tap — delegated, so photos the page builds (or rebuilds on rotate) later are covered
  document.addEventListener('click', function (e) {
    if (isOpen) return;
    var el = e.target.closest && e.target.closest(SELECTOR);
    if (!el || !(el.currentSrc || el.getAttribute('src'))) return;
    if (e.target.closest('a, button')) return;
    e.preventDefault();
    open(el);
  });
  // announce them as buttons
  function decorate() {
    document.querySelectorAll(SELECTOR).forEach(function (el) {
      if (el.dataset.plb) return;
      el.dataset.plb = '1';
      el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.setAttribute('aria-label', 'Open photo' + (el.alt ? ': ' + el.alt : ''));
    });
  }
  decorate();
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
})();
