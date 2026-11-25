// UI kit: element builder, icon set, dot-matrix numerals, tick gauge, map, shared widgets.
import { places, roads, placeList } from '../engine/geo.js';
import { inr } from '../engine/store.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'text', 'defs', 'radialGradient', 'linearGradient', 'stop', 'ellipse', 'filter', 'feGaussianBlur', 'pattern', 'clipPath', 'mask', 'use']);

export function h(tag, attrs, ...kids) {
  const svg = SVG_TAGS.has(tag);
  const el = svg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

// ---------- Icons: one stroke family, 1.6px, rounded ----------
const P = {
  back: 'M15 5l-7 7 7 7',
  more: '',
  close: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4',
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  work: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  plane: 'M10.5 13.5L4 11l1.5-1.5 7 1 3.5-4.5c.8-1 2.3-1.1 3-.3.8.7.7 2.2-.3 3l-4.5 3.5 1 7L13 21l-2.5-6.5-3 2.5.5 2.5-1.5 1-1.5-3-3-1.5 1-1.5 2.5.5z',
  city: 'M4 20V9l5-3v14M9 20V4h7v16M16 20v-9l4 2v7M3 20h18M12 8h1M12 11h1M12 14h1',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a3 3 0 0 1 3-3h3M18 9v6a3 3 0 0 1-3 3h-3',
  clock: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 8v4l3 2',
  repeat: 'M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7V6a2 2 0 0 1 2-2h10v3M16 13h1.5',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  shieldcheck: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4',
  star: 'M12 4l2.4 5 5.3.6-4 3.7 1.1 5.3L12 16l-4.8 2.6 1.1-5.3-4-3.7 5.3-.6z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM5 20c1-3.5 4-5 7-5s6 1.5 7 5',
  users: 'M9 5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5M16 5.5a3 3 0 0 1 0 6M18 14.5c1.6.6 2.6 2 3 4',
  hotel: 'M4 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14M16 10h2a2 2 0 0 1 2 2v8M3 20h18M8 8h1M11 8h1M8 12h1M11 12h1M9 20v-4h2v4',
  chat: 'M5 18l-1 3 3.5-1.5A8 8 0 1 0 4 12c0 1.6.4 3 1 4.2z',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  settings: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19 12l2-1-1-3-2.2.3-1.3-1.3L16.8 5 14 4l-1 2h-2L10 4l-2.8 1 .3 2.2L6.2 8.5 4 8.2 3 11l2 1v0l-2 1 1 3 2.2-.3 1.3 1.3L7.2 20l2.8 1 1-2h2l1 2 2.8-1-.3-2.2 1.3-1.3 2.2.3 1-3z',
  ad: 'M4 9v6h3l6 4V5L7 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  car: 'M5 16v3M19 16v3M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5L21 13v4H3zM3 13h18M7 14.5h1M16 14.5h1',
  sos: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 8v5M12 16v.5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  phone: 'M6 4h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z',
  share: 'M12 4v11M7 9l5-5 5 5M5 14v5h14v-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  sparkle: 'M12 4v4M12 16v4M4 12h4M16 12h4M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2',
  thumbup: 'M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2 3l-1 3h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7',
  thumbdown: 'M7 13V4H4v9zM7 13l4 7c1.5 0 2.5-1 2-3l-1-3h6a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 16.8 4H7',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  power: 'M12 3v8M6.5 6.5a8 8 0 1 0 11 0',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
  nav: 'M12 3l7 18-7-4-7 4z',
  layers: 'M12 4l9 5-9 5-9-5zM3 14l9 5 9-5',
  money: 'M4 7h16v10H4zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7 12h.5M16.5 12h.5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  swap: 'M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  seat: 'M7 4h5v9h6v4H7zM7 17v3M17 17v3',
  bag: 'M5 8h14v12H5zM9 8V5h6v3',
  play: 'M7 5l12 7-12 7z',
  pause: 'M8 5v14M16 5v14',
  reset: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};
export function icon(name, size) {
  if (name === 'more') return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'currentColor' }, h('circle', { cx: 12, cy: 5.5, r: 1.6 }), h('circle', { cx: 12, cy: 12, r: 1.6 }), h('circle', { cx: 12, cy: 18.5, r: 1.6 }));
  return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, h('path', { d: P[name] || P.sparkle }));
}

