// Company portal: the manager's desktop web app. Same company, wallet and rides as the Manager phone.
import { h, icon, mark, pill, initials, dotNumber, map, sentence, btn, carArt } from '../ui/kit.js';
import { inr, fmtTime, IST, uid, notify } from '../engine/store.js';
import { places } from '../engine/geo.js';
import { planBatch } from '../engine/batching.js';
import { bookBatch, cancelRide } from '../engine/rides.js';
import { topUp, setAutoTopUp } from '../engine/wallet.js';
import { CLASSES } from '../engine/pricing.js';
import { router, ACTIVE, placeName, isNight } from './common.js';
import { openSheet, closeSheet, flash, callSheet } from './sheets.js';
import { webBell, webToast } from './ops.js';
import { led } from '../ui/fx.js';
import { explainer } from '../ui/explain.js';

const H = 3600e3;
const TONES = ['rides', 'aqua', 'lav', 'ember']; const HEX = { rides: '#8F8CF2', aqua: '#5EF2C6', lav: '#E9E8FB', ember: '#FF5A45' };
const STATUS = { finding: ['Finding car', ''], scheduled: ['Scheduled', ''], arriving: ['On the way', 'violet'], arrived: ['At pickup', 'violet'], onboard: ['On trip', 'violet'], completed: ['Done', 'good'], cancelled: ['Cancelled', 'alert'] };
const toggle = (on, fn, label) => h('button', { class: 'toggle', 'aria-pressed': String(!!on), 'aria-label': label, onclick: fn });

