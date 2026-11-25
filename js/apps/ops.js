import { h, icon, mark, pill, initials, dotNumber, map, tickGauge, ticksBar, adCard, sentence, carArt } from '../ui/kit.js';
import { inr, fmtTime, uid, notify, inbox, unread, markRead } from '../engine/store.js';
import { callSheet, flash } from './sheets.js';
import { led } from '../ui/fx.js';
import { places } from '../engine/geo.js';
import { conditionScore, classEligible, quote, CLASSES } from '../engine/pricing.js';
import { approvePayouts, rejectPayout, PAYOUT_SPEEDS } from '../engine/wallet.js';
import { ackAlert, closeAlert } from '../engine/safety.js';
import { adRevenue, AD_SLOTS } from '../engine/ads.js';
import { router, ACTIVE, placeName } from './common.js';

const CHANNEL = { app: 'App', corporate: 'Corporate', whatsapp: 'WhatsApp', hotel: 'Hotel' };
const STATUS = { finding: ['Finding', ''], scheduled: ['Scheduled', ''], arriving: ['To pickup', 'violet'], arrived: ['At pickup', 'violet'], onboard: ['On trip', 'violet'], completed: ['Done', 'good'], cancelled: ['Cancelled', 'alert'] };

// 42-point onboarding checklist in six groups (spec §3.9).
const CHECKLIST = {
  Documents: ['RC matches owner and driver', 'Insurance valid, commercial', 'Permit valid for Telangana', 'Fitness certificate valid', 'PUC valid', 'No pending challans'],
  Exterior: ['Front photo, no dents', 'Rear photo, no dents', 'Left side photo', 'Right side photo', 'Windscreen without cracks', 'All lights working', 'Tyre tread above 2 mm', 'Spare tyre present'],
  Interior: ['Seats clean, no tears', 'Seat covers fitted', 'AC cools within 3 minutes', 'No odour', 'Floor mats clean', 'Boot clean and empty', 'Roof lining intact', 'Windows open and close'],
  Safety: ['First-aid kit', 'Fire extinguisher', 'Seat belts in every row', 'Child lock off', 'Panic button wired', 'Door locks work', 'Hazard lights work'],
  Mechanical: ['Brakes pass test', 'Horn works', 'Wipers work', 'Odometer photo', 'No warning lights', 'Steering play normal', 'Suspension normal'],
  Features: ['GPS device fitted', 'Phone mount fitted', 'USB charger for riders', 'Easydrivess sticker placed', 'Water bottles stocked', 'Cab branding space'],
};
const ITEMS = Object.entries(CHECKLIST).flatMap(([g, list]) => list.map((t, i) => ({ id: `${g}-${i}`, g, t })));
// The vision pre-check marks these from the 8 photos; the rest need the inspector.
const AI_CHECKED = new Set(ITEMS.filter(x => ['Exterior', 'Interior', 'Documents'].includes(x.g) || /Odometer|sticker|mount/.test(x.t)).map(x => x.id));

