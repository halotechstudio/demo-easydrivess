import { h, icon, map, dotNumber, scrollNumber, sentence, topbar, adCard, btn, swipe, tickGauge, ring, pill, tile, initials } from '../ui/kit.js';
import { inr, fmtTime, fmtClock } from '../engine/store.js';
import { places } from '../engine/geo.js';
import { conditionScore, classEligible } from '../engine/pricing.js';
import { acceptOffer, declineOffer, verifyOtp, carOf, OFFER_MS } from '../engine/rides.js';
import { requestPayout } from '../engine/wallet.js';
import { pickAd, recordImpression, recordClick } from '../engine/ads.js';
import { router, ACTIVE, placeName, stopList, mapForRide } from './common.js';

const SHOTS = [
  { k: 'front', t: 'Front of the car', hint: 'Fit the whole car in the frame', art: 'M8 52h64M14 52V40l8-14h36l8 14v12M22 40h36M18 46h6M56 46h6M20 52v6M60 52v6' },
  { k: 'rear', t: 'Rear seat', hint: 'Show the full back seat', art: 'M14 58V30c0-5 4-9 9-9h34c5 0 9 4 9 9v28M14 44h52M24 21v-6M56 21v-6' },
  { k: 'boot', t: 'Boot', hint: 'Open the boot, show the floor', art: 'M10 58h60M14 58V34h52v24M18 34l6-14h32l6 14M30 46h20' },
  { k: 'selfie', t: 'You, in uniform', hint: 'Hold the phone at chest height', art: 'M40 14a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM18 64c2-12 11-18 22-18s20 6 22 18M34 48l6 8 6-8' },
];
const CAPTURE_MS = 1400;

