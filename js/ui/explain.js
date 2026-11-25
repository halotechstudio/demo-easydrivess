// Animated explainers: short looping illustrations that show how a feature works, in the Welno style.
// Motion is pure CSS (see fx.css .ex-*) and resumes from the live clock so repaints never restart it.
import { h, icon, dotNumber, sentence } from './kit.js';

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

// Story heroes: the explainer uses the same anatomy as the live hero (label, glowing dot-matrix number,
// unit, one sentence with chips) and steps through the feature frame by frame. Pure CSS timing, phase-locked to --clock.
const STORY = {
  pool: { glow: '', frames: [['7', 'people booked', ['Seven colleagues, seven homes, ', { chip: 'one office' }, '.']], ['3', 'cars sent', ['Same-route riders share a car. ', { chip: 'Stops ordered' }, ' for you.']], ['₹617', 'saved', ['Against 7 separate cabs. Detour ', { chip: 'capped at 20%' }, '.']]] },
  scheduled: { glow: 'condition', frames: [['6:30', 'tomorrow', ['A booking opens for your ', { chip: 'Sedan' }, '.']], ['₹640', 'you earn', ['Tap accept and ', { chip: "it's yours" }, '. No one else can take it.']], ['30', 'min reminder', ['We nudge you, then send it ', { chip: '20 min before' }, '.']]] },
  shine: { glow: 'condition', frames: [['4', 'photos', ['Front, rear seat, boot, ', { chip: 'you in uniform' }, '.']], ['40', 'seconds', ['Checked automatically by ', { chip: 'Easydrivess Vision' }, '.']], ['95', 'condition', ['Score 90+ unlocks ', { chip: 'premium rides' }, ' and +5% fares.']]] },
  whatsapp: { glow: 'money', frames: [['0', 'apps to install', ['Riders just say ', { chip: 'hi' }, ' to Easydrivess on WhatsApp.']], ['4', 'taps', ['Trip type, pickup pin, destination, ', { chip: 'car' }, '.']], ['₹201', 'UPI link', ['Pay in chat or to the driver. ', { chip: 'Driver card' }, ' arrives with the OTP.']]] },
  fare: { glow: '', frames: [['₹198', 'base fare', ['Distance and time for a ', { chip: 'Sedan' }, '.']], ['1.05', 'car age', ['A 2024 car, ', { chip: 'under 2 years' }, ' old.']], ['1.05', 'condition', ['Cleaned this morning, score ', { chip: '93' }, '.']], ['₹222', 'your fare', ['Base × age × condition. ', { chip: 'Never more' }, ' than shown.']]] },
};
const TITLE = { pool: 'Smart batching', scheduled: 'Claim rides ahead', shine: 'Shine Check', whatsapp: 'Book without the app', fare: 'How your fare is set' };

function storyHero(kind) {
  const sp = STORY[kind]; const n = sp.frames.length; const slot = 2.8;
  return h('div', { class: `hero story ${sp.glow}`, style: `--n:${n};--dur:${n * slot}s` },
    h('div', { class: 'story-title' }, ledDots(n, slot), h('span', null, TITLE[kind])),
    h('div', { class: 'story-stack' }, sp.frames.map(([num, unit, sent], i) =>
      h('div', { class: 'story-frame', style: `--i:${i}` },
        h('div', { class: 'num-row' }, dotNumber(num, { size: 9, off: false, fit: 190 })),
        h('div', { class: 'num-label', style: { margin: '6px 0 0' } }, unit),
        sentence(sent)))));
}
function ledDots(n, slot) { return h('span', { class: 'story-leds' }, Array.from({ length: n }, (_, i) => h('i', { style: `--i:${i}` }))); }

// A dismissible explainer. `app.seenEx` remembers which were closed; a replay chip brings one back.
export function explainer(app, kind, { force = false } = {}) {
  app.seenEx ||= {};
  if (app.seenEx[kind] && !force) return h('button', { class: 'ex-replay', onclick: () => { app.seenEx[kind] = false; app.ui.dirty(); } }, icon('play', 12), `How it works · ${TITLE[kind]}`);
  return h('div', { class: 'explain-wrap' }, storyHero(kind),
    !force && h('button', { class: 'iconbtn ex-close', 'aria-label': 'Close', onclick: () => { app.seenEx[kind] = true; app.ui.dirty(); } }, icon('close', 14)));
}
// Animated icons for the rider's trip-type buttons. Each loops gently and hints at what it books.
const AI = {
  city: `<path d="M4 20V9l5-3v14M9 20V4h7v16M16 20v-9l4 2v7M3 20h18"/><g class="ai-win"><rect x="11.5" y="7" width="1.6" height="1.6" rx=".3"/><rect x="11.5" y="10.5" width="1.6" height="1.6" rx=".3"/><rect x="11.5" y="14" width="1.6" height="1.6" rx=".3"/><rect x="5.6" y="11" width="1.4" height="1.4" rx=".3"/><rect x="17.4" y="14" width="1.4" height="1.4" rx=".3"/></g>`,
  airport: `<path class="ai-trail" d="M2 19c4 0 7-2 9-5"/><g class="ai-plane"><path d="M10.5 13.5L4 11l1.5-1.5 7 1 3.5-4.5c.8-1 2.3-1.1 3-.3.8.7.7 2.2-.3 3l-4.5 3.5 1 7L13 21l-2.5-6.5-3 2.5.5 2.5-1.5 1-1.5-3-3-1.5 1-1.5 2.5.5z"/></g>`,
  intercity: `<circle cx="6" cy="17" r="2"/><circle cx="18" cy="7" r="2"/><path class="ai-road" d="M6 15V9a3 3 0 0 1 3-3h3M18 9v6a3 3 0 0 1-3 3h-3"/><circle class="ai-dot" r="1.6" fill="currentColor" stroke="none"/>`,
  schedule: `<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/><g class="ai-clock"><circle cx="12" cy="15" r="3.2"/><path class="ai-hand" d="M12 15v-2"/></g>`,
};
export function animIcon(kind) {
  return h('svg', { class: `ai ai-${kind}`, viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', html: AI[kind] });
}

// Rider home: a live feature carousel in the hero style. Each frame shows real data for one feature;
// tapping the card opens whichever feature is on screen at that moment (same clock as the CSS loop).
export const FEATURE_SLOT = 3.2; // seconds per frame
export function featureHero(frames, { glow = '' } = {}) {
  const n = frames.length; const dur = n * FEATURE_SLOT;
  const current = () => Math.floor((performance.now() / 1000 % dur) / FEATURE_SLOT) % n;
  return h('button', { class: `hero story feature ${glow}`, style: `--n:${n};--dur:${dur}s;width:100%;display:block;margin-bottom:10px`, 'aria-label': 'Featured: tap to open', onclick: () => frames[current()].go() },
    h('div', { class: 'story-stack' }, frames.map((f, i) =>
      h('div', { class: 'story-frame', style: `--i:${i}` },
        h('div', { class: 'num-label' }, f.label),
        h('div', { class: 'num-row' }, dotNumber(f.num, { size: 9.5, off: false, fit: 200 })),
        h('div', { class: 'num-label', style: { margin: '6px 0 0' } }, f.unit),
        sentence(f.sent)))),
    h('div', { class: 'story-title', style: { marginTop: '10px' } }, h('span', { class: 'story-leds' }, frames.map((_, i) => h('i', { style: `--i:${i}` })))));
}
