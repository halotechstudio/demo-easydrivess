import { uid, notify, inr, fmtTime, IST } from './store.js';
import { places, route, pathOf, along, UNIT_KM, ROAD, minutesFor, distanceKm } from './geo.js';
import { quote, conditionScore, classEligible, DAY } from './pricing.js';
import { charge, refund, driverCredit } from './wallet.js';
import { waOnUpdate } from './whatsapp.js';

const MIN = 60e3;
export const OFFER_MS = 20e3;
const AUTO_ACCEPT_MS = 4e3;
const AUTO_OTP_MS = 60e3;
const DISPATCH_AHEAD = 20 * MIN;

export const carOf = (s, driverId) => { const d = s.get().drivers.find(x => x.id === driverId); return d && s.get().cars.find(c => c.id === d.carId); };
export const riderOf = (s, id) => s.get().riders.find(r => r.id === id);
const driverOf = (s, id) => s.get().drivers.find(d => d.id === id);
const otp = () => String(1000 + Math.floor(Math.random() * 9000));

// Estimate shown before booking (no specific car yet; uses a typical car of the class).
export function estimate(s, { pickup, drop, cls, trip = 'city', at }) {
  const st = s.get();
  const km = distanceKm(pickup, drop), min = minutesFor(km);
  const typical = st.cars.filter(c => c.cls === cls && c.status === 'live').sort((a, b) => conditionScore(b, st.now).score - conditionScore(a, st.now).score)[0];
  const q = quote({ cls, km, min, car: typical, trip, demand: st.pricing.demand, now: at || st.now, pricing: st.pricing });
  return { ...q, km, min, car: typical, score: typical ? conditionScore(typical, st.now).score : null };
}

export function bookRide(s, req) {
  const st = s.get();
  const path = req.stops ? { points: req.points, km: req.km, min: req.min } : (() => { const r = route(req.pickup, req.drop); return { points: r.points, km: r.km, min: r.min }; })();
  const est = req.fare ?? quote({ cls: req.cls, km: path.km, min: path.min, trip: req.trip, demand: st.pricing.demand, now: req.at || st.now, pricing: st.pricing }).fare;
  const ride = {
    id: uid(s, 'R'), riderId: req.riderId, riderIds: req.riderIds || [req.riderId], pickup: req.pickup, drop: req.drop,
    cls: req.cls, trip: req.trip || 'city', channel: req.channel || 'app', payer: req.payer || 'self', batchId: req.batchId || null,
    stops: req.stops || [], points: path.points, km: path.km, min: path.min, fare: est, fixedFare: req.fare != null, quoted: !!req.quoted,
    at: req.at || null, flight: req.flight || null, guest: req.guest || null, chatId: req.chatId || null, templateId: req.templateId || null,
    status: req.at && req.at - st.now > DISPATCH_AHEAD ? 'scheduled' : 'finding',
    createdAt: st.now, otp: otp(), offer: null, declined: [], driverId: null, carId: null,
    progress: 0, approach: null, waitStarted: null, stopIdx: 0, log: [{ at: st.now, text: 'Booked' }],
  };
  st.rides.unshift(ride);
  if (!ride.batchId) notify(s, 'ops', 'ops', `${{ app: 'App', whatsapp: 'WhatsApp', hotel: 'Hotel', corporate: 'Corporate' }[ride.channel]} booking`, `${ride.cls} · ${places[ride.pickup]?.name.split(' · ')[0]} to ${places[ride.drop]?.name.split(' · ')[0]} · ${inr(ride.fare)}${ride.at ? ' · ' + fmtTime(ride.at) : ''}`);
  s.dispatch('ride', ride);
  return ride.id;
}

