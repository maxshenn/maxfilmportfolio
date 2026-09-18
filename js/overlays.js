// ───────────────────────────────────────────────
//  Overlays module — Frames Panel + Portfolio Panel + Hint
//
//  - Frames Panel: full-viewport gallery that fades in when zooming
//    through the lens. Closes when scroll reverses past the portal.
//  - Portfolio Panel: right-side drawer triggered by clicking the
//    physical play/library button on the 3D camera. Has a close button.
//  - Hint text: small instructional copy shown during interactive phase.
// ───────────────────────────────────────────────

const VIDEO_BASE = 'https://pub-b51d12263d8f42f88396dcee385d6734.r2.dev/';

// Only R2 objects with Content-Type: video/mp4 are listed here. The
// per-clip frames (boom/brent/waterfall/spikeball/etc.) were uploaded
// without that header, so Chrome's Opaque Response Blocking refuses to
// hand them to the <video> tag. To restore them, re-upload via:
//   wrangler r2 object put <bucket>/<file> --file=<file> --content-type=video/mp4
const FRAME_GRID = [
  { src: 'frames2025.mp4',                  label: 'Frames 2025' },
  { src: 'take%20your%20time.mp4',          label: 'Grad Trip' },
  { src: 'toronto2026.mp4',                 label: 'Toronto, ON' },
  { src: 'notgoinghome2.mp4',               label: 'Marrakech' },
  { src: 'central%20park.mp4',              label: 'Central Park, NYC' },
  { src: 'lake%20cowichan.mp4',             label: 'Lake Cowichan, BC' },
  { src: 'ski%20trip%202026.mp4',           label: 'Whistler, BC' },
  { src: 'pursuit%20of%20authenticity.mp4', label: 'Capstone' },
];

const PORTFOLIO_ITEMS = [
  { title: 'Morocco 2026',    subtitle: 'Spring Break',           year: '2026' },
  { title: 'Frames 2025',     subtitle: 'Yearly Cut',             year: '2025' },
  { title: 'Daniel Caesar',   subtitle: 'Forest Hills, NYC',      year: '2025' },
  { title: 'Dolomites',       subtitle: 'Northern Italy',         year: '2024' },
  { title: 'Whistler',        subtitle: 'British Columbia',       year: '2024' },
];

let framesEl = null;
let portfolioEl = null;
let backdropEl = null;
let hintEl = null;
let portfolioOpenCloseCb = null;
let isPortfolioOpen = false;

// Helper for cleaner DOM construction
function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.cls) node.className = opts.cls;
  if (opts.id) node.id = opts.id;
  if (opts.text) node.textContent = opts.text;
  if (opts.attrs) for (const k in opts.attrs) node.setAttribute(k, opts.attrs[k]);
  if (opts.style) for (const k in opts.style) node.style[k] = opts.style[k];
  if (opts.kids) opts.kids.forEach(c => c && node.appendChild(c));
  return node;
}

export function initOverlays() {
  buildFramesPanel();
  buildPortfolioPanel();
  buildBackdrop();
  buildHint();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPortfolioOpen) closePortfolioPanel();
  });
}

// ───────────────────────────────────────────────
//  Frames Panel (lens portal destination)
// ───────────────────────────────────────────────
function buildFramesPanel() {
  const eyebrow = el('p', { cls: 'cs-fp-eyebrow', text: 'through the lens' });
  const titleEm = el('em', { text: 'frames' });
  const title = el('h2', { cls: 'cs-fp-title', kids: [titleEm] });
  const header = el('div', { cls: 'cs-fp-header', kids: [eyebrow, title] });

  const grid = el('div', { cls: 'cs-fp-grid' });
  FRAME_GRID.forEach((item, i) => {
    const v = el('video', {
      cls: 'cs-fp-video',
      attrs: { muted: '', playsinline: '', loop: '', preload: 'none' },
    });
    v.dataset.src = VIDEO_BASE + item.src;
    v.muted = true;

    const cap = el('p', { cls: 'cs-fp-label', text: item.label });

    const cell = el('div', {
      cls: 'cs-fp-cell',
      style: { transitionDelay: (60 + i * 35) + 'ms' },
      kids: [v, cap],
    });
    grid.appendChild(cell);
  });

  const inner = el('div', { cls: 'cs-fp-inner', kids: [header, grid] });
  framesEl = el('div', {
    id: 'framesOverlay',
    cls: 'cs-overlay cs-overlay--frames',
    attrs: { 'aria-hidden': 'true' },
    kids: [inner],
  });
  document.body.appendChild(framesEl);
}

