import { h, icon } from '../ui/kit.js';
import { places, route, UNIT_KM, ROAD, minutesFor } from '../engine/geo.js';
import { conditionScore, classEligible } from '../engine/pricing.js';
import { carOf } from '../engine/rides.js';

// Small screen-router every app uses.
export function router(initial, params = {}) {
  const r = { screen: initial, params, stack: [] };
  r.go = (screen, p = {}) => { r.stack.push({ screen: r.screen, params: r.params }); r.screen = screen; r.params = p; r.dirty?.(); };
  r.back = () => { const prev = r.stack.pop(); if (prev) { r.screen = prev.screen; r.params = prev.params; } r.dirty?.(); };
  r.reset = (screen, p = {}) => { r.stack = []; r.screen = screen; r.params = p; r.dirty?.(); };
  return r;
}

export const ACTIVE = ['finding', 'arriving', 'arrived', 'onboard'];
export const placeName = id => places[id]?.name.split(' · ')[0] || id;
export const isNight = ms => { const d = new Date(ms + 5.5 * 3600e3).getUTCHours(); return d >= 22 || d < 6; };

// Nearest available eligible car ETA for a class from a place.
export function etaFor(s, cls, placeId) {
  const st = s.get(); const p = places[placeId];
  let best = null;
  for (const d of st.drivers) {
    if (!d.online || d.busy) continue;
    const car = carOf(s, d.id); if (!car || !classEligible(car, st.now).includes(cls)) continue;
    const km = Math.hypot(p.x - d.pos.x, p.y - d.pos.y) * UNIT_KM * ROAD;
    const m = Math.max(2, minutesFor(km) - 3);
    if (best == null || m < best) best = m;
  }
  return best;
}

export function driverCard(s, ride, { compact = false, onCall, onChat } = {}) {
  const st = s.get(); const d = st.drivers.find(x => x.id === ride.driverId); if (!d) return null;
  const car = carOf(s, d.id); const cs = conditionScore(car, st.now);
  return h('div', { class: 'card' },
    h('div', { class: 'flex' },
      h('div', { class: 'avatar lg violet' }, d.name.split(' ').map(w => w[0]).join('')),
      h('div', { class: 'grow' },
        h('div', { style: { fontWeight: 600, fontSize: '16px' } }, d.name),
        h('div', { class: 'small flex', style: { gap: '6px' } }, icon('star', 13), `${d.rating} · ${d.trips.toLocaleString('en-IN')} rides`, h('span', { class: 'pill good', style: { padding: '1px 7px', fontSize: '10px' } }, 'Verified'))),
      h('button', { class: 'iconbtn', 'aria-label': 'Message driver', onclick: onChat }, icon('chat')),
      h('button', { class: 'iconbtn', 'aria-label': 'Call driver', onclick: onCall, style: { background: 'linear-gradient(180deg,#7CF6D2,#3FD9AE)', color: 'var(--ink)' } }, icon('phone'))),
    h('div', { class: 'divider' }),
    h('div', { class: 'flex between' },
      h('div', null, h('div', { style: { fontSize: '14px', fontWeight: 500 } }, `${car.model}`), h('div', { class: 'label' }, `${car.color} · ${car.year}`)),
      h('span', { class: 'pill light', style: { fontSize: '12px', letterSpacing: '.04em' } }, car.plate)),
    !compact && h('div', { class: 'flex mt12', style: { gap: '12px', background: 'var(--s2)', borderRadius: '16px', padding: '10px 12px' } },
      conditionMini(cs.score),
      h('div', { class: 'grow' }, h('div', { style: { fontSize: '13.5px', fontWeight: 600 } }, 'Car condition'), h('div', { class: 'small' }, cs.sentence))));
}

export function conditionMini(score, size = 48) {
  const color = score >= 90 ? 'var(--aqua)' : score >= 75 ? 'var(--periwinkle)' : 'var(--ember)';
  const c = size / 2, r1 = c - 2, r2 = c - 7, n = 36, on = Math.round(n * score / 100);
  const lines = [];
  for (let i = 0; i < n; i++) { const a = (i / n * 360 - 90) * Math.PI / 180; lines.push(h('line', { x1: c + Math.cos(a) * r2, y1: c + Math.sin(a) * r2, x2: c + Math.cos(a) * r1, y2: c + Math.sin(a) * r1, stroke: i < on ? color : 'rgba(255,255,255,.12)', 'stroke-width': 1.6, 'stroke-linecap': 'round' })); }
  return h('div', { style: { position: 'relative', width: size + 'px', height: size + 'px', flex: 'none' } },
    h('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size }, lines),
    h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: (size / 3.3) + 'px', fontWeight: 600 } }, score));
}

export function stopList(s, ride, { me } = {}) {
  const st = s.get();
  const nm = id => st.riders.find(r => r.id === id)?.name.split(' ')[0] || 'Rider';
  const stops = ride.stops.length ? ride.stops : [
    { type: 'pickup', placeId: ride.pickup, riderIds: ride.riderIds, done: ['onboard', 'completed'].includes(ride.status) },
    { type: 'drop', placeId: ride.drop, riderIds: ride.riderIds, done: ride.status === 'completed' },
  ];
  const cur = stops.findIndex(x => !x.done);
  return h('div', { class: 'stops' }, stops.map((x, i) => h('div', { class: `stop ${x.done ? 'done' : ''} ${i === cur ? 'cur' : ''}` },
    h('span', { class: 'n' }, x.done ? icon('check', 12) : i + 1),
    h('div', null,
      h('div', { class: 't' }, `${x.type === 'pickup' ? 'Pick up' : 'Drop'} ${x.riderIds?.length > 1 ? x.riderIds.map(nm).join(', ') : nm(x.riderIds?.[0] || x.riderId)}`, me && (x.riderIds || []).includes(me) ? h('span', { class: 'pill violet', style: { marginLeft: '6px', fontSize: '9.5px', padding: '1px 6px' } }, 'You') : null),
      h('div', { class: 's' }, placeName(x.placeId))),
    h('div', { class: 'e' }, x.done ? (x.type === 'pickup' ? 'Picked up' : 'Dropped') : x.etaMin != null ? `+${x.etaMin} min` : ''))));
}

export function mapForRide(s, ride, { height = 190, carColor } = {}) {
  const st = s.get();
  const d = st.drivers.find(x => x.id === ride.driverId);
  const stops = ride.stops.length ? ride.stops.map(x => x.placeId) : [ride.pickup, ride.drop];
  const pts = stops.map(id => places[id]);
  const routes = [{ points: ride.points, tone: 'rides' }];
  if (ride.status === 'arriving' && ride.approach) routes.unshift({ points: ride.approach.points, tone: 'lav', dashed: true });
  const focus = [...pts, ...(d && ['arriving', 'arrived', 'onboard'].includes(ride.status) ? [d.pos] : [])];
  const pins = pts.map((p, i) => ({ x: p.x, y: p.y, n: ride.stops.length ? i + 1 : null, color: i === pts.length - 1 ? '#8F8CF2' : '#E9E8FB', label: i === 0 || i === pts.length - 1 ? placeName(stops[i]) : null }));
  return { pins, routes, focus, cars: d && ['arriving', 'arrived', 'onboard'].includes(ride.status) ? [{ ...d.pos, color: carColor || '#E9E8FB', ring: true }] : [], height };
}

export const greet = ms => { const hr = new Date(ms + 5.5 * 3600e3).getUTCHours(); return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'; };
export const km1 = n => (Math.round(n * 10) / 10).toFixed(1);
export { route };
