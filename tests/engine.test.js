import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/engine/store.js';
import { places, distanceKm, route } from '../js/engine/geo.js';
import { seed } from '../js/engine/seed.js';
import { conditionScore, quote, classEligible, DAY } from '../js/engine/pricing.js';
import { planBatch } from '../js/engine/batching.js';
import { bookRide, tick, acceptOffer } from '../js/engine/rides.js';
import { topUp, charge, requestPayout, approvePayouts } from '../js/engine/wallet.js';
import { pickAd, recordImpression } from '../js/engine/ads.js';
import { waHandle } from '../js/engine/whatsapp.js';

const fresh = () => { const s = createStore(); seed(s); return s; };

test('store notifies subscribers', () => {
  const s = createStore(); let hit = 0;
  s.on('x', () => hit++); s.on('*', () => hit++);
  s.dispatch('x'); assert.equal(hit, 2);
});

test('RGIA to HITEC City is a realistic distance', () => {
  const d = distanceKm(places.rgia, places.hitec);
  assert.ok(d >= 28 && d <= 36, `got ${d}`);
  assert.ok(route('rgia', 'hitec').min > 30);
});

test('condition score combines parts and decays when Shine Check is skipped', () => {
  const now = Date.UTC(2026, 10, 25, 9);
  const car = { year: 2024, shine: { score: 96, at: now - 3600e3, attire: true }, feedback: 92, fitness: 95, onboard: 94 };
  const a = conditionScore(car, now);
  assert.ok(a.score >= 90, `got ${a.score}`);
  assert.match(a.sentence, /Cleaned this morning/);
  const b = conditionScore(car, now + 3 * DAY);
  assert.ok(b.score < a.score - 10);
  assert.ok(classEligible({ ...car, cls: 'Luxury' }, now).includes('Luxury'));
  assert.ok(!classEligible({ ...car, cls: 'Luxury' }, now + 3 * DAY).includes('Luxury'));
});

test('quote applies age, condition, demand cap and explains itself', () => {
  const s = fresh(); const now = Date.UTC(2026, 10, 25, 9);
  const newCar = { year: 2025, shine: { score: 98, at: now, attire: true }, feedback: 95, fitness: 96, onboard: 95 };
  const oldCar = { year: 2019, shine: { score: 55, at: now, attire: false }, feedback: 70, fitness: 70, onboard: 76 };
  const base = { cls: 'Sedan', km: 20, min: 40, trip: 'city', demand: 1, now, pricing: s.get().pricing };
  const q1 = quote({ ...base, car: newCar });
  const q2 = quote({ ...base, car: oldCar });
  assert.equal(q1.parts.age, 1.05); assert.equal(q1.parts.condition, 1.05);
  assert.equal(q2.parts.age, 0.95); assert.equal(q2.parts.condition, 0.92);
  assert.ok(q1.fare > q2.fare);
  assert.match(q1.sentence, /2025 Sedan/);
  const q3 = quote({ ...base, car: newCar, demand: 3 });
  assert.equal(q3.parts.demand, s.get().pricing.surgeCap);
  const q4 = quote({ ...base, car: newCar, trip: 'airport' });
  assert.ok(q4.fare > q1.fare); assert.match(q4.sentence, /airport/);
});

test('planBatch puts 7 colleagues into at most 3 cars and saves money', () => {
  const s = fresh();
  const team = s.get().riders.filter(r => r.company === 'orbit').slice(0, 7);
  const plan = planBatch(team.map(r => ({ id: r.id, pickup: r.home, drop: 'orbit', gender: r.gender })), { pricing: s.get().pricing, now: s.get().now });
  assert.ok(plan.cars.length <= 3, `cars ${plan.cars.length}`);
  assert.ok(plan.saved > 0);
  for (const c of plan.cars) {
    const seats = { Hatchback: 4, Sedan: 4, SUV: 6, Luxury: 4 }[c.cls];
    assert.ok(c.riders.length <= seats);
  }
  assert.match(plan.sentence, /7 people, \d cars?/);
});

test('planBatch never mixes opposite directions and respects detour', () => {
  const s = fresh();
  const rs = [
    { id: 'a', pickup: 'miyapur', drop: 'banjara' }, { id: 'b', pickup: 'kukatpally', drop: 'banjara' },
    { id: 'c', pickup: 'lbnagar', drop: 'banjara' }, { id: 'd', pickup: 'uppal', drop: 'banjara' },
    { id: 'e', pickup: 'kokapet', drop: 'banjara' }, { id: 'f', pickup: 'gandipet', drop: 'banjara' },
    { id: 'g', pickup: 'attapur', drop: 'banjara' }, { id: 'h', pickup: 'secunderabad', drop: 'banjara' },
  ];
  const plan = planBatch(rs, { pricing: s.get().pricing, now: s.get().now });
  const west = new Set(['kokapet', 'gandipet']); const east = new Set(['lbnagar', 'uppal']);
  for (const c of plan.cars) {
    const ps = c.riders.map(id => rs.find(r => r.id === id).pickup);
    assert.ok(!(ps.some(p => west.has(p)) && ps.some(p => east.has(p))), 'mixed directions');
    for (const d of c.detours) assert.ok(d.ok, `detour ${d.ratio}`);
  }
  assert.equal(plan.cars.reduce((n, c) => n + c.riders.length, 0), 8);
});