export function createOps(s) {
  const ui = router('overview');
  const app = { id: 'ops', ui, filter: 'all', checks: {}, docs: {}, draft: null, newAd: null, rules: {}, bellOpen: false };
  const st = () => s.get();

  const kpi = (k, v, d, tone) => h('div', { class: 'panel kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k), d && h('div', { class: 'd', style: tone ? { color: tone } : null }, d));
  const head = (t1, t2, p, right) => h('div', { class: 'page-head' }, h('div', null, h('h2', null, t1, h('br'), h('span', { class: 'dim' }, t2)), p && h('p', null, p)), right);

  function revenue() {
    const rides = st().rides.filter(r => r.status === 'completed' || ['arriving', 'arrived', 'onboard'].includes(r.status) || (r.payer !== 'self' && r.status !== 'cancelled'));
    const gross = rides.reduce((a, r) => a + r.fare, 0);
    const commission = Math.round(gross * st().pricing.commission);
    const ads = st().ads.reduce((a, x) => a + adRevenue(x), 0);
    return { gross, commission, ads, rides };
  }

  const pages = {
    overview() {
      const live = st().rides.filter(r => ACTIVE.includes(r.status));
      const online = st().drivers.filter(d => d.online);
      const fleetScore = Math.round(st().cars.reduce((a, c) => a + conditionScore(c, st().now).score, 0) / st().cars.length);
      const rv = revenue();
      const cars = online.map(d => ({ ...d.pos, color: d.busy ? '#8F8CF2' : '#5EF2C6', label: d.busy ? d.name.split(' ')[0] : null }));
      const routes = live.filter(r => r.status === 'onboard' || r.status === 'arriving').map(r => ({ points: r.status === 'arriving' ? r.approach.points : r.points, tone: r.status === 'arriving' ? 'lav' : 'rides', dashed: r.status === 'arriving' }));
      const feed = st().notifications.filter(n => n.app === 'ops').slice(0, 6);
      return [head('Good morning,', 'here is Hyderabad right now.', 'Every booking channel, every car and every rupee, live.'),
        h('div', { class: 'wgrid hero-split' },
          h('div', { class: 'hero money', style: { borderRadius: '22px', padding: '22px' } },
            h('div', { class: 'num-label', style: { textAlign: 'left' } }, 'Booked today'),
            h('div', { class: 'num-row', style: { justifyContent: 'flex-start' } }, dotNumber('₹' + rv.gross.toLocaleString('en-IN'), { size: 7, off: false })),
            h('p', { class: 'sentence', style: { textAlign: 'left' } }, `${rv.rides.length} rides. Commission `, h('span', { class: 'chip' }, inr(rv.commission)), ', ads ', h('span', { class: 'chip' }, inr(rv.ads)), `. Smart batching saved ${st().stats.carsSavedToday} cars.`),
            h('div', { class: 'tiles mt16' },
              h('div', { class: 'tile', style: { background: 'rgba(11,11,15,.55)' } }, h('div', { class: 'v' }, live.length), h('div', { class: 'k' }, 'Live rides')),
              h('div', { class: 'tile', style: { background: 'rgba(11,11,15,.55)' } }, h('div', { class: 'v' }, `${online.length}`, h('small', null, `/${st().drivers.length}`)), h('div', { class: 'k' }, 'Cars online')))),
          h('div', { class: 'panel', style: { padding: 0, overflow: 'hidden' } }, map({ height: 330, cars, routes, allPlaces: true, labels: true }),
            h('div', { style: { position: 'absolute', top: '14px', left: '16px' }, class: 'flex' }, pill('Live', 'good'), h('span', { class: 'label' }, `${online.filter(d => d.busy).length} on trips · ${online.filter(d => !d.busy).length} free`)))),
        h('div', { class: 'wgrid c4 mt16' },
          h('div', { class: 'panel flex', style: { gap: '14px' } }, tickGauge(fleetScore, { size: 84, color: 'var(--aqua)' }), h('div', null, h('div', { style: { fontWeight: 500 } }, 'Fleet condition'), h('div', { class: 'label' }, `${st().cars.filter(c => !conditionScore(c, st().now).fresh).length} Shine Checks due`))),
          kpi('Cars saved by batching', st().stats.carsSavedToday, `${inr(st().stats.savedToday)} saved for clients`),
          kpi('WhatsApp bookings', st().stats.waBookingsToday, 'No app needed'),
          kpi('Ad revenue', inr(rv.ads), `${st().ads.filter(a => a.on).length} ads running`)),
        h('div', { class: 'panel mt16' }, h('h3', null, 'Activity'), feed.length ? feed.map(n => h('div', { class: 'row' }, h('span', { class: 'ic', style: { color: n.tone === 'alert' ? 'var(--ember)' : n.tone === 'good' ? 'var(--aqua)' : 'var(--fg-2)' } }, icon(n.tone === 'alert' ? 'sos' : 'bell')), h('div', { class: 'grow' }, h('div', { class: 't' }, n.title), h('div', { class: 's' }, n.body)), h('span', { class: 'label' }, fmtTime(n.at))))
          : h('div', { class: 'label' }, 'Quiet so far. Book a ride from any app.'))];
    },

    rides() {
      const chans = ['all', 'app', 'corporate', 'whatsapp', 'hotel'];
      const list = st().rides.filter(r => app.filter === 'all' || r.channel === app.filter).slice(0, 24);
      return [head('Rides', 'from every channel.', null, h('div', { class: 'tabs-sm' }, chans.map(c => h('button', { 'aria-pressed': String(app.filter === c), onclick: () => { app.filter = c; ui.dirty(); } }, c === 'all' ? 'All' : CHANNEL[c])))),
        h('div', { class: 'panel' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, ['Ride', 'Rider', 'Route', 'Car', 'Channel', 'Status', 'Driver', 'Fare'].map(x => h('th', { class: x === 'Fare' ? 'num' : '' }, x)))),
          h('tbody', null, list.map(r => {
            const d = st().drivers.find(x => x.id === r.driverId); const rider = st().riders.find(x => x.id === r.riderId);
            return h('tr', null, h('td', { class: 'label' }, r.id), h('td', null, r.guest || rider?.name || 'Guest', r.riderIds.length > 1 && h('span', { class: 'label' }, ` +${r.riderIds.length - 1}`)),
              h('td', null, `${placeName(r.stops[0]?.placeId || r.pickup)} → ${placeName(r.drop)}`), h('td', null, r.cls), h('td', null, pill(CHANNEL[r.channel], r.channel === 'whatsapp' ? 'good' : r.channel === 'corporate' ? 'violet' : '')),
              h('td', null, pill(...STATUS[r.status])), h('td', null, d ? d.name : h('span', { class: 'label' }, r.offer ? 'Offered…' : '—')), h('td', { class: 'num' }, inr(r.fare)));
          }))))];
    },

    fleet() {
      const now = st().now;
      return [head('Fleet', 'condition, scored daily.', 'Condition = 40% Shine Check + 25% rider feedback + 20% fitness and papers + 15% age.', h('button', { class: 'btn primary sm', onclick: () => ui.reset('onboard') }, icon('plus', 16), 'Onboard a car')),
        h('div', { class: 'panel' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, ['Car', 'Class', 'Condition', 'Shine Check', 'Gets', 'Papers', 'Driver'].map(x => h('th', null, x)))),
          h('tbody', null, st().cars.map(c => {
            const cs = conditionScore(c, now); const d = st().drivers.find(x => x.carId === c.id);
            const flags = Object.entries(c.docs).filter(([, v]) => v !== 'valid');
            return h('tr', null,
              h('td', null, h('div', { class: 'flex' }, h('span', { style: { width: '44px', color: 'var(--fg-2)' } }, carArt(c.cls)), h('div', null, h('div', { style: { fontWeight: 500 } }, c.model), h('div', { class: 'label' }, `${c.plate} · ${c.year}`)))),
              h('td', null, c.cls),
              h('td', null, h('div', { class: 'flex' }, h('b', { style: { width: '26px', fontWeight: 600 } }, cs.score), ticksBar(cs.score))),
              h('td', null, cs.fresh ? h('span', { class: 'label' }, `Done · ${fmtTime(c.shine.at)}`) : pill(`Due · ${Math.floor((now - c.shine.at) / 864e5)} d`, 'warn')),
              h('td', null, h('div', { class: 'flex', style: { gap: '4px' } }, classEligible(c, now).map(k => pill(k)))),
              h('td', null, flags.length ? pill(`${flags[0][0]} ${flags[0][1]}`, 'warn') : pill('All valid', 'good')),
              h('td', null, d ? d.name : '—'));
          }))))];
    },

    onboard() {
      const a = st().applicants[0];
      if (!a) return [head('Onboarding', 'nobody waiting.', 'New drivers apply from the Driver app. They show up here for checks.')];
      const decided = ITEMS.filter(x => app.checks[x.id]);
      const passed = ITEMS.filter(x => app.checks[x.id] === 'pass').length;
      const score = Math.round(passed / ITEMS.length * 100);
      const docs = { ...a.docs, ...app.docs };
      const docsOk = Object.values(docs).every(v => v === 'verified');
      const allDone = decided.length === ITEMS.length;
      const aiLeft = ITEMS.filter(x => AI_CHECKED.has(x.id) && !app.checks[x.id]).length;
      const yrs = new Date(st().now).getUTCFullYear() - a.car.year;
      const elig = score >= 90 && yrs <= 3 ? ['Luxury', 'Sedan'] : score >= 75 ? ['Sedan', 'Hatchback'] : [];
      const set = (id, v) => { app.checks[id] = v; ui.dirty(); };
      return [head('Onboard a car', `${a.car.model} · ${a.car.plate}`, `${a.name} applied with a ${a.car.year} ${a.car.model}. The car goes live only when the driver's papers and all 42 checks are done.`),
        h('div', { class: 'wgrid hero-split' },
          h('div', null,
            h('div', { class: `hero ${score >= 90 ? 'condition' : ''}`, style: { borderRadius: '22px' } },
              h('div', { class: 'flex', style: { justifyContent: 'center' } }, tickGauge(score, { size: 160, label: 'Onboarding score', color: 'var(--aqua)' })),
              sentence(allDone ? ['All 42 checks done. Eligible for ', { chip: elig.join(' & ') || 'none' }, '.'] : [`${decided.length} of 42 checked. `, aiLeft ? { chip: `${aiLeft} pre-checked from photos` } : 'Finish the manual checks.'])),
            h('div', { class: 'panel mt16' }, h('h3', null, 'Driver papers'),
              Object.entries(docs).map(([k, v]) => h('div', { class: 'row' }, h('span', { class: 'ic' }, icon('doc')), h('div', { class: 'grow t' }, { licence: 'Driving licence · DigiLocker', aadhaar: 'Aadhaar · OTP', police: 'Police verification', bank: 'Bank account' }[k]),
                v === 'verified' ? pill('Verified', 'good') : h('button', { class: 'btn primary sm', onclick: () => { app.docs[k] = 'verified'; ui.dirty(); } }, 'Mark verified')))),
            h('div', { class: 'mt16' }, h('button', { class: 'btn violet block', disabled: !(allDone && docsOk && elig.length), onclick: approve }, 'Approve and go live'))),
          h('div', { class: 'panel' },
            h('h3', null, 'Car checklist', aiLeft ? h('button', { class: 'btn primary sm', onclick: () => { ITEMS.forEach(x => { if (AI_CHECKED.has(x.id) && !app.checks[x.id]) app.checks[x.id] = 'pass'; }); ui.dirty(); } }, icon('spark', 15), `Accept photo pre-check (${aiLeft})`)
              : h('button', { class: 'btn dark sm', onclick: () => { ITEMS.forEach(x => { if (!app.checks[x.id]) app.checks[x.id] = 'pass'; }); ui.dirty(); } }, 'Pass remaining')),
            Object.entries(CHECKLIST).map(([g, list]) => h('div', { class: 'check-group' },
              h('div', { class: 'flex between', style: { marginBottom: '4px' } }, h('b', { style: { fontWeight: 600, fontSize: '13.5px' } }, g), h('span', { class: 'label' }, `${list.filter((_, i) => app.checks[`${g}-${i}`] === 'pass').length}/${list.length}`)),
              list.map((t, i) => { const id = `${g}-${i}`; return h('div', { class: 'check-item' }, h('div', null, t, AI_CHECKED.has(id) && h('span', { class: 's' }, ' · photo')),
                h('div', { class: 'pf' }, h('button', { class: 'pass', 'aria-pressed': String(app.checks[id] === 'pass'), onclick: () => set(id, 'pass') }, 'Pass'), h('button', { class: 'fail', 'aria-pressed': String(app.checks[id] === 'fail'), onclick: () => set(id, 'fail') }, 'Fail'))); })))))];

      function approve() {
        const id = 'c15'; const now = st().now;
        st().cars.push({ id, plate: a.car.plate, model: a.car.model, cls: a.car.cls, year: a.car.year, color: a.car.color, feedback: 90, fitness: 96, onboard: score, status: 'live', shine: { score: 96, at: now, attire: true, photos: 4 }, odometer: 4200, serviceDue: 'In 5,800 km', docs: { rc: 'valid', insurance: 'valid', permit: 'valid', puc: 'valid', fitness: 'valid' } });
        st().drivers.push({ id: a.id, name: a.name, carId: id, rating: 5.0, trips: 0, online: true, busy: false, auto: true, acceptance: 100, restHours: 10, pos: { x: places.begumpet.x, y: places.begumpet.y }, wallet: 0, today: 0, todayTrips: 0, phone: a.phone, languages: 'Telugu, English', verified: true, docs: { licence: 'verified', aadhaar: 'verified', police: 'verified', bank: 'verified' } });
        st().applicants.shift(); app.checks = {}; app.docs = {};
        notify(s, 'ops', 'ops', 'Car live', `${a.car.model} ${a.car.plate} passed ${passed}/42 and is now taking rides.`, 'good');
        ui.reset('fleet');
      }
    },

    drivers() {
      return [head('Drivers', 'verified and online.', null),
        h('div', { class: 'panel' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, ['Driver', 'Car', 'Status', 'Rating', 'Acceptance', 'Today', 'Wallet'].map(x => h('th', { class: ['Today', 'Wallet'].includes(x) ? 'num' : '' }, x)))),
          h('tbody', null, st().drivers.map(d => { const c = st().cars.find(x => x.id === d.carId);
            return h('tr', null, h('td', null, h('div', { class: 'flex' }, h('div', { class: 'avatar', style: { width: '30px', height: '30px', fontSize: '11px' } }, initials(d.name)), d.name)), h('td', null, `${c.model} · ${c.plate}`),
              h('td', null, pill(!d.online ? 'Offline' : d.busy ? 'On trip' : 'Free', !d.online ? '' : d.busy ? 'violet' : 'good')), h('td', null, d.rating.toFixed(1)), h('td', null, `${d.acceptance}%`), h('td', { class: 'num' }, inr(d.today)), h('td', { class: 'num' }, inr(d.wallet))); }))))];
    },

    pricing() {
      const live = st().pricing;
      app.draft ||= JSON.parse(JSON.stringify(live));
      const dr = app.draft;
      const sample = st().cars.find(c => c.id === 'c01');
      const prev = q => quote({ cls: 'Sedan', km: 9.8, min: 27, car: sample, trip: 'city', demand: q.demand, now: st().now, pricing: q });
      const changed = JSON.stringify(dr) !== JSON.stringify(live);
      const num = (obj, key, step = 1) => h('input', { class: 'num-in', type: 'number', step, value: obj[key], onchange: e => { obj[key] = Number(e.target.value); ui.dirty(); } });
      return [head('Pricing', 'live rules, no app release.', 'Fares move with the car: its class, age and today\'s condition. Changes apply to new quotes the moment you press Apply.',
        h('div', { class: 'flex' }, changed && h('button', { class: 'btn dark sm', onclick: () => { app.draft = null; ui.dirty(); } }, 'Discard'), h('button', { class: 'btn violet sm', disabled: !changed, onclick: () => { Object.assign(live, JSON.parse(JSON.stringify(dr)), { version: live.version + 1, effectiveFrom: st().now }); app.draft = null; notify(s, 'ops', 'ops', 'Pricing updated', `Version ${live.version} live from ${fmtTime(st().now)}.`, 'good'); ui.dirty(); } }, `Apply now`))),
        h('div', { class: 'wgrid hero-split' },
          h('div', { class: 'hero', style: { borderRadius: '22px', padding: '22px' } },
            h('div', { class: 'num-label' }, 'Jubilee Hills to HITEC City · Sedan'),
            h('div', { class: 'num-row' }, changed && h('div', { class: 'ghostnum' }, dotNumber('₹' + prev(live).fare, { size: 4.5, off: false })), dotNumber('₹' + prev(dr).fare, { size: 8, off: false })),
            sentence([prev(dr).sentence.replace(/^₹[\d,]+\. /, ''), ' ', { chip: changed ? 'Draft' : `Live · v${live.version}` }])),
          h('div', { class: 'panel' }, h('h3', null, 'Rates by class'),
            h('table', { class: 't' }, h('thead', null, h('tr', null, ['Class', 'Base ₹', 'Per km ₹', 'Per min ₹'].map(x => h('th', null, x)))),
              h('tbody', null, CLASSES.map(c => h('tr', null, h('td', null, c), h('td', null, num(dr.base, c)), h('td', null, num(dr.perKm, c, .5)), h('td', null, num(dr.perMin, c, .1)))))))),
        h('div', { class: 'wgrid c3 mt16' },
          h('div', { class: 'panel' }, h('h3', null, 'Car age'), dr.age.map((r, i) => h('div', { class: 'row' }, h('div', { class: 'grow t' }, i === 0 ? '2 years or newer' : i === 1 ? '2 to 5 years' : 'Older than 5 years'), num(r, 'f', .01)))),
          h('div', { class: 'panel' }, h('h3', null, 'Condition score'), dr.condition.map((r, i) => h('div', { class: 'row' }, h('div', { class: 'grow t' }, i === 0 ? '90 and above' : i === 1 ? '75 to 89' : 'Below 75'), num(r, 'f', .01)))),
          h('div', { class: 'panel' }, h('h3', null, 'Demand and extras'),
            h('div', { class: 'row' }, h('div', { class: 'grow t' }, `City demand now · ${dr.demand.toFixed(2)}×`)), h('input', { type: 'range', min: 1, max: 2.5, step: .05, value: dr.demand, oninput: e => { dr.demand = Number(e.target.value); ui.dirty(); } }),
            h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Surge cap'), num(dr, 'surgeCap', .1)),
            h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Airport charge ₹'), num(dr, 'airport', 10)),
            h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Night factor'), num(dr, 'night', .05)),
            h('div', { class: 'row' }, h('div', { class: 'grow t' }, 'Commission'), num(dr, 'commission', .01))))];
    },

    ads() {
      const total = st().ads.reduce((a, x) => a + adRevenue(x), 0);
      const n = app.newAd;
      return [head('Ads', 'side revenue, in the apps.', 'Never on live-trip, SOS or payment screens. Each person sees an ad at most 3 times a day.', h('button', { class: 'btn primary sm', onclick: () => { app.newAd = n ? null : { advertiser: '', title: '', sub: '', cta: 'Learn more', tone: 'majorelle', slots: ['rider-home'], cpm: 200 }; ui.dirty(); } }, icon(n ? 'close' : 'plus', 16), n ? 'Close' : 'New ad')),
        h('div', { class: 'wgrid c4' }, kpi('Revenue this month', inr(total)), kpi('Impressions', st().ads.reduce((a, x) => a + x.impressions, 0).toLocaleString('en-IN')), kpi('Clicks', st().ads.reduce((a, x) => a + x.clicks, 0).toLocaleString('en-IN')), kpi('Running', `${st().ads.filter(a => a.on).length}/${st().ads.length}`)),
        n && h('div', { class: 'panel mt16' }, h('h3', null, 'New ad'),
          h('div', { class: 'wgrid c2' },
            h('div', { class: 'wgrid', style: { gap: '10px' } },
              ['advertiser', 'title', 'sub', 'cta'].map(k => h('div', { class: 'field' }, h('label', null, { advertiser: 'Advertiser', title: 'Headline', sub: 'Line two', cta: 'Button' }[k]), h('input', { class: 'input', value: n[k], oninput: e => { n[k] = e.target.value; }, onchange: () => ui.dirty() }))),
              h('div', { class: 'field' }, h('label', null, 'Colour'), h('div', { class: 'tabs-sm' }, ['majorelle', 'ember', 'aqua', 'lavender'].map(t => h('button', { 'aria-pressed': String(n.tone === t), onclick: () => { n.tone = t; ui.dirty(); } }, t[0].toUpperCase() + t.slice(1))))),
              h('div', { class: 'field' }, h('label', null, 'Where it shows'), h('div', { class: 'tabs-sm', style: { flexWrap: 'wrap' } }, AD_SLOTS.map(sl => h('button', { 'aria-pressed': String(n.slots.includes(sl.id)), onclick: () => { n.slots = n.slots.includes(sl.id) ? n.slots.filter(x => x !== sl.id) : [...n.slots, sl.id]; ui.dirty(); } }, sl.label))))),
            h('div', null, h('div', { class: 'label', style: { marginBottom: '8px' } }, 'Preview'), adCard({ ...n, advertiser: n.advertiser || 'Advertiser', title: n.title || 'Your headline here', sub: n.sub || 'Second line' }),
              h('button', { class: 'btn violet block mt16', disabled: !(n.advertiser && n.title && n.slots.length), onclick: () => { st().ads.unshift({ id: uid(s, 'A'), ...n, on: true, impressions: 0, clicks: 0 }); app.newAd = null; notify(s, 'ops', 'ops', 'Ad live', `${n.advertiser} is now showing in ${n.slots.length} place${n.slots.length > 1 ? 's' : ''}.`, 'good'); ui.dirty(); } }, 'Publish')))),
        h('div', { class: 'panel mt16' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, ['Ad', 'Placements', 'Impressions', 'Clicks', 'CTR', 'Revenue', 'On'].map(x => h('th', { class: ['Impressions', 'Clicks', 'CTR', 'Revenue'].includes(x) ? 'num' : '' }, x)))),
          h('tbody', null, st().ads.map(a => h('tr', null,
            h('td', null, h('div', { class: 'flex' }, h('span', { class: `ad ${a.tone}`, style: { width: '34px', height: '34px', padding: 0, borderRadius: '10px', display: 'block' } }), h('div', null, h('div', { style: { fontWeight: 500 } }, a.advertiser), h('div', { class: 'label' }, a.title)))),
            h('td', null, h('div', { class: 'flex wrap', style: { gap: '4px' } }, a.slots.map(x => pill(AD_SLOTS.find(y => y.id === x)?.label || x)))),
            h('td', { class: 'num' }, a.impressions.toLocaleString('en-IN')), h('td', { class: 'num' }, a.clicks), h('td', { class: 'num' }, `${a.impressions ? (a.clicks / a.impressions * 100).toFixed(1) : '0.0'}%`), h('td', { class: 'num' }, inr(adRevenue(a))),
            h('td', null, h('button', { class: 'toggle', 'aria-pressed': String(a.on), onclick: () => { a.on = !a.on; s.dispatch('ad', a); } })))))))];
    },

    payouts() {
      const req = st().payouts.filter(p => p.status === 'requested');
      return [head('Payouts', 'drivers paid on request.', 'Requests up to ₹2,000 are sent automatically. Larger ones wait for you.', h('button', { class: 'btn violet sm', disabled: !req.length, onclick: () => approvePayouts(s, 'all') }, req.length ? `Approve all · ${inr(req.reduce((a, p) => a + p.amount, 0))}` : 'Nothing to approve')),
        h('div', { class: 'wgrid c3' }, kpi('Waiting for you', inr(req.reduce((a, p) => a + p.amount, 0)), `${req.length} request${req.length === 1 ? '' : 's'}`), kpi('Paid today', inr(st().payouts.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0))), kpi('Still in driver wallets', inr(st().drivers.reduce((a, d) => a + d.wallet, 0)))),
        h('div', { class: 'panel mt16' }, h('table', { class: 't' },
          h('thead', null, h('tr', null, ['Request', 'Driver', 'To', 'Speed', 'Amount', 'Status'].map(x => h('th', { class: x === 'Amount' ? 'num' : '' }, x)))),
          h('tbody', null, st().payouts.map(p => h('tr', null, h('td', null, h('div', null, p.id), h('div', { class: 'label' }, fmtTime(p.at))), h('td', null, st().drivers.find(d => d.id === p.driverId)?.name), h('td', null, p.to), h('td', null, h('span', { class: 'label' }, PAYOUT_SPEEDS[p.speed || 'instant'].label)), h('td', { class: 'num' }, inr(p.amount)),
            h('td', null, p.status === 'paid' ? h('div', null, pill(p.how === 'auto' ? 'Credited · auto' : 'Credited', 'good'), h('div', { class: 'label', style: { marginTop: '3px' } }, p.utr)) : p.status === 'processing' ? h('span', { class: 'flex', style: { gap: '8px' } }, led('var(--periwinkle)', true), 'Sending') : p.status === 'rejected' ? pill('Returned', 'alert') : h('div', { class: 'flex', style: { gap: '6px' } }, h('button', { class: 'btn primary sm', onclick: () => approvePayouts(s, [p.id]) }, 'Approve'), h('button', { class: 'btn dark sm', onclick: () => rejectPayout(s, p.id, 'Account name does not match') }, 'Return'))))))))];
    },

    safety() {
      const open = st().alerts.filter(a => a.status === 'open');
      return [head('Safety desk', open.length ? `${open.length} alert${open.length > 1 ? 's' : ''} open.` : 'all clear.', 'SOS reaches this desk, the manager and the rider\'s trusted contact together.'),
        st().alerts.length ? st().alerts.map(a => { const r = st().rides.find(x => x.id === a.rideId); const d = r && st().drivers.find(x => x.id === r.driverId); const rider = r && st().riders.find(x => x.id === r.riderId);
          return h('div', { class: `panel mt16 ${a.status === 'open' ? 'hero alert' : ''}`, style: { borderRadius: '22px' } },
            h('div', { class: 'flex between' }, h('div', null, h('div', { style: { fontSize: '18px', fontWeight: 500 } }, `${rider?.name || 'Rider'} · ${a.type === 'sos' ? 'SOS' : 'Route alert'}`), h('div', { class: 'label' }, `${a.rideId} · ${d ? `${d.name} · ${st().cars.find(c => c.id === r.carId).plate}` : ''} · ${fmtTime(a.at)}`)), pill(a.status === 'open' ? (a.ack ? 'Being handled' : 'Open') : 'Closed', a.status === 'open' ? 'alert' : 'good')),
            h('div', { class: 'wgrid c2 mt16' },
              h('div', { class: 'stops' }, a.timeline.map(t => h('div', { class: 'stop done' }, h('span', { class: 'n' }, icon('check', 12)), h('div', null, h('div', { class: 't' }, t.text), h('div', { class: 's' }, fmtTime(t.at))), h('span')))),
              r && map({ height: 170, cars: [{ ...(d?.pos || places[r.pickup]), color: '#FF5A45', ring: true }], routes: [{ points: r.points, tone: 'ember' }], focus: [places[r.pickup], places[r.drop]] })),
            a.status === 'open' && h('div', { class: 'flex mt16' }, !a.ack && h('button', { class: 'btn primary sm', onclick: () => ackAlert(s, a.id) }, icon('phone', 15), 'Acknowledge and call rider'), h('button', { class: 'btn dark sm', onclick: () => callSheet(app, { name: d?.name || 'Driver', role: 'Driver on this trip' }) }, 'Call driver'), h('button', { class: 'btn dark sm', onclick: () => closeAlert(s, a.id) }, 'Mark safe and close')));
        }) : h('div', { class: 'panel' }, h('div', { class: 'label' }, 'No alerts today. Rules below apply to every ride.')),
        h('div', { class: 'panel mt16' }, h('h3', null, 'Rules on every ride'), ['OTP before boarding', 'Night rule for women riders', 'Route deviation alerts', 'Long-stop check', 'Daily Shine Check, condition below 75 gets no premium rides'].map(t => h('div', { class: 'row' }, led(app.rules[t] === false ? '#555' : 'var(--aqua)', app.rules[t] !== false), h('div', { class: 'grow t' }, t), h('button', { class: 'toggle', 'aria-pressed': String(app.rules[t] !== false), onclick: () => { app.rules[t] = app.rules[t] === false; flash(app, app.rules[t] ? 'Rule on' : 'Rule off', t, app.rules[t] ? 'good' : 'warn'); } }))))];
    },

    revenue() {
      const rv = revenue();
      const by = Object.keys(CHANNEL).map(k => ({ k, v: rv.rides.filter(r => r.channel === k).reduce((a, r) => a + r.fare, 0) }));
      const max = Math.max(1, ...by.map(x => x.v));
      const airport = rv.rides.filter(r => r.trip === 'airport').reduce((a, r) => a + (st().pricing.airport), 0);
      const premium = rv.rides.reduce((a, r) => { const c = st().cars.find(x => x.id === r.carId); return a + (c && conditionScore(c, st().now).score >= 90 ? Math.round(r.fare * .05 / 1.05) : 0); }, 0);
      return [head('Revenue', 'where the money comes from.', 'Companies, hotels and riders pay at booking. Drivers are paid their share; the rest is yours.'),
        h('div', { class: 'wgrid c4' }, kpi('Booked today', inr(rv.gross)), kpi('Your commission', inr(rv.commission), `${Math.round(st().pricing.commission * 100)}% of fares`), kpi('Ad revenue', inr(rv.ads)), kpi('Condition premium', inr(premium), 'from cars scoring 90+')),
        h('div', { class: 'wgrid c2 mt16' },
          h('div', { class: 'panel' }, h('h3', null, 'Bookings by channel'), h('div', { class: 'bars', style: { height: '170px' } }, by.map(x => h('div', { class: `b ${x.v === max ? 'hi' : ''}` }, h('span', { class: 'label', style: { color: 'var(--fg-2)' } }, inr(x.v)), h('i', { style: { height: `${Math.max(4, x.v / max * 100)}%` } }), h('span', null, CHANNEL[x.k]))))),
          h('div', { class: 'panel' }, h('h3', null, 'Lines'), [['Ride commission', rv.commission], ['Airport charges', airport], ['Advertising', rv.ads], ['Corporate subscriptions', 12000], ['Hotel partnership', 4500]].map(([k, v]) => h('div', { class: 'row' }, h('div', { class: 'grow t' }, k), h('b', { style: { fontWeight: 600 } }, inr(v)))),
            h('div', { class: 'label mt8' }, 'Demo figures.')))];
    },
  };

  const NAV = [['overview', 'Overview', 'grid'], ['rides', 'Rides', 'route'], ['fleet', 'Fleet', 'car'], ['onboard', 'Onboarding', 'shieldcheck'], ['drivers', 'Drivers', 'users'], ['pricing', 'Pricing', 'money'], ['ads', 'Ads', 'ad'], ['payouts', 'Payouts', 'wallet'], ['safety', 'Safety', 'shield'], ['revenue', 'Revenue', 'chart']];
  app.render = () => {
    const counts = { safety: st().alerts.filter(a => a.status === 'open').length, payouts: st().payouts.filter(p => p.status === 'requested').length, onboard: st().applicants.length };
    return h('div', { class: 'webapp', style: { flex: 1, minHeight: 0 } },
      h('aside', { class: 'side' }, h('div', { class: 'brand' }, mark('violet'), h('span', null, 'Easydrivess', h('small', null, 'Operations'))),
        NAV.map(([k, l, ic]) => h('button', { 'aria-pressed': String(ui.screen === k), onclick: () => ui.reset(k) }, icon(ic), h('span', { class: 'lbl' }, l), counts[k] ? h('span', { class: 'count' }, counts[k]) : null))),
      h('div', { class: 'main', style: { position: 'relative' } }, webBell(s, app, 'ops', 'ops'), (pages[ui.screen] || pages.overview)()),
      app.toast && app.toast.until > performance.now() && webToast(app.toast.n));
  };
  app.notifyKey = n => n.app === 'ops' && ['alert', 'warn'].includes(n.tone);
  return app;
}