export function createDriver(s) {
  const ui = router('home');
  const app = { id: 'driver', ui, who: 'd01', follow: true, adShown: {}, otpIn: '', shine: null, failNext: null };
  const st = () => s.get();
  const me = () => st().drivers.find(d => d.id === app.who);
  const car = () => carOf(s, app.who);

  // Follow the driver serving the rider phone, so the demo shows both sides of one ride.
  app.sync = (riderApp) => {
    if (!app.follow) return;
    const r = st().rides.find(x => x.riderIds.includes(riderApp.who) && (ACTIVE.includes(x.status)) && (x.driverId || x.offer));
    const id = r ? (r.driverId || r.offer.driverId) : null;
    if (id && id !== app.who) { app.who = id; app.otpIn = ''; ui.reset('home'); }
  };

  const myOffer = () => st().rides.find(r => r.offer?.driverId === app.who);
  const myRide = () => st().rides.find(r => r.driverId === app.who && ACTIVE.includes(r.status));
  const justDone = () => st().rides.find(r => r.driverId === app.who && r.status === 'completed' && !r.history && st().now - r.completedAt < 20 * 60e3 && !app.seen?.[r.id]);

  function ad(slot, key) {
    const k = `${slot}:${key}:${app.who}`;
    if (app.adShown[k]) { const a = st().ads.find(x => x.id === app.adShown[k] && x.on); return adCard(a, () => recordClick(s, a.id)); }
    const a = pickAd(s, slot, app.who); if (!a) return null;
    recordImpression(s, a.id, app.who); app.adShown[k] = a.id; return adCard(a, () => recordClick(s, a.id));
  }

  const screens = {
    home() {
      if (app.shine) return shineScreen();
      const off = myOffer(); if (off) return offer(off);
      const r = myRide(); if (r) return trip(r);
      const done = justDone(); if (done) return complete(done);
      const d = me(); const c = car(); const cs = conditionScore(c, st().now);
      const due = !cs.fresh;
      return [
        h('div', { class: 'scroll' },
          h('div', { class: 'flex between', style: { padding: '6px 2px 16px' } },
            h('div', { class: 'flex' }, h('div', { class: 'avatar lg violet' }, initials(d.name)), h('div', null, h('div', { style: { fontSize: '18px', fontWeight: 500 } }, `Hi, ${d.name.split(' ')[0]}`), h('div', { class: 'label flex', style: { gap: '5px' } }, icon('star', 12), `${d.rating} · ${c.model}`))),
            h('span', { class: `pill ${d.online ? 'good' : ''}` }, h('span', { class: 'dot' }), d.online ? 'Online' : 'Offline')),
          due ? h('div', { class: 'hero alert' },
            h('div', { class: 'num-label' }, 'Shine Check due'),
            h('div', { class: 'num-row' }, dotNumber('40', { size: 9, off: false }), h('div', { style: { fontSize: '13px', color: 'var(--fg-2)', alignSelf: 'flex-end', marginLeft: '6px' } }, 'sec')),
            sentence(['Four quick photos keep your score high and unlock ', { chip: 'premium rides' }, '.']),
            h('div', { class: 'mt12' }, btn('Start Shine Check', { arrow: true, onClick: startShine })))
            : h('div', { class: 'hero condition' },
              h('div', { class: 'flex', style: { justifyContent: 'center' } }, tickGauge(cs.score, { size: 150, label: 'Condition', color: 'var(--aqua)' })),
              sentence([cs.sentence.replace(/\.$/, ''), '. Earns ', { chip: cs.score >= 90 ? '+5% fares' : 'standard fares' }, '.'])),
          h('div', { class: 'tiles mt12' }, tile('Earned today', inr(d.today)), tile('Trips today', d.todayTrips), tile('Wallet', inr(d.wallet)), tile('Acceptance', d.acceptance, '%')),
          h('div', { class: 'mt12' }, map({ height: 150, cars: [{ ...d.pos, color: '#5EF2C6', ring: true }], focus: [d.pos, { x: d.pos.x + 80, y: d.pos.y + 40 }], labels: true })),
          h('div', { class: 'small center mt8' }, d.online ? 'Finding rides near you…' : 'You are offline.'),
          h('div', { class: 'mt12' }, ad('driver-home', 'home')),
          h('div', { class: 'mt12' }, btn(d.online ? 'Go offline' : 'Go online', { kind: d.online ? 'dark' : 'primary', ic: 'power', onClick: () => { d.online = !d.online; s.dispatch('driver', d); } }))),
        tabbar('home')];
    },
    earnings() {
      const d = me(); const pays = st().payouts.filter(p => p.driverId === app.who).slice(0, 5);
      const week = [1420, 1980, 1640, 2210, 1870, 2460, d.today];
      return [topbar('Earnings', { menu: false }),
        h('div', { class: 'scroll' },
          h('div', { class: 'hero money' }, h('div', { class: 'num-label' }, 'Wallet balance'), h('div', { class: 'num-row' }, dotNumber('₹' + d.wallet, { size: 8, off: false })),
            sentence(['Withdraw any time. Up to ', { chip: '₹2,000' }, ' is sent instantly.'])),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'This week'), h('span', { class: 'label' }, inr(week.reduce((a, b) => a + b, 0)))),
            h('div', { class: 'bars', style: { height: '90px' } }, week.map((v, i) => h('div', { class: `b ${i === 6 ? 'hi' : ''}` }, h('i', { style: { height: `${Math.max(6, v / 2500 * 100)}%` } }), h('span', null, 'MTWTFSS'[i]))))),
          h('div', { class: 'mt12' }, btn(`Withdraw ${inr(d.wallet)}`, { arrow: true, disabled: d.wallet < 100, onClick: () => requestPayout(s, d.id, d.wallet) })),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Payouts')),
            pays.length ? pays.map(p => h('div', { class: 'row' }, h('span', { class: 'ic' }, icon('money')), h('div', { class: 'grow' }, h('div', { class: 't' }, inr(p.amount)), h('div', { class: 's' }, `${p.to} · ${fmtTime(p.at)}`)), pill(p.status === 'paid' ? 'Paid' : 'Requested', p.status === 'paid' ? 'good' : 'warn')))
              : h('div', { class: 'small' }, 'No payouts yet.')),
          h('div', { class: 'mt12' }, ad('driver-earnings', 'earn'))),
        tabbar('earnings')];
    },
    car() {
      const c = car(); const cs = conditionScore(c, st().now); const elig = classEligible(c, st().now);
      return [topbar('My car', { menu: false }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card flex between' }, h('div', null, h('div', { style: { fontSize: '17px', fontWeight: 500 } }, c.model), h('div', { class: 'label' }, `${c.year} · ${c.color}`)), pill(c.plate, 'light')),
          h('div', { class: 'tiles mt12' }, tile('Shine Check', cs.parts.shine), tile('Rider feedback', cs.parts.feedback), tile('Fitness & papers', cs.parts.fitness), tile('Age score', cs.parts.age)),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Ride types you get')), h('div', { class: 'flex wrap', style: { gap: '6px' } }, ['Hatchback', 'Sedan', 'SUV', 'Luxury'].map(k => pill(k, elig.includes(k) ? 'good' : '')))),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Papers')),
            Object.entries(c.docs).map(([k, v]) => h('div', { class: 'row' }, h('span', { class: 'ic' }, icon('doc')), h('div', { class: 'grow t' }, { rc: 'Registration (RC)', insurance: 'Insurance', permit: 'Commercial permit', puc: 'Pollution (PUC)', fitness: 'Fitness certificate' }[k]), pill(v === 'valid' ? 'Valid' : v, v === 'valid' ? 'good' : 'warn'))),
            h('div', { class: 'row' }, h('span', { class: 'ic' }, icon('settings')), h('div', { class: 'grow t' }, 'Service'), pill(c.serviceDue, c.serviceDue === 'Overdue' ? 'alert' : ''))),
          h('div', { class: 'mt12' }, btn('Start Shine Check', { kind: 'dark', ic: 'camera', onClick: startShine }))),
        tabbar('car')];
    },
  };

  function startShine() { app.shine = { i: 0, t0: performance.now(), done: [], result: null }; ui.dirty(); }
  app.animating = () => !!(app.shine && !app.shine.result);
  function shineScreen() {
    const sh = app.shine;
    if (!sh.result && performance.now() - sh.t0 > CAPTURE_MS) {
      sh.done.push(SHOTS[sh.i].k); sh.i++; sh.t0 = performance.now();
      if (sh.i >= SHOTS.length || sh.retake) finishShine();
    }
    if (sh.result) {
      const res = sh.result;
      return [topbar('Shine Check', { back: () => { app.shine = null; ui.dirty(); }, menu: false }),
        h('div', { class: 'scroll' },
          h('div', { class: `hero ${res.fix ? 'alert' : 'condition'}` },
            h('div', { class: 'flex', style: { justifyContent: 'center' } }, tickGauge(res.score, { size: 150, label: 'Cleanliness', color: res.fix ? 'var(--amber)' : 'var(--aqua)' })),
            sentence(res.fix ? [res.fix, '. Retake ', { chip: 'rear seat' }, ' only.'] : ['Clean car, ', { chip: 'uniform on' }, ', no new damage. You are set for today.'])),
          h('div', { class: 'shots mt12' }, SHOTS.map(x => h('div', { class: res.fix && x.k === 'rear' ? 'cur' : 'done' }, icon(res.fix && x.k === 'rear' ? 'camera' : 'check')))),
          h('div', { class: 'card mt12' }, [['Cleanliness', res.score], ['Uniform', res.fix ? 'Yes' : 'Yes'], ['New damage', 'None'], ['Checked by', 'Easydrivess Vision · 2 s']].map(([k, v]) => h('div', { class: 'row' }, h('div', { class: 'grow t' }, k), h('div', { class: 'strong' }, v))))),
        h('div', { class: 'dock' }, res.fix ? btn('Retake rear seat', { arrow: true, onClick: () => { app.shine = { i: 1, t0: performance.now(), done: ['front', 'boot', 'selfie'], result: null, retake: true }; ui.dirty(); } })
          : btn('Done', { arrow: true, onClick: () => { app.shine = null; ui.dirty(); } }))];
    }
    const shot = SHOTS[sh.i]; const p = Math.min(1, (performance.now() - sh.t0) / CAPTURE_MS);
    return [topbar(`Shine Check · ${Math.min(sh.i + 1, 4)} of 4`, { back: () => { app.shine = null; ui.dirty(); }, menu: false }),
      h('div', { class: 'scroll' },
        h('div', { class: 'cam' },
          h('div', { class: 'frame' }, ['tl', 'tr', 'bl', 'br'].map(k => h('i', { class: `corner ${k}` }))),
          h('svg', { class: 'subject', viewBox: '0 0 80 72', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h('path', { d: shot.art })),
          h('div', { class: 'scan' }),
          h('div', { style: { position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)' } }, ring(p, { size: 44, color: 'var(--aqua)' })),
          h('div', { class: 'hint' }, p > .7 ? 'Captured' : 'Hold steady, capturing automatically')),
        h('p', { class: 'display', style: { fontSize: '26px', marginTop: '16px' } }, shot.t, h('br'), h('span', { class: 'dim' }, shot.hint + '.')),
        h('div', { class: 'shots mt16' }, SHOTS.map((x, i) => h('div', { class: sh.done.includes(x.k) ? 'done' : i === sh.i ? 'cur' : '' }, icon(sh.done.includes(x.k) ? 'check' : 'camera')))))];
  }
  function finishShine() {
    const c = car(); const fail = app.failNext && !app.shine.retake;
    const score = fail ? 72 : 93 + Math.floor(Math.random() * 5);
    app.shine.result = { score, fix: fail ? 'Rear seat needs a quick wipe' : null };
    if (!fail) { c.shine = { score, at: st().now, attire: true, photos: 4 }; app.failNext = false; s.dispatch('car', c); }
    else app.failNext = false;
  }

  function offer(r) {
    const d = me(); const left = Math.max(0, r.offer.until - st().now);
    const earn = Math.round(r.fare * (1 - st().pricing.commission));
    const pk = places[r.stops[0]?.placeId || r.pickup];
    const kmTo = (Math.hypot(pk.x - d.pos.x, pk.y - d.pos.y) * .075).toFixed(1);
    return [h('div', { class: 'scroll', style: { paddingTop: '6px' } },
      h('div', { class: 'flex between' }, pill(`${r.trip === 'airport' ? 'Airport' : r.trip === 'intercity' ? 'Intercity' : r.channel === 'corporate' ? 'Corporate' : r.channel === 'whatsapp' ? 'WhatsApp' : r.channel === 'hotel' ? 'Hotel' : 'City'} · ${r.cls}${r.stops.length ? ` · ${r.stops.length} stops` : ''}`, 'violet'), ring(left / OFFER_MS, { size: 52, label: Math.ceil(left / 1000) })),
      h('p', { class: 'display', style: { margin: '10px 0 0' } }, 'New ride'),
      h('div', { class: 'hero mt12' }, h('div', { class: 'num-label' }, 'You earn'), h('div', { class: 'num-row' }, dotNumber('₹' + earn, { size: 10, off: false })),
        sentence([`${kmTo} km to pickup. Trip `, { chip: `${r.km} km` }, ` · about ${r.min} min.`])),
      h('div', { class: 'mt12' }, map({ ...mapForRide(s, r, { height: 140 }), cars: [{ ...d.pos, color: '#5EF2C6' }], focus: [d.pos, ...(r.stops.length ? r.stops.map(x => places[x.placeId]) : [places[r.pickup], places[r.drop]])] })),
      h('div', { class: 'card mt12' }, stopList(s, r))),
      h('div', { class: 'dock' }, swipe('Swipe to accept', () => acceptOffer(s, r.id)), h('button', { class: 'btn block', style: { color: 'var(--fg-2)', height: '42px' }, onclick: () => declineOffer(s, r.id) }, 'Decline'))];
  }

  function trip(r) {
    const d = me(); const m = mapForRide(s, r, { height: 210, carColor: '#5EF2C6' });
    const next = r.stops.length ? r.stops.find(x => !x.done) : null;
    const target = r.status === 'onboard' ? (next ? next.placeId : r.drop) : (r.stops[0]?.placeId || r.pickup);
    const riderName = id => st().riders.find(x => x.id === id)?.name || 'Guest';
    const nm = r.guest || riderName(next?.riderId || r.riderId);
    if (r.status === 'arrived') {
      const ok = app.otpIn.length === 4;
      const enter = k => { if (k === 'del') app.otpIn = app.otpIn.slice(0, -1); else if (app.otpIn.length < 4) app.otpIn += k; ui.dirty(); };
      return [topbar(`Pickup · ${placeName(target)}`, { menu: false }),
        h('div', { class: 'scroll' },
          h('p', { class: 'display', style: { fontSize: '28px', margin: '0 0 14px' } }, `Ask ${nm.split(' ')[0]}`, h('br'), h('span', { class: 'dim' }, 'for the ride code.')),
          h('div', { class: 'otp input', style: { justifyContent: 'center' } }, [0, 1, 2, 3].map(i => h('div', { class: `d ${i === app.otpIn.length ? 'cur' : ''}` }, app.otpIn[i] ? dotNumber(app.otpIn[i], { size: 4.5, off: false }) : null))),
          app.otpWrong && h('div', { class: 'small center mt8', style: { color: '#FF8A78' } }, 'That code does not match. Ask the rider to check their app.'),
          h('div', { class: 'keypad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'fill', '0', 'del'].map(k => k === 'fill'
            ? h('button', { style: { fontSize: '12px', color: 'var(--fg-3)' }, title: 'Demo: fill the right code', onclick: () => { app.otpIn = r.otp; ui.dirty(); } }, 'Demo')
            : h('button', { onclick: () => enter(k) }, k === 'del' ? icon('back') : k)))),
        h('div', { class: 'dock' }, btn('Start trip', { arrow: true, disabled: !ok, onClick: () => { const good = verifyOtp(s, r.id, app.otpIn); app.otpWrong = !good; app.otpIn = ''; ui.dirty(); } }))];
    }
    const left = r.status === 'arriving' ? Math.max(1, Math.ceil(r.approach.min * (1 - r.approach.progress))) : Math.max(1, Math.ceil(r.min * (1 - r.progress)));
    return [topbar(r.status === 'arriving' ? 'To pickup' : 'On trip', { menu: false, right: pill(d.auto ? 'Autopilot' : 'Manual', d.auto ? 'violet' : '') }),
      h('div', { class: 'scroll' },
        map(m),
        h('div', { class: 'card mt12 flex', style: { gap: '14px' } },
          h('div', { class: 'ic', style: { background: 'var(--lavender)', color: 'var(--ink)', width: '46px', height: '46px', borderRadius: '14px' } }, icon('nav', 22)),
          h('div', { class: 'grow' }, h('div', { class: 'label' }, r.status === 'arriving' ? 'Pick up' : next?.type === 'pickup' ? 'Next pickup' : 'Drop'), h('div', { style: { fontSize: '17px', fontWeight: 600 } }, placeName(target)), h('div', { class: 'small' }, nm)),
          h('div', { class: 'center' }, dotNumber(String(left), { size: 5, off: false }), h('div', { class: 'label' }, 'min'))),
        h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, `Trip ${r.id}`), h('span', { class: 'label' }, `${r.km} km · ${inr(Math.round(r.fare * (1 - st().pricing.commission)))} for you`)), stopList(s, r)),
        h('div', { class: 'flex mt12', style: { gap: '8px' } }, h('button', { class: 'btn dark', style: { flex: 1 } }, icon('phone', 18), 'Call rider'), h('button', { class: 'btn ember', style: { flex: 1 } }, icon('shield', 18), 'Emergency')))];
  }

  function complete(r) {
    const earn = Math.round(r.fare * (1 - st().pricing.commission));
    return [h('div', { class: 'scroll', style: { paddingTop: '10px' } },
      h('p', { class: 'display' }, 'Trip', h('br'), h('span', { class: 'dim' }, 'complete.')),
      h('div', { class: 'hero condition mt16' }, h('div', { class: 'num-label' }, 'Added to your wallet'), h('div', { class: 'num-row' }, dotNumber('₹' + earn, { size: 10, off: false })),
        sentence([`${r.km} km · ${r.riderIds.length} rider${r.riderIds.length > 1 ? 's' : ''}. Wallet `, { chip: inr(me().wallet) }, '.'])),
      h('div', { class: 'mt12' }, ad('driver-earnings', r.id))),
      h('div', { class: 'dock' }, btn('Back online', { arrow: true, onClick: () => { app.seen = { ...app.seen, [r.id]: 1 }; ui.dirty(); } }))];
  }

  function tabbar(cur) {
    return h('div', { class: 'tabbar' }, h('nav', null, [['home', 'home'], ['earnings', 'wallet'], ['car', 'car']].map(([k, ic]) => h('button', { 'aria-label': k, 'aria-pressed': String(cur === k), onclick: () => ui.reset(k) }, icon(ic)))));
  }

  app.render = () => (screens[ui.screen] || screens.home)(ui.params);
  app.caption = () => me()?.name || '';
  app.controls = () => {
    const d = me();
    return h('div', { class: 'flex', style: { gap: '14px', fontSize: '12.5px', color: 'var(--fg-2)' } },
      h('label', { class: 'flex', style: { gap: '6px' } }, h('button', { class: 'toggle', 'aria-pressed': String(!!d?.auto), style: { transform: 'scale(.8)' }, onclick: e => { d.auto = !d.auto; e.currentTarget.setAttribute('aria-pressed', String(d.auto)); s.dispatch('driver', d); } }), 'Autopilot'),
      h('label', { class: 'flex', style: { gap: '6px' } }, h('button', { class: 'toggle', 'aria-pressed': String(app.follow), style: { transform: 'scale(.8)' }, onclick: e => { app.follow = !app.follow; e.currentTarget.setAttribute('aria-pressed', String(app.follow)); } }), 'Follow rider'));
  };
  app.notifyKey = n => n.app === 'driver' && n.to === app.who;
  app.galleryScreens = () => [
    { title: 'Home · online', screen: 'home' },
    { title: 'Shine Check · capture', screen: 'home', before: () => { app._sh = app.shine; app.shine = { i: 1, t0: performance.now() - 600, done: ['front'], result: null }; }, after: () => { app.shine = app._sh; } },
    { title: 'Shine Check · result', screen: 'home', before: () => { app._sh = app.shine; app.shine = { i: 4, t0: 0, done: [], result: { score: 95, fix: null } }; }, after: () => { app.shine = app._sh; } },
    { title: 'Earnings', screen: 'earnings' },
    { title: 'My car', screen: 'car' },
  ];
  return app;
}