// Manager / hotel batch booking: charges the payer wallet once, then books one ride per car.
export function bookBatch(s, plan, { payer, trip = 'city', at = null, channel = 'corporate', bookedBy }) {
  const st = s.get();
  const ok = charge(s, payer, plan.total, `batch ${plan.cars.length} cars`);
  if (ok !== 'ok') return { error: ok };
  const batchId = uid(s, 'B');
  const ids = plan.cars.map(car => bookRide(s, {
    riderId: car.riders[0], riderIds: car.riders, pickup: car.stops[0].placeId, drop: car.stops[car.stops.length - 1].placeId,
    cls: car.cls, trip, channel, payer, batchId, stops: car.stops.map(x => ({ ...x, done: false })), points: car.points, km: car.km, min: car.min, fare: car.cost, at,
  }));
  st.stats.carsSavedToday += plan.carsSaved; st.stats.savedToday += plan.saved;
  for (const id of plan.cars.flatMap(c => c.riders)) notify(s, 'rider', id, 'Cab booked', `${bookedBy || 'Your manager'} booked your ride${at ? ' for ' + fmtTime(at) : ''}. Driver details follow.`);
  notify(s, 'ops', 'ops', 'Corporate batch paid', `${plan.sentence} ${inr(plan.total)} received.`, 'good');
  s.dispatch('batch', { batchId, ids });
  return { batchId, ids };
}

export function cancelRide(s, rideId, by = 'rider') {
  const st = s.get(); const r = st.rides.find(x => x.id === rideId);
  if (!r || ['completed', 'cancelled'].includes(r.status)) return;
  if (['finding', 'scheduled', 'arriving', 'arrived'].includes(r.status) && r.payer !== 'self') refund(s, r.payer, r.fare, r.id);
  if (r.driverId) { const d = driverOf(s, r.driverId); d.busy = false; }
  r.status = 'cancelled'; r.offer = null; r.log.push({ at: st.now, text: `Cancelled by ${by}` });
  s.dispatch('ride', r);
}

export function acceptOffer(s, rideId) {
  const st = s.get(); const r = st.rides.find(x => x.id === rideId);
  if (!r?.offer) return;
  const d = driverOf(s, r.offer.driverId); const car = carOf(s, d.id);
  r.driverId = d.id; r.carId = car.id; r.offer = null; d.busy = true;
  // Ruling: the rider never pays more than the fare they were shown; a lower-scoring car brings the price down.
  if (!r.fixedFare || r.quoted) {
    const actual = quote({ cls: r.cls, km: r.km, min: r.min, car, trip: r.trip, demand: st.pricing.demand, now: st.now, pricing: st.pricing }).fare;
    r.fare = r.quoted ? Math.min(r.fare, actual) : actual;
  }
  const firstStop = r.stops.length ? r.stops[0].placeId : r.pickup;
  const target = places[firstStop];
  const km = Math.hypot(target.x - d.pos.x, target.y - d.pos.y) * UNIT_KM * ROAD;
  const mid = { x: (d.pos.x + target.x) / 2 + 12, y: (d.pos.y + target.y) / 2 - 8 };
  r.approach = { points: [{ ...d.pos }, mid, { x: target.x, y: target.y }], km: Math.round(km * 10) / 10, min: Math.max(3, minutesFor(km) - 2), progress: 0 };
  r.status = 'arriving'; r.log.push({ at: st.now, text: `${d.name} accepted` });
  for (const id of r.riderIds) notify(s, 'rider', id, 'Driver on the way', `${d.name} · ${car.model} · ${car.plate}. Arriving in ${r.approach.min} min.`);
  waOnUpdate(s, r, 'assigned');
  s.dispatch('ride', r);
}

export function declineOffer(s, rideId) {
  const r = s.get().rides.find(x => x.id === rideId);
  if (!r?.offer) return;
  r.declined.push(r.offer.driverId); r.offer = null; s.dispatch('ride', r);
}

