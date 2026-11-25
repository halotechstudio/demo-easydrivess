// Animated explainers: short looping illustrations that show how a feature works, in the Welno style.
// Motion is pure CSS (see fx.css .ex-*) and resumes from the live clock so repaints never restart it.
import { h, icon } from './kit.js';

const S = (w, hh, inner) => `<svg viewBox="0 0 ${w} ${hh}" width="100%" height="${hh}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">${inner}</svg>`;
const road = '<path d="M14 92 C 90 92, 120 40, 200 48 S 300 92, 330 86" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="10" stroke-linecap="round"/><path d="M14 92 C 90 92, 120 40, 200 48 S 300 92, 330 86" fill="none" stroke="#8F8CF2" stroke-width="2.5" stroke-dasharray="4 7" class="ex-dash"/>';

const ART = {
  // Smart batching: one car sweeps the route and collects riders who would otherwise take four cabs.
  pool: S(344, 120, `${road}
    ${[[60, 88], [118, 62], [178, 47], [246, 64]].map(([x, y], i) => `<g class="ex-rider ex-r${i}"><circle cx="${x}" cy="${y - 18}" r="7" fill="#E9E8FB"/><circle cx="${x}" cy="${y - 18}" r="13" fill="none" stroke="#E9E8FB" stroke-opacity=".35"/></g>`).join('')}
    <g class="ex-car"><rect x="-13" y="-9" width="26" height="18" rx="7" fill="#5EF2C6"/><path d="M-6 2l1.5-4h9L6 2v3H-6z" fill="#0B0B0F"/></g>
    <g transform="translate(330 86)"><circle r="16" fill="#6246EA" opacity=".35" class="ex-ping"/><circle r="8" fill="#fff"/></g>
    <text x="330" y="118" text-anchor="middle" fill="#A6A6B4" font-size="11" font-family="Urbanist">Office</text>`),

  // Scheduled: a booking card slides in, gets claimed, then the clock runs to pickup time.
  scheduled: S(344, 120, `
    <g class="ex-cal"><rect x="20" y="16" width="96" height="92" rx="16" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.2)"/><rect x="20" y="16" width="96" height="24" rx="12" fill="#6246EA"/>
      <text x="68" y="33" text-anchor="middle" fill="#fff" font-size="12" font-weight="600" font-family="Urbanist">TOMORROW</text>
      <text x="68" y="82" text-anchor="middle" fill="#E9E8FB" font-size="34" font-weight="300" font-family="Urbanist">6:30</text></g>
    <g class="ex-card"><rect x="136" y="26" width="188" height="70" rx="16" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.22)"/>
      <text x="152" y="50" fill="#fff" font-size="13" font-weight="600" font-family="Urbanist">Banjara Hills → RGIA</text>
      <text x="152" y="68" fill="#A6A6B4" font-size="11" font-family="Urbanist">Sedan · 31 km · you earn ₹640</text>
      <g class="ex-accept"><rect x="250" y="72" width="62" height="18" rx="9" fill="#E9E8FB"/><text x="281" y="85" text-anchor="middle" fill="#0B0B0F" font-size="10.5" font-weight="700" font-family="Urbanist">ACCEPTED</text></g></g>
    <g transform="translate(68 112)"><circle r="2" fill="#5EF2C6" class="ex-blink"/></g>`),

  // Shine Check: four photos are checked one after another and the condition score fills.
  shine: S(344, 120, `
    ${['Front', 'Seat', 'Boot', 'You'].map((t, i) => `<g transform="translate(${18 + i * 62} 22)"><rect width="52" height="64" rx="12" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.2)"/>
      <rect class="ex-scan ex-s${i}" x="4" y="6" width="44" height="2" rx="1" fill="#5EF2C6"/>
      <g class="ex-tick ex-t${i}"><circle cx="26" cy="32" r="12" fill="#5EF2C6"/><path d="M20 32l4 4 8-8" stroke="#0B0B0F" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>
      <text x="26" y="80" text-anchor="middle" fill="#A6A6B4" font-size="10.5" font-family="Urbanist">${t}</text></g>`).join('')}
    <g transform="translate(298 54)">${Array.from({ length: 24 }, (_, i) => { const a = (i / 24 * 360 - 90) * Math.PI / 180; return `<line x1="${Math.cos(a) * 22}" y1="${Math.sin(a) * 22}" x2="${Math.cos(a) * 30}" y2="${Math.sin(a) * 30}" stroke="#5EF2C6" stroke-width="2" stroke-linecap="round" class="ex-g" style="--i:${i}"/>`; }).join('')}
      <text y="6" text-anchor="middle" fill="#fff" font-size="17" font-weight="300" font-family="Urbanist">95</text></g>`),

  // WhatsApp: hi, a choice, a pin and a confirmed car arrive as chat bubbles.
  whatsapp: S(344, 132, `
    <g class="ex-b ex-b0"><rect x="250" y="6" width="74" height="24" rx="12" fill="#6246EA"/><text x="287" y="22" text-anchor="middle" fill="#fff" font-size="12" font-family="Urbanist">hi</text></g>
    <g class="ex-b ex-b1"><rect x="20" y="36" width="190" height="24" rx="12" fill="rgba(255,255,255,.1)"/><text x="32" y="52" fill="#E9E8FB" font-size="11.5" font-family="Urbanist">Where to? Airport · City · Intercity</text></g>
    <g class="ex-b ex-b2"><rect x="214" y="66" width="110" height="24" rx="12" fill="#6246EA"/><text x="230" y="82" fill="#fff" font-size="11.5" font-family="Urbanist">Pin · Jubilee Hills</text></g>
    <g class="ex-b ex-b3"><rect x="20" y="96" width="210" height="30" rx="14" fill="rgba(94,242,198,.14)" stroke="rgba(94,242,198,.5)"/><text x="34" y="115" fill="#5EF2C6" font-size="11.5" font-weight="600" font-family="Urbanist">Booked · Ravi · TS 09 EK 4471</text></g>`),

  // Fare: base fare is multiplied by car age and condition; the total settles.
  fare: S(344, 120, `
    ${[['Base', '₹198', '#E9E8FB'], ['× Age', '1.05', '#8F8CF2'], ['× Condition', '1.05', '#5EF2C6'], ['= Fare', '₹222', '#fff']].map(([k, v, col], i) => `<g class="ex-f ex-f${i}" transform="translate(${10 + i * 84} 22)"><rect width="74" height="64" rx="14" fill="rgba(255,255,255,${i === 3 ? '.12' : '.06'})" stroke="${i === 3 ? 'rgba(233,232,251,.6)' : 'rgba(255,255,255,.18)'}"/>
      <text x="37" y="26" text-anchor="middle" fill="#A6A6B4" font-size="10.5" font-family="Urbanist">${k}</text><text x="37" y="50" text-anchor="middle" fill="${col}" font-size="18" font-weight="${i === 3 ? 600 : 400}" font-family="Urbanist">${v}</text></g>`).join('')}
    <text x="172" y="108" text-anchor="middle" fill="#A6A6B4" font-size="11" font-family="Urbanist">Newer, cleaner cars earn a little more. Older ones cost less.</text>`),
};