export function createManagerWeb(s) {
  const ui = router('overview');
  const app = { id: 'mweb', ui, company: 'orbit', sel: new Set(), trip: 'in', when: 'now', share: true, team: 'All', q: '', tf: 'all', bellOpen: false };
  const st = () => s.get();
  const co = () => st().companies.find(c => c.id === app.company);
  const staff = () => st().riders.filter(r => r.company === app.company);
  const rides = () => st().rides.filter(r => r.payer === app.company && !r.history);
  const wallet = () => st().wallets[app.company];
  const kpi = (k, v, d, tone) => h('div', { class: 'panel kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k), d && h('div', { class: 'd', style: tone ? { color: tone } : null }, d));
  const head = (t1, t2, p, right) => h('div', { class: 'page-head' }, h('div', null, h('h2', null, t1, h('br'), h('span', { class: 'dim' }, t2)), p && h('p', null, p)), right);
  const names = r => r.riderIds.map(id => st().riders.find(x => x.id === id)?.name.split(' ')[0]).join(', ');

  function whenAt() {
    const d0 = new Date(st().now + IST); const base = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()) - IST;
    return { now: null, evening: base + 18.5 * H, night: base + 22.5 * H, tomorrow: base + 33 * H }[app.when];
  }
  function plan() {
    const at = whenAt() || st().now;
    const req = staff().filter(r => app.sel.has(r.id)).map(r => app.trip === 'in' ? { id: r.id, pickup: r.home, drop: co().office, gender: r.gender } : { id: r.id, pickup: co().office, drop: r.home, gender: r.gender });
    const opts = { pricing: st().pricing, now: at, night: isNight(at) };
    if (app.share) return planBatch(req, opts);
    const solo = req.map(x => planBatch([x], opts)); const total = solo.reduce((a, p) => a + p.total, 0);
    return { cars: solo.flatMap(p => p.cars), total, separateCost: total, saved: 0, carsSaved: 0, sentence: `${req.length} people, ${req.length} cars.` };
  }
  function addMoney() {
    const f = { amt: 25000, method: 'Net banking' };
    openSheet(app, { title: 'Add money', sub: `${co().name} wallet · balance ${inr(wallet().balance)}`, body: () => [
      h('input', { class: 'amount-in', type: 'number', value: f.amt, oninput: e => { f.amt = Math.max(0, Number(e.target.value) || 0); } }),
      h('div', { class: 'tabs-sm', style: { justifyContent: 'center' } }, [10000, 25000, 50000, 100000].map(a => h('button', { 'aria-pressed': String(f.amt === a), onclick: () => { f.amt = a; ui.dirty(); } }, inr(a)))),
      h('div', { class: 'seg2 mt16' }, ['UPI', 'Net banking', 'Card', 'Bank transfer'].map(m => h('button', { 'aria-pressed': String(f.method === m), onclick: () => { f.method = m; ui.dirty(); } }, m))),
      h('div', { class: 'mt16' }, btn(`Add ${inr(f.amt)} by ${f.method}`, { kind: 'primary', arrow: true, disabled: f.amt < 1000, onClick: () => { topUp(s, app.company, f.amt, f.method); closeSheet(app); flash(app, 'Money added', `${inr(f.amt)} by ${f.method}.`); } })),
    ] });
  }

  const pages = {
    overview() {
      const w = wallet(); const live = rides().filter(r => ACTIVE.includes(r.status)); const sched = rides().filter(r => r.status === 'scheduled');
      const spent = st().ledger.filter(e => e.wallet === app.company && e.kind === 'fare').reduce((a, e) => a + e.amount, 0);
      const cars = live.map(r => st().drivers.find(d => d.id === r.driverId)).filter(Boolean).map(d => ({ ...d.pos, color: '#8F8CF2', label: d.name.split(' ')[0] }));
      const routes = live.filter(r => r.points?.length).map((r, i) => ({ points: r.status === 'arriving' && r.approach ? r.approach.points : r.points, tone: TONES[i % 4], dashed: r.status === 'arriving' }));
      return [head(`Good ${new Date(st().now + IST).getUTCHours() < 12 ? 'morning' : 'afternoon'}, ${co().manager.split(' ')[0]}.`, `${co().name} commute, live.`, 'Book for the team, watch every car, and keep the wallet topped up.',
        h('button', { class: 'btn primary sm', onclick: () => ui.reset('book') }, icon('plus', 16), 'Book rides')),
        h('div', { class: 'wgrid hero-split' },
          h('div', { class: 'hero money', style: { borderRadius: '22px', padding: '22px' } },
            h('div', { class: 'num-label', style: { textAlign: 'left' } }, 'Company wallet'),
            h('div', { class: 'num-row', style: { justifyContent: 'flex-start' } }, dotNumber('₹' + w.balance.toLocaleString('en-IN'), { size: 6.5, off: false, fit: 330 })),
            h('p', { class: 'sentence', style: { textAlign: 'left' } }, `About ${Math.floor(w.balance / 290)} rides left. Auto top-up `, h('span', { class: 'chip' }, w.auto?.on ? 'on' : 'off'), '. Spent today ', h('span', { class: 'chip' }, inr(spent)), '.'),
            h('div', { class: 'flex mt16' }, h('button', { class: 'btn primary sm', onclick: addMoney }, icon('plus', 15), 'Add money'), h('button', { class: 'btn dark sm', onclick: () => ui.reset('wallet') }, 'Wallet'))),
          h('div', { class: 'panel', style: { padding: 0, overflow: 'hidden' } }, map({ height: 300, cars, routes, allPlaces: true }),
            h('div', { style: { position: 'absolute', top: '14px', left: '16px' }, class: 'flex' }, pill(`${live.length} live`, live.length ? 'good' : ''), h('span', { class: 'label' }, `${sched.length} scheduled`)))),
        h('div', { class: 'wgrid c4 mt16' }, kpi('Live rides', live.length, live.length ? 'Tracked on the map' : 'None right now'), kpi('Scheduled', sched.length), kpi('Cars saved today', st().stats.carsSavedToday, inr(st().stats.savedToday) + ' saved'), kpi('Team', staff().length, '1 join request', 'var(--amber)')),
        h('div', { class: 'panel mt16' }, h('h3', null, 'Rides now'), live.length ? table(live) : h('div', { class: 'label' }, 'No cars on the road. Book rides to see them here live.'))];
    },

    book() {
      const teams = ['All', ...new Set(staff().map(r => r.team))];
      const list = staff().filter(r => (app.team === 'All' || r.team === app.team) && r.name.toLowerCase().includes(app.q.toLowerCase()));
      const p = app.sel.size ? plan() : null; const w = wallet(); const short = p && w.balance < p.total;
      const routes = p ? p.cars.map((c, i) => ({ points: c.points, tone: TONES[i % 4] })) : [];
      const pins = p ? p.cars.flatMap((c, i) => c.stops.map((x, j) => ({ ...places[x.placeId], color: x.placeId === co().office ? '#fff' : HEX[TONES[i % 4]], n: x.placeId === co().office ? null : j + (app.trip === 'in' ? 1 : 0) }))) : [];
      const times = [['now', 'Leave now'], ['evening', 'Today 6:30 PM'], ['night', 'Tonight 10:30 PM'], ['tomorrow', 'Tomorrow 9:00 AM']];
      return [head('Book rides', 'for the whole team.', 'Pick the trip, select people, and the smart plan groups them into the fewest cars.'),
        h('div', { class: 'wgrid', style: { gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)' } },
          h('div', null,
            h('div', { class: 'panel' }, h('h3', null, 'Trip and time'),
              h('div', { class: 'seg2' }, [['in', 'Pick up to office'], ['out', 'Drop home']].map(([k, l]) => h('button', { 'aria-pressed': String(app.trip === k), onclick: () => { app.trip = k; ui.dirty(); } }, l))),
              h('div', { class: 'tabs-sm mt12', style: { flexWrap: 'wrap' } }, times.map(([k, l]) => h('button', { 'aria-pressed': String(app.when === k), onclick: () => { app.when = k; ui.dirty(); } }, l)))),
            h('div', { class: 'panel mt16' }, h('h3', null, `People · ${app.sel.size} selected`, h('button', { class: 'label', style: { color: 'var(--lavender)' }, onclick: () => { const all = list.every(r => app.sel.has(r.id)); list.forEach(r => all ? app.sel.delete(r.id) : app.sel.add(r.id)); ui.dirty(); } }, list.every(r => app.sel.has(r.id)) ? 'Clear' : 'Select all')),
              h('div', { class: 'flex', style: { gap: '8px' } }, h('input', { class: 'input', placeholder: 'Search people', value: app.q, oninput: e => { app.q = e.target.value; }, onchange: () => ui.dirty() }), h('div', { class: 'tabs-sm' }, teams.map(t => h('button', { 'aria-pressed': String(app.team === t), onclick: () => { app.team = t; ui.dirty(); } }, t)))),
              h('div', { class: 'mt8' }, list.map(r => h('button', { class: 'set', onclick: () => { app.sel.has(r.id) ? app.sel.delete(r.id) : app.sel.add(r.id); ui.dirty(); } },
                h('div', { class: 'avatar', style: { width: '32px', height: '32px', fontSize: '11.5px' } }, initials(r.name)), h('span', { class: 'grow' }, h('b', null, r.name), h('small', null, `${r.team} · ${placeName(r.home)}`)), h('span', { class: `select ${app.sel.has(r.id) ? 'on' : ''}` }, app.sel.has(r.id) ? icon('check') : null)))))),
          h('div', null,
            p ? [
              h('div', { class: 'hero', style: { borderRadius: '22px' } }, h('div', { class: 'num-label' }, `cars for ${app.sel.size} people`), h('div', { class: 'num-row' }, dotNumber(String(p.cars.length), { size: 10, off: false })),
                sentence(p.saved > 0 ? ['Same-route riders share one car. ', { chip: `${inr(p.saved)} saved` }, ` against ${app.sel.size} separate cabs.`] : [p.sentence])),
              h('div', { class: 'panel mt16 flex between' }, h('div', null, h('b', { style: { fontWeight: 500 } }, 'Share cars on the same route'), h('div', { class: 'label' }, 'Detour capped at 20% per person')), toggle(app.share, () => { app.share = !app.share; ui.dirty(); }, 'Share')),
              h('div', { class: 'panel mt16', style: { padding: 0, overflow: 'hidden' } }, map({ height: 260, routes, pins, focus: pins, labels: true })),
              h('div', { class: 'wgrid c2 mt16' }, p.cars.map((c, i) => h('div', { class: 'panel' }, h('div', { class: 'flex between' }, h('div', { class: 'flex' }, h('span', { style: { width: '10px', height: '10px', borderRadius: '50%', background: HEX[TONES[i % 4]] } }), h('b', { style: { fontWeight: 600 } }, `Car ${i + 1} · ${c.cls}`)), h('b', null, inr(c.cost))),
                h('div', { class: 'label mt8' }, `${c.riders.length} rider${c.riders.length > 1 ? 's' : ''} · ${c.km} km · ${c.min} min`), h('div', { class: 'flex wrap mt8', style: { gap: '6px' } }, c.riders.map(id => pill(st().riders.find(r => r.id === id).name.split(' ')[0])))))),
              h('div', { class: 'panel mt16 flex between' }, h('div', null, h('div', { style: { fontSize: '22px', fontWeight: 600 } }, inr(p.total)), h('div', { class: 'label' }, short ? `Wallet has ${inr(w.balance)}; we add the difference first.` : `From wallet · ${inr(w.balance - p.total)} left after`)),
                h('button', { class: 'btn violet', onclick: () => { if (short) topUp(s, app.company, Math.ceil((p.total - w.balance) / 1000) * 1000, 'Net banking'); const res = bookBatch(s, p, { payer: app.company, at: whenAt(), bookedBy: co().manager }); if (!res.error) { app.sel = new Set(); flash(app, 'Booked', `${p.cars.length} cars for ${p.cars.reduce((a, c) => a + c.riders.length, 0)} people. Everyone is notified.`); ui.reset('rides'); } } }, short ? `Add money and pay ${inr(p.total)}` : `Pay ${inr(p.total)} and book`)),
            ] : [explainer(app, 'pool', { force: true }), h('div', { class: 'panel mt16 label' }, 'Select people on the left to see the smart plan.')]))];
    },

    rides() {
      const f = app.rf || 'live'; const all = rides();
      const list = all.filter(r => f === 'live' ? ACTIVE.includes(r.status) : f === 'scheduled' ? r.status === 'scheduled' : !ACTIVE.includes(r.status) && r.status !== 'scheduled');
      return [head('Rides', 'every car, every person.', null, h('div', { class: 'tabs-sm' }, [['live', `Live · ${all.filter(r => ACTIVE.includes(r.status)).length}`], ['scheduled', `Scheduled · ${all.filter(r => r.status === 'scheduled').length}`], ['past', 'Past']].map(([k, l]) => h('button', { 'aria-pressed': String(f === k), onclick: () => { app.rf = k; ui.dirty(); } }, l)))),
        h('div', { class: 'panel' }, list.length ? table(list, true) : h('div', { class: 'label' }, 'Nothing here.'))];
    },

    team() {
      return [head('Team', `${staff().length} people.`, 'Add people one by one, from a sheet, or share the company code. They sign in with the same number.',
        h('div', { class: 'flex' }, h('button', { class: 'btn dark sm', onclick: () => flash(app, 'Company code', 'ORBIT-4821 · share it, new joiners wait for your approval.', 'info') }, 'Company code'), h('button', { class: 'btn primary sm', onclick: addPerson }, icon('plus', 15), 'Add person'))),
        h('div', { class: 'panel', style: { background: 'rgba(255,181,71,.08)' } }, h('div', { class: 'flex between' }, h('div', { class: 'flex' }, led('var(--amber)', true), h('div', null, h('b', { style: { fontWeight: 500 } }, 'Nikhil Jain wants to join'), h('div', { class: 'label' }, '+91 98801 10140 · used the company code'))),
          app.joined ? pill('Approved', 'good') : h('div', { class: 'flex' }, h('button', { class: 'btn dark sm', onclick: () => { app.joined = 'no'; flash(app, 'Declined', 'Nikhil was told by SMS.', 'info'); } }, 'Decline'), h('button', { class: 'btn primary sm', onclick: () => { app.joined = true; st().riders.push({ id: 'e16', name: 'Nikhil Jain', gender: 'm', home: 'kukatpally', company: app.company, team: 'Engineering', phone: '+91 98801 10140', saved: [], contact: { name: 'Family', phone: '' }, contacts: [], prefs: { notify: {} }, rating: 5 }); flash(app, 'Approved', 'Nikhil can now be booked.'); } }, 'Approve')))),
        h('div', { class: 'panel mt16' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Person', 'Team', 'Home', 'Phone', 'Rides this month', ''].map(x => h('th', null, x)))),
          h('tbody', null, staff().map((r, i) => h('tr', null, h('td', null, h('div', { class: 'flex' }, h('div', { class: 'avatar', style: { width: '30px', height: '30px', fontSize: '11px' } }, initials(r.name)), r.name)), h('td', null, r.team), h('td', null, placeName(r.home)), h('td', { class: 'label' }, r.phone), h('td', null, 14 + (i * 7) % 11),
            h('td', null, h('button', { class: 'btn dark sm', onclick: () => { app.sel = new Set([r.id]); ui.reset('book'); } }, 'Book')))))))];
    },

    wallet() {
      const w = wallet(); const f = app.tf;
      const tx = st().ledger.filter(e => e.wallet === app.company && (f === 'all' || (f === 'rides' ? e.kind === 'fare' : f === 'added' ? e.kind === 'topup' : e.kind === 'refund')));
      const budgets = st().budgets?.[app.company] || [];
      return [head('Wallet', 'prepaid, GST invoiced.', 'Rides are paid the moment you book. Cancel before pickup and the fare comes straight back.', h('button', { class: 'btn primary sm', onclick: addMoney }, icon('plus', 15), 'Add money')),
        h('div', { class: 'wgrid hero-split' },
          h('div', { class: 'hero money', style: { borderRadius: '22px', padding: '22px' } }, h('div', { class: 'num-label' }, 'Balance'), h('div', { class: 'num-row' }, dotNumber('₹' + w.balance.toLocaleString('en-IN'), { size: 6.5, off: false, fit: 330 })),
            sentence(['Bank transfer to ', { chip: w.va.account }, ` · ${w.va.ifsc}, credited automatically.`])),
          h('div', { class: 'panel' }, h('h3', null, 'Auto top-up', toggle(w.auto?.on, () => setAutoTopUp(s, app.company, { on: !w.auto.on }), 'Auto top-up')),
            h('div', { class: 'label' }, 'Add'), h('div', { class: 'seg2 mt8' }, [10000, 25000, 50000].map(a => h('button', { 'aria-pressed': String(w.auto.amount === a), onclick: () => setAutoTopUp(s, app.company, { amount: a }) }, inr(a)))),
            h('div', { class: 'label mt12' }, 'When balance drops below'), h('div', { class: 'seg2 mt8' }, [2000, 5000, 10000].map(a => h('button', { 'aria-pressed': String(w.auto.below === a), onclick: () => setAutoTopUp(s, app.company, { below: a }) }, inr(a)))))),
        h('div', { class: 'wgrid c2 mt16' },
          h('div', { class: 'panel' }, h('h3', null, 'Team budgets · this month'), budgets.map(b => { const pct = Math.min(100, b.spent / b.limit * 100); return h('div', { style: { padding: '7px 0' } }, h('div', { class: 'flex between' }, h('span', null, b.team), h('span', { class: 'label' }, `${inr(b.spent)} of ${inr(b.limit)}`)),
            h('div', { style: { height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,.08)', marginTop: '6px' } }, h('div', { style: { width: pct + '%', height: '100%', borderRadius: '3px', background: pct > 85 ? 'var(--ember)' : pct > 60 ? 'var(--amber)' : 'var(--aqua)' } }))); })),
          h('div', { class: 'panel' }, h('h3', null, 'Transactions', h('div', { class: 'tabs-sm' }, [['all', 'All'], ['rides', 'Rides'], ['added', 'Added'], ['refunds', 'Refunds']].map(([k, l]) => h('button', { 'aria-pressed': String(f === k), onclick: () => { app.tf = k; ui.dirty(); } }, l)))),
            h('table', { class: 't' }, h('tbody', null, tx.slice(0, 9).map(e => h('tr', null, h('td', { class: 'label' }, fmtTime(e.at)), h('td', null, e.note), h('td', { class: 'num', style: { color: e.kind === 'fare' ? 'var(--fg)' : 'var(--aqua)' } }, `${e.kind === 'fare' ? '−' : '+'}${inr(Math.abs(e.amount))}`))))))),
        h('div', { class: 'panel mt16' }, h('h3', null, 'Invoices'), [['November 2026', 'Running', 64210], ['October 2026', 'Paid', 182400], ['September 2026', 'Paid', 171930]].map(([m, sts, a]) => h('div', { class: 'row' }, icon('doc', 18), h('div', { class: 'grow t' }, m), h('span', { class: 'label' }, inr(a)), pill(sts, sts === 'Paid' ? 'good' : 'violet'), h('button', { class: 'btn dark sm', onclick: () => flash(app, 'Downloading', `${m} invoice, PDF and Excel.`, 'info') }, 'Download'))))];
    },

    reports() {
      const budgets = st().budgets?.[app.company] || []; const max = Math.max(...budgets.map(b => b.spent));
      return [head('Reports', 'where the commute money goes.', null, h('button', { class: 'btn dark sm', onclick: () => flash(app, 'Exported', 'November report sent to your email as Excel.', 'info') }, icon('upload', 15), 'Export')),
        h('div', { class: 'wgrid c4' }, kpi('Spent this month', inr(budgets.reduce((a, b) => a + b.spent, 0))), kpi('Saved by sharing', inr(st().stats.savedToday + 21600), 'vs separate cabs', 'var(--aqua)'), kpi('Avg per ride', inr(286)), kpi('On-time pickups', '96%', 'last 30 days', 'var(--aqua)')),
        h('div', { class: 'panel mt16' }, h('h3', null, 'Spend by team'), h('div', { class: 'bars', style: { height: '180px' } }, budgets.map(b => h('div', { class: `b ${b.spent === max ? 'hi' : ''}` }, h('span', { class: 'label', style: { color: 'var(--fg-2)' } }, inr(b.spent)), h('i', { style: { height: `${b.spent / max * 100}%` } }), h('span', null, b.team)))))];
    },

    policy() {
      const pol = st().policies[app.company];
      return [head('Ride policy', 'rules for every booking.', 'Applies to the Manager app, this portal and employees using their Work profile.'),
        h('div', { class: 'wgrid c2' },
          h('div', { class: 'panel' }, h('h3', null, 'Cars allowed'), h('div', { class: 'seg2' }, CLASSES.map(c => h('button', { 'aria-pressed': String(pol.classes.includes(c)), onclick: () => { pol.classes = pol.classes.includes(c) ? pol.classes.filter(x => x !== c) : [...pol.classes, c]; ui.dirty(); } }, c))),
            h('div', { class: 'label mt16' }, `Fare limit per ride · ${inr(pol.maxFare)}`), h('input', { type: 'range', min: 500, max: 5000, step: 100, value: pol.maxFare, oninput: e => { pol.maxFare = Number(e.target.value); }, onchange: () => ui.dirty() }),
            h('div', { class: 'label mt12' }, `Needs approval above · ${inr(pol.approvalAbove)}`), h('input', { type: 'range', min: 300, max: 3000, step: 100, value: pol.approvalAbove, oninput: e => { pol.approvalAbove = Number(e.target.value); }, onchange: () => ui.dirty() })),
          h('div', { class: 'panel' }, h('h3', null, 'Safety and sharing'), [['shareByDefault', 'Share cars by default'], ['nightRule', 'Night safety rule'], ['weekendRides', 'Weekend rides']].map(([k, t]) => h('div', { class: 'row' }, h('div', { class: 'grow t' }, t), toggle(pol[k], () => { pol[k] = !pol[k]; ui.dirty(); }, t))))),
        h('div', { class: 'panel mt16 flex between' }, h('div', null, h('b', { style: { fontWeight: 500 } }, 'Account manager'), h('div', { class: 'label' }, 'Easydrivess corporate desk, 9 AM to 9 PM')), h('button', { class: 'btn dark sm', onclick: () => callSheet(app, { name: 'Corporate desk', role: 'Your account manager' }) }, icon('phone', 15), 'Call'))];
    },
  };

  function table(list, actions) {
    return h('table', { class: 't' }, h('thead', null, h('tr', null, ['Ride', 'People', 'Route', 'Car', 'Driver', 'Status', 'Fare', actions ? '' : null].filter(x => x != null).map(x => h('th', { class: x === 'Fare' ? 'num' : '' }, x)))),
      h('tbody', null, list.slice(0, 20).map(r => { const d = st().drivers.find(x => x.id === r.driverId); const c = st().cars.find(x => x.id === r.carId);
        return h('tr', null, h('td', { class: 'label' }, r.id), h('td', null, names(r)), h('td', null, `${placeName(r.stops[0]?.placeId || r.pickup)} → ${placeName(r.drop)}`), h('td', null, h('span', { class: 'flex', style: { gap: '6px' } }, h('span', { style: { width: '38px', color: 'var(--fg-2)' } }, carArt(r.cls)), r.cls)),
          h('td', null, d ? `${d.name} · ${c.plate}` : h('span', { class: 'label' }, r.status === 'scheduled' ? fmtTime(r.at) : '—')), h('td', null, pill(...STATUS[r.status])), h('td', { class: 'num' }, inr(r.fare)),
          actions && h('td', null, ['scheduled', 'finding', 'arriving'].includes(r.status) ? h('button', { class: 'btn dark sm', onclick: () => { cancelRide(s, r.id, 'manager'); flash(app, 'Cancelled', `${inr(r.fare)} back in the wallet.`); } }, 'Cancel') : d && ACTIVE.includes(r.status) ? h('button', { class: 'btn dark sm', onclick: () => callSheet(app, { name: d.name, role: 'Driver' }) }, 'Call') : null));
      })));
  }

  function addPerson() {
    const f = { name: '', phone: '+91 ', team: 'Engineering', home: 'madhapur' };
    openSheet(app, { title: 'Add a person', sub: 'They get an SMS with the app link and sign in with this number.', body: () => [
      h('input', { class: 'input', placeholder: 'Full name', value: f.name, oninput: e => { f.name = e.target.value; } }),
      h('input', { class: 'input mt8', placeholder: 'Mobile', value: f.phone, oninput: e => { f.phone = e.target.value; } }),
      h('div', { class: 'tabs-sm mt12', style: { flexWrap: 'wrap' } }, ['Engineering', 'Design', 'Finance', 'Sales', 'HR', 'Product'].map(t => h('button', { 'aria-pressed': String(f.team === t), onclick: () => { f.team = t; ui.dirty(); } }, t))),
      h('div', { class: 'mt16' }, btn('Add and send invite', { kind: 'primary', onClick: () => {
        if (!f.name.trim() || f.phone.replace(/\D/g, '').length < 12) { flash(app, 'Add a name and a 10-digit number', '', 'warn'); return; }
        st().riders.push({ id: uid(s, 'e'), name: f.name.trim(), gender: 'x', home: f.home, company: app.company, team: f.team, phone: f.phone, saved: [], contact: { name: 'Family', phone: '' }, contacts: [], prefs: { notify: {} }, rating: 5 });
        closeSheet(app); flash(app, 'Invite sent', `${f.name} can be booked now.`);
      } })),
    ] });
  }

  const NAV = [['overview', 'Overview', 'grid'], ['book', 'Book rides', 'plus'], ['rides', 'Rides', 'route'], ['team', 'Team', 'users'], ['wallet', 'Wallet', 'wallet'], ['reports', 'Reports', 'chart'], ['policy', 'Policy', 'settings']];
  app.render = () => {
    const live = rides().filter(r => ACTIVE.includes(r.status)).length;
    return h('div', { class: 'webapp', style: { flex: 1, minHeight: 0 } },
      h('aside', { class: 'side' }, h('div', { class: 'brand' }, mark('violet'), h('span', null, 'Easydrivess', h('small', null, `${co().name} · Business`))),
        NAV.map(([k, l, ic]) => h('button', { 'aria-pressed': String(ui.screen === k), onclick: () => ui.reset(k) }, icon(ic), h('span', { class: 'lbl' }, l), k === 'rides' && live ? h('span', { class: 'count', style: { background: 'var(--majorelle)' } }, live) : null)),
        h('div', { style: { marginTop: 'auto', padding: '12px 8px 0' }, class: 'flex' }, h('div', { class: 'avatar', style: { width: '32px', height: '32px', fontSize: '11px' } }, initials(co().manager)), h('div', { class: 'lbl' }, h('div', { style: { fontSize: '13px' } }, co().manager), h('div', { class: 'label' }, 'Admin')))),
      h('div', { class: 'main', style: { position: 'relative' } }, webBell(s, app, 'manager', app.company), (pages[ui.screen] || pages.overview)()),
      app.toast && app.toast.until > performance.now() && webToast(app.toast.n));
  };
  app.notifyKey = n => n.app === 'manager' && n.to === app.company && ['alert', 'warn', 'good'].includes(n.tone);
  return app;
}