export function showFramesOverlay() {
  if (!framesEl) return;
  framesEl.classList.add('visible');
  framesEl.setAttribute('aria-hidden', 'false');
  framesEl.querySelectorAll('.cs-fp-video').forEach((v) => {
    if (!v.querySelector('source') && v.dataset.src) {
      const source = document.createElement('source');
      source.src = v.dataset.src;
      source.type = 'video/mp4';
      v.appendChild(source);
      v.preload = 'metadata';
      v.load();
      v.play().catch(() => {});
    }
  });
}

export function hideFramesOverlay() {
  if (!framesEl) return;
  framesEl.classList.remove('visible');
  framesEl.setAttribute('aria-hidden', 'true');
}

// ───────────────────────────────────────────────
//  Portfolio Panel (play button drawer)
// ───────────────────────────────────────────────
function buildPortfolioPanel() {
  const eyebrow = el('p', { cls: 'cs-pp-eyebrow', text: 'library' });
  const title = el('h2', { cls: 'cs-pp-title', text: 'Portfolio' });
  const headerLeft = el('div', { kids: [eyebrow, title] });

  const closeBtn = el('button', {
    cls: 'cs-pp-close',
    attrs: { 'aria-label': 'Close portfolio' },
  });
  // SVG close icon
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.4');
  svg.setAttribute('stroke-linecap', 'round');
  const l1 = document.createElementNS(svgNS, 'line');
  l1.setAttribute('x1', '6'); l1.setAttribute('y1', '6');
  l1.setAttribute('x2', '18'); l1.setAttribute('y2', '18');
  const l2 = document.createElementNS(svgNS, 'line');
  l2.setAttribute('x1', '6'); l2.setAttribute('y1', '18');
  l2.setAttribute('x2', '18'); l2.setAttribute('y2', '6');
  svg.appendChild(l1); svg.appendChild(l2);
  closeBtn.appendChild(svg);
  closeBtn.addEventListener('click', closePortfolioPanel);

  const header = el('div', { cls: 'cs-pp-header', kids: [headerLeft, closeBtn] });

  const list = el('ul', { cls: 'cs-pp-list' });
  PORTFOLIO_ITEMS.forEach((item, i) => {
    const num = el('span', {
      cls: 'cs-pp-num',
      text: String(i + 1).padStart(2, '0'),
    });
    const name = el('h3', { cls: 'cs-pp-name', text: item.title });
    const sub = el('p', { cls: 'cs-pp-sub', text: `${item.subtitle} · ${item.year}` });
    const txt = el('div', { kids: [name, sub] });
    const meta = el('div', { cls: 'cs-pp-meta', kids: [num, txt] });
    const arrow = el('span', { cls: 'cs-pp-arrow', text: '→', attrs: { 'aria-hidden': 'true' } });
    const li = el('li', {
      cls: 'cs-pp-item',
      style: { transitionDelay: (140 + i * 60) + 'ms' },
      kids: [meta, arrow],
    });
    list.appendChild(li);
  });

  portfolioEl = el('aside', {
    id: 'portfolioPanel',
    cls: 'cs-overlay cs-overlay--portfolio',
    attrs: { 'aria-hidden': 'true', role: 'dialog', 'aria-label': 'Portfolio projects' },
    kids: [header, list],
  });
  document.body.appendChild(portfolioEl);
}

export function openPortfolioPanel() {
  if (!portfolioEl) return;
  isPortfolioOpen = true;
  portfolioEl.classList.add('visible');
  backdropEl.classList.add('visible');
  portfolioEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('cs-portfolio-open');
}

export function closePortfolioPanel() {
  if (!portfolioEl) return;
  isPortfolioOpen = false;
  portfolioEl.classList.remove('visible');
  backdropEl.classList.remove('visible');
  portfolioEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('cs-portfolio-open');
  if (portfolioOpenCloseCb) portfolioOpenCloseCb();
}

export function setOnPortfolioClose(fn) {
  portfolioOpenCloseCb = fn;
}

// ───────────────────────────────────────────────
//  Backdrop (used by portfolio panel)
// ───────────────────────────────────────────────
function buildBackdrop() {
  backdropEl = el('div', { cls: 'cs-overlay-backdrop' });
  backdropEl.addEventListener('click', closePortfolioPanel);
  document.body.appendChild(backdropEl);
}

// ───────────────────────────────────────────────
//  Hint text
// ───────────────────────────────────────────────
function buildHint() {
  hintEl = el('p', { id: 'csHint', cls: 'cs-hint' });
  document.body.appendChild(hintEl);
}

export function setHintText(text) {
  if (!hintEl) return;
  if (!text) {
    hintEl.classList.remove('visible');
    return;
  }
  hintEl.textContent = text;
  hintEl.classList.add('visible');
}