const COPY = {
  pool: ['Smart batching', 'People on the same route share one car. The route and stop order are planned for you.'],
  scheduled: ['Claim rides ahead', 'Accept tomorrow\'s bookings now. They come to you 20 minutes before pickup, with a reminder at 30.'],
  shine: ['Shine Check in 40 seconds', 'Four photos, checked automatically. A high score earns you premium rides and better fares.'],
  whatsapp: ['Book without the app', 'Say hi, tap three choices, and the car is on its way. Pay by UPI link or to the driver.'],
  fare: ['How your fare is set', 'Distance and time, then the car\'s age and today\'s condition score. You never pay more than shown.'],
};

// A dismissible explainer card. `app.seenEx` remembers which were closed; a replay chip brings one back.
export function explainer(app, kind, { force = false } = {}) {
  app.seenEx ||= {};
  if (app.seenEx[kind] && !force) return h('button', { class: 'ex-replay', onclick: () => { app.seenEx[kind] = false; app.ui.dirty(); } }, icon('play', 12), `How it works · ${COPY[kind][0]}`);
  return h('div', { class: 'explain glass' },
    h('div', { class: 'ex-art', html: ART[kind] }),
    h('div', { class: 'flex between', style: { alignItems: 'flex-start', gap: '10px' } },
      h('div', null, h('b', null, COPY[kind][0]), h('p', null, COPY[kind][1])),
      !force && h('button', { class: 'iconbtn', 'aria-label': 'Close', style: { width: '30px', height: '30px', flex: 'none' }, onclick: () => { app.seenEx[kind] = true; app.ui.dirty(); } }, icon('close', 14))));
}