// Car silhouettes per class (side view), drawn in one stroke weight.
const CAR = {
  Hatchback: 'M6 26h4M42 26h5M10 26a4 4 0 1 0 8 0 4 4 0 0 0-8 0M34 26a4 4 0 1 0 8 0 4 4 0 0 0-8 0M18 26h16M5 26v-6l4-2 7-7h17l8 7 6 1.5V26',
  Sedan: 'M3 26h5M44 26h6M8 26a4 4 0 1 0 8 0 4 4 0 0 0-8 0M36 26a4 4 0 1 0 8 0 4 4 0 0 0-8 0M16 26h20M3 26v-5l6-2 7-7h15l8 7 9 1.5V26',
  SUV: 'M3 26h5M44 26h6M8 26a4 4 0 1 0 8 0 4 4 0 0 0-8 0M36 26a4 4 0 1 0 8 0 4 4 0 0 0-8 0M16 26h20M3 26v-8l4-1 4-8h26l6 8 7 1.5V26',
  Luxury: 'M2 26h6M45 26h6M8 26a4 4 0 1 0 8 0 4 4 0 0 0-8 0M37 26a4 4 0 1 0 8 0 4 4 0 0 0-8 0M16 26h21M2 26v-4l7-2.5 8-6.5h14l9 6.5 11 2V26',
};
export const carArt = cls => h('svg', { viewBox: '0 0 53 34', class: 'car', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h('path', { d: CAR[cls] }));

// Easydrivess mark: a stencil-cut E built on the Welno mark's construction (placeholder until the client's logo).
export function mark(variant = 'violet') {
  const bg = { violet: '#6246EA', dark: '#15151B', light: '#E9E8FB' }[variant];
  const fg = variant === 'light' ? '#0B0B0F' : '#fff';
  return h('svg', { viewBox: '0 0 32 32' },
    h('rect', { width: 32, height: 32, rx: 9, fill: bg }),
    h('path', { d: 'M9 8h13v4H13.5v2.2H20v3.6h-6.5V20H22v4H9z', fill: fg }),
    h('rect', { x: 9, y: 15.2, width: 4.5, height: 1.6, fill: bg }));
}

// ---------- Dot-matrix numerals (5×7) ----------
const GLYPH = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['0', '0', '1', '0', '1', '0', '0'],
  '.': ['0', '0', '0', '0', '0', '0', '1'],
  ',': ['0', '0', '0', '0', '0', '1', '1'],
  '-': ['000', '000', '000', '111', '000', '000', '000'],
  '+': ['000', '000', '010', '111', '010', '000', '000'],
  '₹': ['11111', '00010', '11111', '00010', '11100', '00110', '00011'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  ' ': ['00', '00', '00', '00', '00', '00', '00'],
};
export function dotNumber(value, { size = 7, gap = 2.2, color, dim = false, ghost = false, off = true, fit = 270 } = {}) {
  const chars = String(value).split('');
  const pitch = size + gap;
  let x = 0; const dots = [];
  for (const ch of chars) {
    const g = GLYPH[ch] || GLYPH[' '];
    const w = g[0].length;
    g.forEach((row, ry) => row.split('').forEach((b, rx) => {
      if (b === '1' || off) dots.push(h('circle', { cx: x + rx * pitch + size / 2, cy: ry * pitch + size / 2, r: size / 2 - .3, class: b === '1' ? '' : 'off', style: b === '1' && color ? { fill: color } : null }));
    }));
    x += w * pitch + pitch * (ch === ':' || ch === '.' || ch === ',' ? .4 : 1);
  }
  const W = x - pitch * .9, H = 7 * pitch - gap;
  const k = W > fit ? fit / W : 1;
  return h('svg', { class: `dm${ghost ? ' ghostnum' : ''}`, viewBox: `0 0 ${W} ${H}`, width: W * k, height: H * k, role: 'img', 'aria-label': String(value), style: dim ? { opacity: .5 } : null }, dots);
}
// Score with faded neighbours either side, like the Welno sleep score.
export function scrollNumber(main, neighbours = [], opts = {}) {
  const s = opts.size || 9;
  const [l2, l1, r1, r2] = neighbours;
  // Neighbours shrink so the whole row stays inside a phone card.
  const long = String(main).length > 3;
  const fitMain = long ? 150 : 200, fitSide = long ? 52 : 64;
  return h('div', { class: 'num-row', style: { overflow: 'hidden' } },
    !long && l2 != null && h('div', { class: 'ghostnum far' }, dotNumber(l2, { size: s * .45, off: false, fit: 46 })),
    l1 != null && h('div', { class: 'ghostnum' }, dotNumber(l1, { size: s * .55, off: false, fit: fitSide })),
    dotNumber(main, { size: s, off: false, fit: fitMain }),
    r1 != null && h('div', { class: 'ghostnum' }, dotNumber(r1, { size: s * .55, off: false, fit: fitSide })),
    !long && r2 != null && h('div', { class: 'ghostnum far' }, dotNumber(r2, { size: s * .45, off: false, fit: 46 })));
}

// ---------- Radial tick gauge ----------
export function tickGauge(value, { size = 150, ticks = 64, color = 'var(--aqua)', inner, label, sub, startDeg = 0, sweep = 360 } = {}) {
  const c = size / 2, r1 = c - 4, r2 = c - (size > 120 ? 16 : 11);
  const on = Math.round(ticks * Math.max(0, Math.min(100, value)) / 100);
  const lines = [];
  for (let i = 0; i < ticks; i++) {
    const a = (startDeg + sweep * i / ticks - 90) * Math.PI / 180;
    const lit = i < on;
    const fade = lit ? .45 + .55 * (i / Math.max(1, on)) : 1;
    lines.push(h('line', { x1: c + Math.cos(a) * r2, y1: c + Math.sin(a) * r2, x2: c + Math.cos(a) * r1, y2: c + Math.sin(a) * r1, stroke: lit ? color : 'rgba(255,255,255,.12)', 'stroke-width': size > 120 ? 2.2 : 1.8, 'stroke-linecap': 'round', opacity: lit ? fade : 1 }));
  }
  return h('div', { style: { position: 'relative', width: size + 'px', height: size + 'px', flex: 'none' } },
    h('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size }, lines),
    h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' } },
      inner ?? h('div', { style: { fontSize: size > 120 ? '34px' : '20px', fontWeight: 300, letterSpacing: '-.02em', lineHeight: 1 } }, Math.round(value)),
      label && h('div', { style: { fontSize: size > 120 ? '12.5px' : '10.5px', color: 'var(--fg-2)', marginTop: '4px' } }, label),
      sub && h('div', { style: { marginTop: '6px' } }, sub)));
}
export function ticksBar(score, n = 20) {
  const tone = score >= 90 ? '' : score >= 75 ? 'ok' : 'low';
  return h('div', { class: `ticks-bar ${tone}` }, Array.from({ length: n }, (_, i) => h('i', { class: i < Math.round(score / 100 * n) ? 'on' : '' })));
}

// Countdown ring
export function ring(fraction, { size = 56, stroke = 3, color = 'var(--lavender)', label } = {}) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return h('div', { style: { position: 'relative', width: size + 'px', height: size + 'px' } },
    h('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'ring' },
      h('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'rgba(255,255,255,.12)', 'stroke-width': stroke }),
      h('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: color, 'stroke-width': stroke, 'stroke-dasharray': C, 'stroke-dashoffset': C * (1 - fraction), 'stroke-linecap': 'round' })),
    label != null && h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: (size / 3.2) + 'px' } }, label));
}