test('night rule: a woman is not the first pickup when sharing with a man', () => {
  const s = fresh();
  const rs = [
    { id: 'w', pickup: 'kondapur', drop: 'orbit', gender: 'f' },
    { id: 'm', pickup: 'madhapur', drop: 'orbit', gender: 'm' },
  ];
  const plan = planBatch(rs, { pricing: s.get().pricing, now: s.get().now, night: true });
  const car = plan.cars.find(c => c.riders.length === 2);
  if (car) assert.equal(car.stops[0].riderId, 'm');
});

test('ride waits in finding when no driver is online, then dispatches', () => {
  const s = fresh();
  s.get().drivers.forEach(d => { d.online = false; });
  const id = bookRide(s, { riderId: s.get().riders[0].id, pickup: 'jubilee', drop: 'hitec', cls: 'Sedan', trip: 'city', channel: 'app' });
  tick(s, 5000);
  assert.equal(s.get().rides.find(r => r.id === id).status, 'finding');
  s.get().drivers.forEach(d => { d.online = true; });
  tick(s, 1000);
  const ride = s.get().rides.find(r => r.id === id);
  assert.ok(ride.offer, 'offer made');
});

test('a driver is never offered two rides at once', () => {
  const s = fresh();
  s.get().drivers.forEach((d, i) => { d.online = i === 0; });
  const r1 = bookRide(s, { riderId: 'r1', pickup: 'jubilee', drop: 'hitec', cls: 'Sedan', trip: 'city', channel: 'app' });
  const r2 = bookRide(s, { riderId: 'r2', pickup: 'jubilee', drop: 'hitec', cls: 'Sedan', trip: 'city', channel: 'app' });
  s.get().drivers[0].auto = false;
  tick(s, 1000);
  const offers = s.get().rides.filter(r => [r1, r2].includes(r.id) && r.offer).length;
  assert.ok(offers <= 1);
});

test('full ride completes and pays the driver', () => {
  const s = fresh();
  const id = bookRide(s, { riderId: 'r1', pickup: 'jubilee', drop: 'hitec', cls: 'Sedan', trip: 'city', channel: 'app' });
  for (let i = 0; i < 400; i++) tick(s, 15000);
  const ride = s.get().rides.find(r => r.id === id);
  assert.equal(ride.status, 'completed');
  const d = s.get().drivers.find(x => x.id === ride.driverId);
  assert.ok(d.wallet > 0);
});

test('wallet blocks a charge it cannot cover, with no ledger entry', () => {
  const s = fresh();
  const w = s.get().wallets.orbit; w.balance = 100;
  const before = s.get().ledger.length;
  assert.equal(charge(s, 'orbit', 500, 'x'), 'insufficient');
  assert.equal(s.get().ledger.length, before);
  topUp(s, 'orbit', 1000);
  assert.equal(charge(s, 'orbit', 500, 'x'), 'ok');
  assert.equal(s.get().wallets.orbit.balance, 600);
});

test('payouts auto-approve small requests and approve all on request', () => {
  const s = fresh();
  const d = s.get().drivers[0]; d.wallet = 5000;
  const small = requestPayout(s, d.id, 1500);
  const big = requestPayout(s, d.id, 3000);
  assert.equal(s.get().payouts.find(p => p.id === small).status, 'paid');
  assert.equal(s.get().payouts.find(p => p.id === big).status, 'requested');
  approvePayouts(s, 'all');
  assert.equal(s.get().payouts.find(p => p.id === big).status, 'paid');
});

test('ads never show on safety or payment screens and cap at 3 a day', () => {
  const s = fresh();
  assert.equal(pickAd(s, 'sos', 'r1'), null);
  assert.equal(pickAd(s, 'payment', 'r1'), null);
  const seen = {};
  for (let i = 0; i < 12; i++) { const ad = pickAd(s, 'rider-home', 'r1'); if (!ad) break; recordImpression(s, ad.id, 'r1'); seen[ad.id] = (seen[ad.id] || 0) + 1; }
  for (const n of Object.values(seen)) assert.ok(n <= 3);
});

test('rider never pays more than the quoted fare', () => {
  const s = fresh();
  const id = bookRide(s, { riderId: 'r1', pickup: 'jubilee', drop: 'hitec', cls: 'Sedan', trip: 'city', channel: 'app', fare: 150, quoted: true });
  for (let i = 0; i < 10; i++) tick(s, 2000);
  const r = s.get().rides.find(x => x.id === id);
  assert.ok(r.driverId, 'assigned');
  assert.ok(r.fare <= 150);
});

