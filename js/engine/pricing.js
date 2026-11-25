import { istHour, inr } from './store.js';

export const DAY = 86400e3;
export const CLASSES = ['Hatchback', 'Sedan', 'SUV', 'Luxury'];
export const SEATS = { Hatchback: 4, Sedan: 4, SUV: 6, Luxury: 4 };
export const BAGS = { Hatchback: 2, Sedan: 3, SUV: 4, Luxury: 3 };
export const CLASS_NOTE = { Hatchback: 'Compact, quick in traffic', Sedan: 'Comfort with boot space', SUV: 'Six seats, big boot', Luxury: 'Premium car, top-rated drivers' };

export function defaultPricing() {
  return {
    base: { Hatchback: 45, Sedan: 60, SUV: 95, Luxury: 160 },
    perKm: { Hatchback: 11, Sedan: 13.5, SUV: 18, Luxury: 28 },
    perMin: { Hatchback: 1, Sedan: 1.2, SUV: 1.6, Luxury: 2.6 },
    age: [{ maxYears: 2, f: 1.05 }, { maxYears: 5, f: 1.0 }, { maxYears: 99, f: 0.95 }],
    condition: [{ min: 90, f: 1.05 }, { min: 75, f: 1.0 }, { min: 0, f: 0.92 }],
    surgeCap: 1.8, demand: 1.0,
    airport: 150, night: 1.15, intercityPerKmFactor: 0.82, toll: 0,
    commission: 0.18, effectiveFrom: null, version: 1,
  };
}

const yearsOld = (car, now) => new Date(now).getUTCFullYear() - car.year;

// Condition Score (0–100) = 40% Shine Check + 25% rider feedback + 20% fitness/documents + 15% age.
export function conditionScore(car, now) {
  const daysSince = car.shine?.at != null ? Math.floor((now - car.shine.at) / DAY) : 9;
  const shine = Math.max(0, (car.shine?.score ?? 0) - 15 * daysSince);
  const age = Math.max(0, 100 - yearsOld(car, now) * 9);
  const feedback = car.feedback ?? 80, fitness = car.fitness ?? 80;
  const score = Math.round(0.40 * shine + 0.25 * feedback + 0.20 * fitness + 0.15 * age);
  let sentence;
  if (daysSince === 0 && shine >= 85) sentence = 'Cleaned this morning.';
  else if (daysSince === 0) sentence = 'Checked today, light cleaning due.';
  else sentence = `Last check ${daysSince} day${daysSince > 1 ? 's' : ''} ago.`;
  if (daysSince === 0) sentence += car.shine?.attire ? ' Driver in uniform.' : ' Uniform not confirmed.';
  return { score, parts: { shine, feedback, fitness, age }, sentence, fresh: daysSince === 0 };
}

export const conditionTone = score => (score >= 90 ? 'good' : score >= 75 ? 'ok' : 'low');

export function classEligible(car, now) {
  const { score } = conditionScore(car, now);
  // A car serves its own class and the class below it; Luxury needs score ≥ 90, onboarding ≥ 90, ≤ 3 years.
  if (car.cls === 'SUV') return ['SUV'];
  if (car.cls === 'Hatchback') return ['Hatchback'];
  if (car.cls === 'Sedan') return ['Sedan', 'Hatchback'];
  const lux = score >= 90 && (car.onboard ?? 0) >= 90 && yearsOld(car, now) <= 3;
  return lux ? ['Luxury', 'Sedan'] : ['Sedan'];
}

const pick = (table, test) => table.find(test);

export function quote({ cls, km, min, car, trip = 'city', demand, now, pricing }) {
  const p = pricing;
  const perKm = p.perKm[cls] * (trip === 'intercity' ? p.intercityPerKmFactor : 1);
  const raw = p.base[cls] + perKm * km + p.perMin[cls] * min;
  const yrs = car ? yearsOld(car, now) : 3;
  const cond = car ? conditionScore(car, now).score : 85;
  const age = pick(p.age, r => yrs <= r.maxYears).f;
  const condition = pick(p.condition, r => cond >= r.min).f;
  // Demand comes from the caller or the live pricing table, applied once.
  const dem = Math.min(Math.max(1, demand ?? p.demand ?? 1), p.surgeCap);
  const h = istHour(now);
  const night = h >= 22 || h < 6 ? p.night : 1;
  const extra = (trip === 'airport' ? p.airport : 0) + (p.toll || 0);
  const fare = Math.round(raw * age * condition * dem * night + extra);
  const bits = [];
  if (car) bits.push(`${car.year} ${cls}${conditionScore(car, now).fresh ? ', cleaned today' : ''}`);
  else bits.push(cls);
  if (trip === 'airport') bits.push('airport rate');
  if (trip === 'intercity') bits.push(`intercity, ${Math.round(km)} km`);
  if (dem > 1.01) bits.push('busy hour');
  if (night > 1) bits.push('night rate');
  return { fare, parts: { raw: Math.round(raw), age, condition, demand: dem, night, extra, score: cond }, sentence: `${inr(fare)}. ${bits.join('; ')}.` };
}