// Notification bell for the web consoles: unread LED, popover list, mark read.
export function webBell(s, app, appId, to) {
  const n = unread(s, appId, to); const list = inbox(s, appId, to).slice(0, 12);
  return h('div', { style: { position: 'absolute', top: '22px', right: '26px', zIndex: 5 } },
    h('button', { class: 'iconbtn', 'aria-label': `Notifications, ${n} unread`, onclick: () => { app.bellOpen = !app.bellOpen; app.ui.dirty(); } }, icon('bell'), n ? h('span', { class: 'badge-led' }, n > 9 ? '9+' : n) : null),
    app.bellOpen && h('div', { class: 'bell-pop glass' },
      h('div', { class: 'flex between', style: { marginBottom: '6px' } }, h('b', { style: { fontWeight: 600 } }, 'Notifications'), n ? h('button', { class: 'label', style: { color: 'var(--lavender)' }, onclick: () => markRead(s, appId, to) }, 'Read all') : null),
      list.length ? list.map(x => h('button', { class: `notif ${x.read ? '' : 'unread'}`, onclick: () => markRead(s, appId, to, x.id) },
        h('span', { class: 'ic', style: { color: x.tone === 'alert' ? 'var(--ember)' : x.tone === 'good' ? 'var(--aqua)' : x.tone === 'warn' ? 'var(--amber)' : 'var(--periwinkle)' } }, icon(x.tone === 'alert' ? 'sos' : x.kind === 'wallet' || x.kind === 'payout' ? 'wallet' : 'bell', 16)),
        h('span', { class: 'grow' }, h('div', { class: 't', style: { fontWeight: 600, fontSize: '13.5px' } }, x.title), h('div', { class: 'small' }, x.body), h('div', { class: 'label' }, fmtTime(x.at)))))
        : h('div', { class: 'label', style: { padding: '12px 2px' } }, 'Nothing yet.')));
}
export const webToast = n => h('div', { class: 'toast', style: { position: 'absolute', top: 'auto', bottom: '18px', left: 'auto', right: '18px', width: '320px' } }, h('span', { class: 'ic' }, icon('bell', 16)), h('div', null, h('b', null, n.title), h('span', null, n.body)));