export function verifyOtp(s, rideId, code) {
  const st = s.get(); const r = st.rides.find(x => x.id === rideId);
  if (!r || r.status !== 'arrived') return false;
  if (code != null && String(code) !== r.otp) return false;
  if (r.stops.length) {
    const stop = r.stops[r.stopIdx]; stop.done = true; r.stopIdx++;
  }
  r.status = 'onboard'; r.waitStarted = null; r.log.push({ at: st.now, text: 'Rider verified, trip started' });
  waOnUpdate(s, r, 'onboard');
  s.dispatch('ride', r);
  return true;
}

export function rateRide(s, rideId, { stars, clean }) {
  const r = s.get().rides.find(x => x.id === rideId); if (!r) return;
  r.rating = { stars, clean };
  const car = s.get().cars.find(c => c.id === r.carId);
  if (car && clean != null) car.feedback = Math.round(car.feedback * 0.9 + (clean ? 100 : 40) * 0.1);
  s.dispatch('ride', r);
}

export function setFlightDelay(s, rideId, minutes) {
  const r = s.get().rides.find(x => x.id === rideId); if (!r?.flight) return;
  r.flight.delay = minutes; r.at = r.flight.land + minutes * MIN + 15 * MIN;
  r.log.push({ at: s.get().now, text: `Flight delayed ${minutes} min, pickup moved to ${fmtTime(r.at)}` });
  notify(s, 'hotel', r.payer, 'Flight delayed', `${r.flight.no} is ${minutes} min late. Pickup moved to ${fmtTime(r.at)} automatically.`, 'warn');
  s.dispatch('ride', r);
}

