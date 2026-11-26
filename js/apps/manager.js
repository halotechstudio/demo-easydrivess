import { explainer } from '../ui/explain.js';
import { h, icon, map, dotNumber, scrollNumber, sentence, topbar, adCard, btn, pill, tile, initials, carArt } from '../ui/kit.js';
import { inr, fmtTime, IST, unread } from '../engine/store.js';
import { adSheet } from './sheets.js';
import { managerAccountScreens } from './manager-account.js';
import { places } from '../engine/geo.js';
import { planBatch } from '../engine/batching.js';
import { bookBatch } from '../engine/rides.js';
import { topUp } from '../engine/wallet.js';
import { pickAd, recordImpression, recordClick } from '../engine/ads.js';
import { router, ACTIVE, placeName, greet, isNight } from './common.js';

const H = 3600e3;
const TONES = ['rides', 'aqua', 'lav', 'ember'];
const TONE_HEX = { rides: '#8F8CF2', aqua: '#5EF2C6', lav: '#E9E8FB', ember: '#FF5A45' };

export function createManager(s) {
  const ui = router('home');
  const app = { id: 'manager', ui, company: 'orbit', sel: new Set(), trip: 'in', when: 'now', share: true, team: 'All', adShown: {} };
  const st = () => s.get();
  const co = () => st().companies.find(c => c.id === app.company);
  const staff = () => st().riders.filter(r => r.company === app.company);
  const rides = () => st().rides.filter(r => r.payer === app.company);
  const wallet = () => st().wallets[app.company];

  function ad() {
    if (app.adShown.home) { const a = st().ads.find(x => x.id === app.adShown.home && x.on); return a && adCard(a, () => adSheet(app, s, a)); }
    const a = pickAd(s, 'manager-home', 'mgr-' + app.company); if (!a) return null;
    recordImpression(s, a.id, 'mgr-' + app.company); app.adShown.home = a.id; return adCard(a, () => adSheet(app, s, a));
  }

  function when() {
    const d0 = new Date(st().now + IST); const base = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()) - IST;
    return { now: null, evening: base + 18.5 * H, night: base + 22.5 * H, tomorrow: base + 33 * H }[app.when];
  }
  function plan() {
    const people = staff().filter(r => app.sel.has(r.id));
    const at = when() || st().now;
    const req = people.map(r => app.trip === 'in' ? { id: r.id, pickup: r.home, drop: co().office, gender: r.gender } : { id: r.id, pickup: co().office, drop: r.home, gender: r.gender });
    const opts = { pricing: st().pricing, now: at, night: isNight(at) };
    if (app.share) return planBatch(req, opts);
    // Separate cabs: one car per person, for comparison.
    const solo = req.map(x => planBatch([x], opts));
    const total = solo.reduce((a, p) => a + p.total, 0);
    return { cars: solo.flatMap(p => p.cars), total, separateCost: total, saved: 0, carsSaved: 0, sentence: `${req.length} people, ${req.length} cars. Sharing would save money.` };
  }

  const screens = {
    home() {
      const w = wallet(); const live = rides().filter(r => ACTIVE.includes(r.status)); const sched = rides().filter(r => r.status === 'scheduled');
      const avg = 290; const left = Math.floor(w.balance / avg);
      return [h('div', { class: 'scroll' },
        h('div', { class: 'flex between', style: { padding: '6px 2px 16px' } },
          h('div', null, h('p', { class: 'display' }, `${greet(st().now)},`, h('br'), h('span', { class: 'dim' }, co().manager.split(' ')[0])), h('div', { class: 'label mt8' }, `${co().name} · Admin`)),
          h('div', { class: 'flex', style: { gap: '8px' } }, bell(), h('button', { class: 'avatar lg', 'aria-label': 'Company settings', onclick: () => ui.reset('settings') }, initials(co().manager)))),
        h('div', { class: 'hero money' },
          h('div', { class: 'num-label' }, 'Company wallet'),
          h('div', { class: 'num-row' }, dotNumber('₹' + w.balance.toLocaleString('en-IN'), { size: 6.5, off: false })),
          sentence(left > 5 ? ['Enough for about ', { chip: `${left} rides` }, '. Rides are paid the moment you book.'] : ['Running low. ', { chip: 'Add money' }, ' to keep rides booking.']),
          h('div', { class: 'flex mt12', style: { gap: '8px' } }, btn('Book rides', { arrow: true, onClick: () => { app.sel = new Set(); ui.go('trip'); } }), h('button', { class: 'btn dark', style: { flex: 'none' }, 'aria-label': 'Add money to company wallet', title: 'Add money', onclick: () => ui.go('wallet') }, icon('plus', 18)))),
        h('div', { class: 'tiles mt12' }, tile('Live now', live.length), tile('Scheduled', sched.length), tile('Cars saved today', st().stats.carsSavedToday), tile('Saved today', inr(st().stats.savedToday))),
        live.length > 0 && h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Happening now'), h('button', { class: 'label', onclick: () => ui.reset('rides') }, 'See all')), live.slice(0, 3).map(rideRow)),
        h('div', { class: 'mt12' }, ad())),
      tabbar('home')];
    },

    trip() {
      const opts = [['in', 'Pick up to office', 'Homes to office', 'work'], ['out', 'Drop home', 'Office to homes', 'home']];
      const times = [['now', 'Leave now'], ['evening', 'Today 6:30 PM'], ['night', 'Tonight 10:30 PM'], ['tomorrow', 'Tomorrow 9:00 AM']];
      return [topbar('New booking', { back: ui.back, menu: false, right: pill('1 of 3') }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, 'What kind of trip?')),
            opts.map(([k, t, sub, ic]) => h('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: () => { app.trip = k; ui.dirty(); } },
              h('span', { class: 'ic' }, icon(ic)), h('div', { class: 'grow' }, h('div', { class: 't' }, t), h('div', { class: 's' }, sub)), h('span', { class: `select ${app.trip === k ? 'on' : ''}` }, app.trip === k ? icon('check') : null)))),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, `${app.trip === 'in' ? 'Going to' : 'Leaving from'}`)), h('div', { class: 'row' }, h('span', { class: 'ic' }, icon('work')), h('div', { class: 'grow' }, h('div', { class: 't' }, placeName(co().office)), h('div', { class: 's' }, co().name)), h('span', { class: 'select on' }, icon('check')))),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'When?')),
            h('div', { class: 'tabs-sm wrap', style: { flexWrap: 'wrap' } }, times.map(([k, l]) => h('button', { 'aria-pressed': String(app.when === k), onclick: () => { app.when = k; ui.dirty(); } }, l))))),
        h('div', { class: 'dock' }, btn('Choose people', { arrow: true, onClick: () => ui.go('people') }))];
    },

    people() {
      const teams = ['All', ...new Set(staff().map(r => r.team))];
      const list = staff().filter(r => app.team === 'All' || r.team === app.team);
      const allOn = list.every(r => app.sel.has(r.id));
      return [topbar("Who's riding?", { back: ui.back, menu: false, right: pill('2 of 3') }),
        h('div', { class: 'scroll' },
          h('div', { class: 'tabs-sm' }, teams.map(t => h('button', { 'aria-pressed': String(app.team === t), onclick: () => { app.team = t; ui.dirty(); } }, t))),
          h('div', { class: 'flex between mt12', style: { padding: '0 4px' } }, h('span', { class: 'small' }, `${app.sel.size} selected`), h('button', { class: 'small strong', style: { color: 'var(--lavender)' }, onclick: () => { list.forEach(r => allOn ? app.sel.delete(r.id) : app.sel.add(r.id)); ui.dirty(); } }, allOn ? 'Clear' : 'Select all')),
          h('div', { class: 'card mt8', style: { padding: '4px 14px' } }, list.map(r => h('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: () => { app.sel.has(r.id) ? app.sel.delete(r.id) : app.sel.add(r.id); ui.dirty(); } },
            h('div', { class: 'avatar' }, initials(r.name)), h('div', { class: 'grow' }, h('div', { class: 't' }, r.name), h('div', { class: 's' }, `${r.team} · ${placeName(r.home)}`)), h('span', { class: `select ${app.sel.has(r.id) ? 'on' : ''}` }, app.sel.has(r.id) ? icon('check') : null))))),
        h('div', { class: 'dock' }, btn(app.sel.size ? `See smart plan · ${app.sel.size}` : 'Select at least 1 person', { arrow: true, disabled: !app.sel.size, onClick: () => ui.go('plan') }))];
    },

    plan() {
      const p = plan(); const w = wallet(); const short = !w.postpaid && w.balance < p.total;
      const at = when(); const night = isNight(at || st().now);
      const routes = p.cars.map((c, i) => ({ points: c.points, tone: TONES[i % 4] }));
      const pins = []; p.cars.forEach((c, i) => c.stops.forEach((x, j) => pins.push({ ...places[x.placeId], color: x.placeId === co().office ? '#fff' : TONE_HEX[TONES[i % 4]], n: x.placeId === co().office ? null : j + (app.trip === 'in' ? 1 : 0) })));
      const n = app.sel.size;
      return [topbar('Smart plan', { back: ui.back, menu: false, right: pill('3 of 3') }),
        h('div', { class: 'scroll' },
          h('div', { class: 'hero' },
            h('div', { class: 'num-label' }, `cars for ${n} people`),
            h('div', { class: 'num-row' }, dotNumber(String(p.cars.length), { size: 11, off: false })),
            sentence(p.saved > 0 ? [`Same-route riders share one car. `, { chip: `${inr(p.saved)} saved` }, ` against ${n} separate cabs.`] : [p.sentence])),
          h('div', { class: 'card mt12 flex between' }, h('div', null, h('div', { style: { fontWeight: 500 } }, 'Share cars on the same route'), h('div', { class: 'label' }, 'Detour capped at 20% per person')), h('button', { class: 'toggle', 'aria-pressed': String(app.share), onclick: () => { app.share = !app.share; ui.dirty(); } })),
          h('div', { class: 'mt12' }, map({ height: 190, routes, pins, focus: pins, labels: false })),
          night && h('div', { class: 'card mt12 flex', style: { gap: '12px' } }, h('span', { class: 'ic', style: { color: 'var(--aqua)' } }, icon('shieldcheck')), h('div', { class: 'small' }, 'Night rule applied: a woman is never the first pickup or the last drop when sharing with a male colleague.')),
          p.cars.map((c, i) => h('div', { class: 'card mt12' },
            h('div', { class: 'flex between' }, h('div', { class: 'flex' }, h('span', { style: { width: '10px', height: '10px', borderRadius: '50%', background: TONE_HEX[TONES[i % 4]] } }), h('div', null, h('div', { style: { fontWeight: 600 } }, `Car ${i + 1} · ${c.cls}`), h('div', { class: 'label' }, `${c.riders.length} rider${c.riders.length > 1 ? 's' : ''} · ${c.km} km · ${c.min} min`))), h('div', { class: 'strong' }, inr(c.cost))),
            h('div', { class: 'flex wrap mt8', style: { gap: '6px' } }, c.riders.map(id => pill(st().riders.find(r => r.id === id).name.split(' ')[0])))))),
        h('div', { class: 'dock' },
          short ? h('div', { class: 'card', style: { marginBottom: '8px', background: 'rgba(255,90,69,.12)' } }, h('div', { class: 'small', style: { color: '#FF8A78' } }, `Wallet has ${inr(w.balance)}. Add ${inr(p.total - w.balance)} to book these rides.`)) : null,
          btn(short ? `Add ${inr(Math.ceil((p.total - w.balance) / 1000) * 1000)} and pay` : `Pay ${inr(p.total)} from wallet`, { arrow: true, onClick: () => {
            if (short) topUp(s, app.company, Math.ceil((p.total - w.balance) / 1000) * 1000);
            const res = bookBatch(s, p, { payer: app.company, at: when(), bookedBy: co().manager });
            if (!res.error) { app.sel = new Set(); ui.reset('booked', { n, cars: p.cars.length, total: p.total, saved: p.saved }); }
          } }))];
    },

    booked(p) {
      return [h('div', { class: 'scroll', style: { paddingTop: '20px' } },
        h('p', { class: 'display' }, 'Booked.', h('br'), h('span', { class: 'dim' }, 'Everyone is notified.')),
        h('div', { class: 'hero condition mt16' }, h('div', { class: 'num-label' }, 'cars on the way'), h('div', { class: 'num-row' }, dotNumber(String(p.cars), { size: 11, off: false })),
          sentence([`${p.n} people, ${inr(p.total)} paid. `, p.saved ? { chip: `${inr(p.saved)} saved` } : '', ' Drivers are dispatched automatically.'])),
        h('div', { class: 'tiles mt12' }, tile('Wallet now', inr(wallet().balance)), tile('Cars saved', p.n - p.cars))),
      h('div', { class: 'dock' }, btn('Track rides', { arrow: true, onClick: () => ui.reset('rides') }))];
    },

    rides() {
      const list = rides().filter(r => !r.history).slice(0, 14);
      return [topbar('Rides', { menu: false }),
        h('div', { class: 'scroll' }, h('div', { class: 'card', style: { padding: '4px 14px' } }, list.length ? list.map(rideRow) : h('div', { class: 'small center', style: { padding: '24px 0' } }, 'No rides booked yet.'))),
        tabbar('rides')];
    },

    team() {
      return [topbar('Team', { menu: false }),
        h('div', { class: 'scroll' },
          h('div', { class: 'tiles' }, tile('People', staff().length), tile('Join requests', 1)),
          h('div', { class: 'card mt12', style: { padding: '4px 14px' } }, staff().map(r => h('div', { class: 'row' }, h('div', { class: 'avatar' }, initials(r.name)), h('div', { class: 'grow' }, h('div', { class: 't' }, r.name), h('div', { class: 's' }, `${r.team} · ${placeName(r.home)}`)), pill('Active', 'good'))))),
        tabbar('team')];
    },

  };

  function rideRow(r) {
    const d = st().drivers.find(x => x.id === r.driverId);
    const names = r.riderIds.map(id => st().riders.find(x => x.id === id)?.name.split(' ')[0]).join(', ');
    const label = { finding: 'Finding car', scheduled: fmtTime(r.at), arriving: 'On the way', arrived: 'At pickup', onboard: 'On trip', completed: 'Done', cancelled: 'Cancelled' }[r.status];
    return h('div', { class: 'row' }, h('span', { class: 'ic' }, carArt(r.cls)),
      h('div', { class: 'grow' }, h('div', { class: 't' }, names), h('div', { class: 's' }, d ? `${d.name} · ${st().cars.find(c => c.id === r.carId).plate}` : `${r.cls} · ${placeName(r.drop)}`)),
      pill(label, ['arriving', 'onboard', 'arrived'].includes(r.status) ? 'violet' : r.status === 'completed' ? 'good' : ''));
  }

  function tabbar(cur) {
    return h('div', { class: 'tabbar' }, h('nav', null, [['home', 'home'], ['rides', 'route'], ['wallet', 'wallet'], ['settings', 'settings']].map(([k, ic]) => h('button', { 'aria-label': k, 'aria-pressed': String(cur === k), onclick: () => ui.reset(k) }, icon(ic)))));
  }

  function bell() {
    const n = unread(s, 'manager', app.company);
    return h('button', { class: 'iconbtn', 'aria-label': `Notifications, ${n} unread`, style: { width: '48px', height: '48px' }, onclick: () => ui.go('inbox') }, icon('bell'), n ? h('span', { class: 'badge-led' }, n > 9 ? '9+' : n) : null);
  }
  Object.assign(screens, managerAccountScreens({ s, app, ui, co, staff, wallet, tabbar: (...a) => tabbar(...a) }));
  app.render = () => (screens[ui.screen] || screens.home)(ui.params);
  app.caption = () => `${co().manager} · ${co().name}`;
  app.notifyKey = n => n.app === 'manager' && n.to === app.company;
  app.selectMorningTeam = () => { app.sel = new Set(staff().slice(0, 7).map(r => r.id)); app.trip = 'in'; app.when = 'now'; app.share = true; };
  app.galleryScreens = () => [
    { title: 'Home', screen: 'home' }, { title: 'Trip and time', screen: 'trip' },
    { title: 'Choose people', screen: 'people', before: () => { app._sel = app.sel; app.selectMorningTeam(); }, after: () => { app.sel = app._sel; } },
    { title: 'Smart plan', screen: 'plan', before: () => { app._sel = app.sel; app.selectMorningTeam(); }, after: () => { app.sel = app._sel; } },
    { title: 'Rides', screen: 'rides' }, { title: 'Wallet', screen: 'wallet' },
  ];
  return app;
}