test('a Sedan ride goes to a Sedan before a Luxury car', () => {
  const s = fresh();
  const id = bookRide(s, { riderId: 'r1', pickup: 'jubilee', drop: 'rgia', cls: 'Sedan', trip: 'airport', channel: 'app' });
  tick(s, 1000);
  const r = s.get().rides.find(x => x.id === id);
  const car = s.get().cars.find(c => c.id === s.get().drivers.find(d => d.id === r.offer.driverId).carId);
  assert.equal(car.cls, 'Sedan');
});

test('more riders than one car holds are split into valid cars', () => {
  const s = fresh();
  const homes = ['miyapur', 'kondapur', 'kukatpally', 'madhapur', 'miyapur', 'kondapur', 'kukatpally', 'madhapur', 'kondapur'];
  const plan = planBatch(homes.map((h, i) => ({ id: 'x' + i, pickup: h, drop: 'orbit' })), { pricing: s.get().pricing, now: s.get().now });
  assert.ok(plan.cars.length >= 2);
  assert.equal(plan.cars.reduce((n, c) => n + c.riders.length, 0), 9);
  for (const c of plan.cars) assert.ok(c.riders.length <= 6);
});

test('night rule never breaks the detour cap', () => {
  const s = fresh();
  const team = s.get().riders.filter(r => r.company === 'orbit').slice(0, 7);
  const plan = planBatch(team.map(r => ({ id: r.id, pickup: 'orbit', drop: r.home, gender: r.gender })), { pricing: s.get().pricing, now: s.get().now, night: true });
  for (const c of plan.cars) {
    for (const d of c.detours) assert.ok(d.ok, `${d.riderId} extra ${d.extra}`);
    const g = c.riders.map(id => team.find(r => r.id === id).gender);
    if (g.includes('f') && g.includes('m')) assert.equal(g[g.length - 1], 'm', 'last drop not a woman');
  }
});

test('busy-hour demand is applied once', () => {
  const s = fresh(); const p = s.get().pricing; p.demand = 1.4;
  const q = quote({ cls: 'Sedan', km: 10, min: 25, trip: 'city', demand: p.demand, now: s.get().now, pricing: p });
  assert.equal(q.parts.demand, 1.4);
  const q2 = quote({ cls: 'Sedan', km: 10, min: 25, trip: 'city', now: s.get().now, pricing: p });
  assert.equal(q2.parts.demand, 1.4);
});

test('company is refunded when the assigned car is cheaper than the quote', () => {
  const s = fresh(); const w = s.get().wallets.orbit; const before = w.balance;
  charge(s, 'orbit', 400, 'x');
  const id = bookRide(s, { riderId: 'r1', pickup: 'jubilee', drop: 'hitec', cls: 'Sedan', trip: 'city', channel: 'corporate', payer: 'orbit', fare: 400, quoted: true });
  for (let i = 0; i < 10; i++) tick(s, 2000);
  const r = s.get().rides.find(x => x.id === id);
  assert.ok(r.fare < 400);
  assert.equal(w.balance, before - r.fare);
});

test('a ride everyone declined is offered again', () => {
  const s = fresh();
  s.get().drivers.forEach(d => { d.auto = false; });
  const id = bookRide(s, { riderId: 'r1', pickup: 'banjara', drop: 'hitec', cls: 'Luxury', trip: 'city', channel: 'app' });
  for (let i = 0; i < 40; i++) tick(s, 5000);
  s.get().drivers.forEach(d => { d.auto = true; });
  for (let i = 0; i < 60; i++) tick(s, 5000);
  assert.notEqual(s.get().rides.find(x => x.id === id).status, 'finding');
});

test('WhatsApp booking keeps the fare shown on the class card', () => {
  const s = fresh(); const chat = 'wa2';
  for (const x of ['hi', 'City', 'loc:jubilee', 'drop:hitec']) waHandle(s, chat, x);
  const card = s.get().whatsapp[chat].messages.find(m => m.kind === 'classes').cards.find(c => c.cls === 'Sedan');
  waHandle(s, chat, 'cls:Sedan');
  const r = s.get().rides.find(x => x.chatId === chat);
  assert.equal(r.fare, card.fare);
  for (let i = 0; i < 10; i++) tick(s, 2000);
  assert.ok(s.get().rides.find(x => x.chatId === chat).fare <= card.fare);
});

test('WhatsApp books a ride in 4 taps after hi', () => {
  const s = fresh();
  const chat = 'wa1';
  waHandle(s, chat, 'hi');
  waHandle(s, chat, 'City');
  waHandle(s, chat, 'loc:jubilee');
  waHandle(s, chat, 'drop:hitec');
  const out = waHandle(s, chat, 'cls:Sedan');
  assert.equal(s.get().whatsapp[chat].stage, 'confirmed');
  assert.ok(out.length > 0);
  assert.ok(s.get().rides.some(r => r.channel === 'whatsapp'));
});