function dayKey(ms) { const d = new Date(ms + IST); return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`; }

export function materialiseTemplates(s) {
  const st = s.get(); const key = dayKey(st.now); const dow = new Date(st.now + IST).getUTCDay();
  for (const t of st.templates) {
    if (!t.days.includes(dow) || t.lastDay === key) continue;
    const [h, m] = t.time.split(':').map(Number);
    const d = new Date(st.now + IST); const at = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m) - IST;
    if (at < st.now) { t.lastDay = key; continue; }
    t.lastDay = key;
    bookRide(s, { riderId: t.riderId, pickup: t.pickup, drop: t.drop, cls: t.cls, trip: 'city', channel: 'app', payer: t.payer, at, templateId: t.id });
  }
}

function dispatch(s) {
  const st = s.get();
  const offered = new Set(st.rides.filter(r => r.offer).map(r => r.offer.driverId));
  for (const r of st.rides) {
    if (r.status === 'scheduled' && r.at - st.now <= DISPATCH_AHEAD) { r.status = 'finding'; r.log.push({ at: st.now, text: 'Dispatching' }); }
    if (r.status !== 'finding') continue;
    if (r.offer) {
      const d = driverOf(s, r.offer.driverId);
      if (d.auto && st.now - r.offer.since >= AUTO_ACCEPT_MS) { acceptOffer(s, r.id); continue; }
      if (st.now >= r.offer.until) { r.declined.push(r.offer.driverId); offered.delete(r.offer.driverId); r.offer = null; }
      else continue;
    }
    const target = places[r.stops.length ? r.stops[0].placeId : r.pickup];
    const cands = st.drivers.filter(d => d.online && !d.busy && !offered.has(d.id) && !r.declined.includes(d.id))
      .map(d => ({ d, car: carOf(s, d.id) }))
      .filter(({ car }) => car && car.status === 'live' && classEligible(car, st.now).includes(r.cls));
    if (!cands.length) continue;
    // Score: 50% ETA, 20% condition, 20% acceptance, 10% rest. Lower is better.
    // Ruling: a car from a higher class only serves a lower class when no same-class car is close (keeps premium cars free).
    const scored = cands.map(({ d, car }) => {
      const eta = Math.hypot(target.x - d.pos.x, target.y - d.pos.y) * UNIT_KM * ROAD * 2.3;
      const cond = conditionScore(car, st.now).score;
      const upgrade = car.cls !== r.cls ? 12 : 0;
      return { d, score: 0.5 * eta + 0.2 * (100 - cond) / 4 + 0.2 * (100 - d.acceptance) / 4 + 0.1 * (d.restHours < 1 ? 20 : 0) + upgrade };
    }).sort((a, b) => a.score - b.score);
    const best = scored[0].d;
    r.offer = { driverId: best.id, since: st.now, until: st.now + OFFER_MS };
    offered.add(best.id);
    notify(s, 'driver', best.id, 'New ride request', `${r.trip === 'airport' ? 'Airport · ' : ''}${places[r.pickup]?.name} to ${places[r.drop]?.name} · ${inr(r.fare)}`);
    s.dispatch('ride', r);
  }
}

function advance(s, dt) {
  const st = s.get();
  for (const r of st.rides) {
    const d = r.driverId && driverOf(s, r.driverId);
    if (r.status === 'arriving') {
      r.approach.progress += dt / (r.approach.min * MIN);
      d.pos = along(r.approach.points, r.approach.progress);
      if (r.approach.progress >= 1) {
        r.status = 'arrived'; r.waitStarted = st.now; r.log.push({ at: st.now, text: 'Driver at pickup' });
        for (const id of (r.stops[0]?.riderIds || r.riderIds)) notify(s, 'rider', id, 'Your driver is here', `Check the plate, then share OTP ${r.otp}.`, 'good');
        s.dispatch('ride', r);
      }
    } else if (r.status === 'arrived') {
      if (d.auto && st.now - r.waitStarted >= AUTO_OTP_MS) verifyOtp(s, r.id);
    } else if (r.status === 'onboard') {
      r.progress = Math.min(1, r.progress + dt / (Math.max(1, r.min) * MIN));
      d.pos = along(r.points, r.progress);
      if (r.stops.length) {
        const next = r.stops[r.stopIdx];
        if (next && r.progress * r.min >= next.etaMin) {
          if (next.type === 'pickup' && next !== r.stops[r.stops.length - 1]) {
            // Intermediate pickup: car waits, rider shows OTP (auto in sim).
            next.done = true; r.stopIdx++; r.log.push({ at: st.now, text: `Picked up ${riderOf(s, next.riderId)?.name || 'rider'}` });
            notify(s, 'rider', next.riderId, 'Picked up', 'On the way. Track the trip live.');
          } else if (next.type === 'drop' && r.stopIdx < r.stops.length - 1) {
            next.done = true; r.stopIdx++; r.log.push({ at: st.now, text: `Dropped ${riderOf(s, next.riderId)?.name || 'rider'}` });
          }
          s.dispatch('ride', r);
        }
      }
      if (r.progress >= 1) complete(s, r);
    }
  }
}

function complete(s, r) {
  const st = s.get(); const d = driverOf(s, r.driverId);
  r.stops.forEach(x => { x.done = true; });
  r.status = 'completed'; r.completedAt = st.now; d.busy = false; d.trips++; d.todayTrips++;
  const earn = driverCredit(s, d, r);
  r.log.push({ at: st.now, text: `Completed · driver earned ${inr(earn)}` });
  for (const id of r.riderIds) notify(s, 'rider', id, 'You have arrived', r.payer === 'self' ? `${inr(r.fare)} paid. Rate your ride.` : 'Paid by your company. Rate your ride.', 'good');
  notify(s, 'driver', d.id, 'Trip complete', `${inr(earn)} added to your wallet.`, 'good');
  waOnUpdate(s, r, 'completed');
  s.dispatch('ride', r);
}

export function tick(s, dt) {
  const st = s.get();
  const before = dayKeyOf(st.now);
  st.now += dt;
  if (dayKeyOf(st.now) !== before) materialiseTemplates(s);
  dispatch(s);
  advance(s, dt);
  s.dispatch('tick', st.now);
}
const dayKeyOf = dayKey;
export { DAY };