// ---------- Map ----------
const routeColor = { rides: '#8F8CF2', aqua: '#5EF2C6', ember: '#FF5A45', lav: '#E9E8FB' };
export function map({ height = 200, routes = [], cars = [], pins = [], focus, labels = true, allPlaces = false, onCar } = {}) {
  // Viewbox: fit focus points with padding, or the whole city.
  let pts = focus?.length ? focus : [{ x: 60, y: 80 }, { x: 900, y: 690 }];
  let minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
  let minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const pad = 70; minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  let w = maxX - minX, hgt = maxY - minY;
  const aspect = 2.1; // width/height of the container varies; keep a wide-ish frame
  if (w / hgt < aspect) { const nw = hgt * aspect; minX -= (nw - w) / 2; w = nw; } else { const nh = w / aspect; minY -= (nh - hgt) / 2; hgt = nh; }
  const grid = [];
  for (let x = Math.floor(minX / 40) * 40; x < minX + w; x += 40) grid.push(h('line', { x1: x, y1: minY, x2: x, y2: minY + hgt }));
  for (let y = Math.floor(minY / 40) * 40; y < minY + hgt; y += 40) grid.push(h('line', { x1: minX, y1: y, x2: minX + w, y2: y }));
  const poly = ps => ps.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const svg = h('svg', { viewBox: `${minX} ${minY} ${w} ${hgt}`, preserveAspectRatio: 'xMidYMid slice' },
    h('g', { class: 'grid' }, grid),
    roads.map(r => h('polyline', { class: 'road', points: poly(r) })),
    (allPlaces || labels) && placeList.filter(p => p.kind !== 'city' && (allPlaces || !focus || (p.x > minX && p.x < minX + w && p.y > minY && p.y < minY + hgt))).map(p =>
      h('g', { class: 'place' }, h('circle', { cx: p.x, cy: p.y, r: 3 }), labels && h('text', { x: p.x + 7, y: p.y + 4 }, p.name.split(' · ')[0]))),
    routes.map(rt => [
      h('polyline', { class: 'route-glow', points: poly(rt.points), stroke: routeColor[rt.tone || 'rides'] }),
      h('polyline', { class: 'route', points: poly(rt.points), stroke: routeColor[rt.tone || 'rides'], 'stroke-dasharray': rt.dashed ? '2 8' : null, opacity: rt.dim ? .45 : 1 }),
    ]),
    pins.map(p => h('g', null,
      h('circle', { cx: p.x, cy: p.y, r: p.big ? 11 : 8, fill: p.color || '#E9E8FB', stroke: '#0E0E13', 'stroke-width': 3 }),
      p.n != null && h('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#0B0B0F', 'font-family': 'Urbanist' }, p.n),
      p.label && h('text', { class: 'pin-label', x: p.x, y: p.y - 16, 'text-anchor': 'middle' }, p.label))),
    cars.map(c => h('g', { transform: `translate(${c.x},${c.y})`, style: onCar ? { cursor: 'pointer' } : null, onclick: onCar ? () => onCar(c) : null },
      c.ring && h('circle', { r: 20, fill: c.color || '#6246EA', opacity: .22 }),
      h('rect', { x: -10, y: -10, width: 20, height: 20, rx: 7, fill: c.color || '#E9E8FB', stroke: '#0E0E13', 'stroke-width': 2.5 }),
      h('path', { d: 'M-5 2l1.3-3.6A1.5 1.5 0 0 1-2.3-2.6h4.6A1.5 1.5 0 0 1 3.7-1.6L5 2v2.5h-10z', fill: '#0B0B0F' }),
      c.label && h('text', { class: 'pin-label', y: -18, 'text-anchor': 'middle', style: { fontSize: '13px' } }, c.label))));
  return h('div', { class: 'map', style: { height: typeof height === 'number' ? height + 'px' : height } }, svg);
}
export const P_ = id => places[id];

