import { distanceKm, bearing, angleDiff, pathOf, minutesFor } from './geo.js';
import { quote, SEATS } from './pricing.js';
import { inr } from './store.js';

// Smart batching: fewest cars, then least km, inside every rider's detour limit.
// Spec §3.2: cluster by direction (±30°), seed with the farthest rider, cheapest insertion,
// merge cars while every constraint holds, smallest class that fits, night safety rule.
const SLACK_KM = 4; // Ruling: short trips allow up to 4 km extra, else 20% (spec says 20%).

function legKm(ids) { let k = 0; for (let i = 0; i < ids.length - 1; i++) k += distanceKm(ids[i], ids[i + 1]); return k; }

// A car's route for one hub: ends visited in `order`, hub last (in) or first (out).
function evaluate(order, hub, dir, maxDetour, night = false) {
  const ends = order.map(r => r.end);
  const seq = dir === 'in' ? [...ends, hub] : [hub, ...ends];
  const detours = order.map((r, i) => {
    const ride = dir === 'in' ? legKm([...ends.slice(i), hub]) : legKm([hub, ...ends.slice(0, i + 1)]);
    const direct = distanceKm(r.end, hub);
    const extra = ride - direct;
    return { riderId: r.id, ratio: direct ? ride / direct : 1, extra: Math.round(extra * 10) / 10, ok: extra <= Math.max(maxDetour * direct, SLACK_KM) + 1e-9 };
  });
  // Night rule as a validity condition: when a woman shares with a man, she is never the exposed stop.
  const mixed = night && order.some(r => r.gender === 'f') && order.some(r => r.gender === 'm');
  const exposed = dir === 'in' ? order[0] : order[order.length - 1];
  const nightOk = !mixed || exposed.gender !== 'f';
  return { km: legKm(seq), ok: nightOk && detours.every(d => d.ok), detours };
}

function bestInsert(order, r, hub, dir, maxDetour, night) {
  let best = null;
  for (let i = 0; i <= order.length; i++) {
    const cand = [...order.slice(0, i), r, ...order.slice(i)];
    const ev = evaluate(cand, hub, dir, maxDetour, night);
    if (ev.ok && (!best || ev.km < best.ev.km)) best = { order: cand, ev };
  }
  return best;
}

function planHub(riders, hub, dir, o) {
  const cap = o.allowSUV ? 6 : SEATS[o.minClass];
  // 1. Cluster by direction from the hub.
  const items = riders.map(r => ({ ...r, end: dir === 'in' ? r.pickup : r.drop }))
    .map(r => ({ ...r, b: bearing(hub, r.end), d: distanceKm(hub, r.end) }))
    .sort((a, b) => b.d - a.d);
  const clusters = [];
  for (const r of items) {
    const c = clusters.find(c => angleDiff(c.b, r.b) <= 30);
    if (c) c.items.push(r); else clusters.push({ b: r.b, items: [r] });
  }
  // 2. Seed with the farthest rider, then cheapest insertion.
  let cars = [];
  for (const c of clusters) {
    const local = [];
    for (const r of c.items) {
      let best = null;
      for (const car of local) {
        if (car.order.length >= cap) continue;
        const ins = bestInsert(car.order, r, hub, dir, o.maxDetour, o.night);
        if (ins && (!best || ins.ev.km - car.km < best.ins.ev.km - best.car.km)) best = { car, ins };
      }
      if (best) { best.car.order = best.ins.order; best.car.km = best.ins.ev.km; }
      else local.push({ order: [r], km: evaluate([r], hub, dir, o.maxDetour).km });
    }
    cars = cars.concat(local);
  }
  // 3. Merge cars while every rider stays inside the detour limit.
  let merged = true;
  while (merged) {
    merged = false;
    cars.sort((a, b) => a.order.length - b.order.length);
    outer: for (let i = 0; i < cars.length; i++) {
      for (let j = 0; j < cars.length; j++) {
        if (i === j || cars[i].order.length + cars[j].order.length > cap) continue;
        let order = cars[j].order;
        for (const r of cars[i].order) { const ins = bestInsert(order, r, hub, dir, o.maxDetour, o.night); if (!ins) { order = null; break; } order = ins.order; }
        if (order) {
          cars[j] = { order, km: evaluate(order, hub, dir, o.maxDetour, o.night).km };
          cars.splice(i, 1); merged = true; break outer;
        }
      }
    }
  }
  // 4. Night rule, then build stops.
  return cars.map(car => {
    const order = car.order;
    const ev = evaluate(order, hub, dir, o.maxDetour, o.night);

    const seq = dir === 'in' ? [...order.map(r => r.end), hub] : [hub, ...order.map(r => r.end)];
    const path = pathOf(seq);
    let t = 0; const stops = [];
    if (dir === 'out') stops.push({ type: 'pickup', riderIds: order.map(r => r.id), placeId: hub, etaMin: 0 });
    order.forEach((r, i) => {
      if (dir === 'in' && i > 0) t += path.legs[i - 1].min;
      if (dir === 'out') t += path.legs[i].min;
      stops.push({ type: dir === 'in' ? 'pickup' : 'drop', riderId: r.id, riderIds: [r.id], placeId: r.end, etaMin: t });
    });
    if (dir === 'in') stops.push({ type: 'drop', riderIds: order.map(r => r.id), placeId: hub, etaMin: path.min });
    const n = order.length;
    const cls = n > SEATS[o.minClass] ? 'SUV' : o.minClass;
    const cost = quote({ cls, km: path.km, min: path.min, trip: 'city', now: o.now, pricing: o.pricing }).fare;
    return { cls, riders: order.map(r => r.id), stops, km: path.km, min: path.min, points: path.points, cost, detours: ev.detours, nightRule: !!o.night };
  });
}

export function planBatch(riders, opts) {
  const o = { maxDetour: 0.2, minClass: 'Sedan', allowSUV: true, night: false, ...opts };
  if (!riders.length) return { cars: [], total: 0, separateCost: 0, saved: 0, sentence: 'Nobody selected.' };
  const drops = new Set(riders.map(r => r.drop)), pickups = new Set(riders.map(r => r.pickup));
  let cars = [];
  if (drops.size === 1) cars = planHub(riders, [...drops][0], 'in', o);
  else if (pickups.size === 1) cars = planHub(riders, [...pickups][0], 'out', o);
  else for (const d of drops) cars = cars.concat(planHub(riders.filter(r => r.drop === d), d, 'in', o));
  const total = cars.reduce((s, c) => s + c.cost, 0);
  const separateCost = riders.reduce((s, r) => {
    const km = distanceKm(r.pickup, r.drop);
    return s + quote({ cls: o.minClass, km, min: minutesFor(km), trip: 'city', now: o.now, pricing: o.pricing }).fare;
  }, 0);
  const saved = Math.max(0, separateCost - total);
  const n = riders.length;
  const sentence = `${n} ${n === 1 ? 'person' : 'people'}, ${cars.length} car${cars.length === 1 ? '' : 's'}.` + (saved > 0 ? ` ${inr(saved)} saved against ${n} separate cabs.` : '');
  return { cars, total, separateCost, saved, sentence, carsSaved: n - cars.length };
}