// ---------- Shared widgets ----------
export const pill = (text, tone = '') => h('span', { class: `pill ${tone}` }, text);
export const chip = text => h('span', { class: 'chip' }, text);
export function sentence(parts) {
  // parts: strings and {chip:'TEXT'} objects
  return h('p', { class: 'sentence' }, parts.map(p => (typeof p === 'string' ? p : chip(p.chip))));
}
export function topbar(title, { back, menu, right } = {}) {
  return h('div', { class: 'topbar' },
    back ? h('button', { class: 'iconbtn', 'aria-label': 'Back', onclick: back }, icon('back')) : h('span'),
    h('h1', null, title),
    right || (menu !== false ? h('button', { class: 'iconbtn', 'aria-label': 'More', onclick: menu || null }, icon('more')) : h('span')));
}
export function tile(k, v, unit, extra) { return h('div', { class: 'tile' }, h('div', { class: 'v' }, v, unit && h('small', null, unit)), h('div', { class: 'k' }, k), extra); }
export function adCard(ad, onClick) {
  if (!ad) return null;
  return h('div', { class: `ad ${ad.tone}` }, h('span', { class: 'tag' }, `Ad · ${ad.advertiser}`), h('div', { class: 'tt' }, ad.title), h('div', { class: 'ss' }, ad.sub), h('button', { class: 'cta', onclick: onClick }, ad.cta));
}
export const initials = name => name.replace(/^(Mr\.|Ms\.|Dr\.|Mrs\.)\s*/, '').split(/[\s&]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export function btn(label, { kind = 'primary', onClick, arrow = false, block = true, disabled = false, sm = false, ic } = {}) {
  return h('button', { class: `btn ${kind}${block ? ' block' : ''}${arrow ? ' has-arrow' : ''}${sm ? ' sm' : ''}`, onclick: onClick, disabled },
    ic && icon(ic, 18), h('span', null, label), arrow && h('span', { class: 'arrow' }, icon('arrow', 16)));
}
export function swipe(label, onDone) {
  const knob = h('div', { class: 'knob', role: 'button', 'aria-label': label, tabindex: 0 }, icon('arrow'));
  const el = h('div', { class: 'swipe' }, h('span', null, label), knob);
  let start = null, max = 0;
  const end = ok => { if (start == null) return; start = null; el.classList.remove('dragging'); if (ok) onDone(); else knob.style.transform = ''; knob.style.transition = 'transform .3s var(--ease)'; };
  knob.addEventListener('pointerdown', e => { start = e.clientX; el.classList.add('dragging'); max = el.clientWidth - 62; knob.setPointerCapture(e.pointerId); knob.style.transition = 'none'; });
  knob.addEventListener('pointermove', e => { if (start == null) return; const scale = el.getBoundingClientRect().width / el.clientWidth || 1; const dx = Math.max(0, Math.min(max, (e.clientX - start) / scale)); knob.style.transform = `translateX(${dx}px)`; if (dx >= max * .9) end(true); });
  knob.addEventListener('pointerup', () => end(false));
  knob.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onDone(); });
  knob.addEventListener('dblclick', onDone);
  return el;
}
export { inr };
