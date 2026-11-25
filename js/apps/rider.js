import { explainer, animIcon, featureHero } from '../ui/explain.js';
import { h, icon, map, scrollNumber, dotNumber, sentence, topbar, adCard, btn, carArt, pill, initials, tile } from '../ui/kit.js';
import { inr, fmtTime, IST, unread } from '../engine/store.js';
import { places, placeList, route } from '../engine/geo.js';
import { CLASSES, SEATS, BAGS, conditionScore } from '../engine/pricing.js';
import { bookRide, estimate, cancelRide, rateRide, materialiseTemplates } from '../engine/rides.js';
import { pickAd, recordImpression, recordClick } from '../engine/ads.js';
import { charge } from '../engine/wallet.js';
import { callSheet, chatSheet, shareSheet, menuSheet, adSheet, flash, openSheet, closeSheet } from './sheets.js';
import { profileScreens, walletScreen, inboxScreen, payMethodSheet, payLabel, topUpSheet } from './rider-account.js';
import { raiseAlert, closeAlert } from '../engine/safety.js';
import { router, ACTIVE, placeName, etaFor, driverCard, stopList, mapForRide, greet } from './common.js';

const H = 3600e3;

export function createRider(s) {
  const ui = router('home');
  const app = { id: 'rider', ui, who: 'r1', profile: 'personal', lastCls: 'Sedan', adShown: {} };
  const me = () => s.get().riders.find(r => r.id === app.who);
  const myRides = () => s.get().rides.filter(r => r.riderIds.includes(app.who));
  const active = () => myRides().find(r => ACTIVE.includes(r.status));
  const unrated = () => myRides().find(r => r.status === 'completed' && !r.rating && !r.history && s.get().now - r.completedAt < 45 * 60e3);
  const work = () => app.profile === 'work' && (me().company || me().workCompany);
  const here = () => me().company ? me().home : 'jubilee';

  // Show an ad once per screen visit (impression counted once).
  function ad(slot, key) {
    const k = `${slot}:${key}`;
    if (app.adShown[k]) { const a = s.get().ads.find(x => x.id === app.adShown[k] && x.on); return a && adCard(a, () => adSheet(app, s, a)); }
    const a = pickAd(s, slot, app.who); if (!a) return null;
    recordImpression(s, a.id, app.who); app.adShown[k] = a.id;
    return adCard(a, () => adSheet(app, s, a));
  }

  function book(params, cls, fare) {
    const st = s.get();
    const company = work();
    // Work rides are paid from the company wallet first; no money, no booking.
    if (company && charge(s, company, fare, 'work ride', `Work ride · ${placeName(params.pickup)} to ${placeName(params.drop)}`) !== 'ok') { app.err = `${st.companies.find(c => c.id === company).name} wallet is low. Ask your manager to add money, or switch to Personal.`; ui.dirty(); return; }
    // Personal rides: Easydrivess Money is charged up front; UPI and cash are settled at the end.
    const method = company ? 'company' : me().payMethod;
    if (method === 'wallet' && charge(s, app.who, fare, 'ride', `Ride · ${placeName(params.pickup)} to ${placeName(params.drop)}`) !== 'ok') {
      app.err = `Easydrivess Money has ${inr(s.get().wallets[app.who].balance)}. Add money or pay by UPI.`; app.errAction = 'topup'; ui.dirty(); return;
    }
    app.errAction = null;
    app.err = null;
    // Round trips are priced as a package, so the fare is fixed rather than re-quoted per car.
    const id = bookRide(s, { riderId: app.who, pickup: params.pickup, drop: params.drop, cls, trip: params.trip || 'city', channel: company ? 'corporate' : 'app', payer: company || (method === 'wallet' ? app.who : 'self'), method, at: params.at || null, flight: params.flight || null, fare, quoted: fare != null && !params.round });
    if (params.repeat) {
      const d = new Date((params.at || st.now) + IST);
      st.templates.push({ id: `T${st.templates.length + 1}`, riderId: app.who, pickup: params.pickup, drop: params.drop, cls, days: [1, 2, 3, 4, 5], time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`, payer: company || 'self', label: `${placeName(params.pickup)} to ${placeName(params.drop)}`, lastDay: null });
      st.templates.at(-1).lastDay = 'booked-today';
    }
    app.lastCls = cls;
    ui.reset(params.at && params.at - st.now > 20 * 60e3 ? 'home' : 'ride', { id });
  }

  // ------------- Screens -------------
  const screens = {
    home() {
      const st = s.get(); const r = me();
      const act = active(); const done = unrated();
      if (act || done) return screens.ride({ id: (act || done).id });
      const upcoming = myRides().filter(x => x.status === 'scheduled').sort((a, b) => a.at - b.at);
      const next = upcoming[0];
      const rebook = { pickup: here(), drop: r.company ? r.company : 'hitec' };
      const rbEst = estimate(s, { ...rebook, cls: app.lastCls });
      return [
        h('div', { class: 'scroll', 'data-key': 'rider-home' },
          h('div', { class: 'flex between', style: { padding: '6px 2px 18px' } },
            h('div', null, h('p', { class: 'display' }, `${greet(st.now)},`, h('br'), h('span', { class: 'dim' }, r.name.split(' ')[0]))),
            h('div', { class: 'flex', style: { gap: '8px' } },
              bell(),
              h('button', { class: 'avatar lg', 'aria-label': 'Profile', onclick: () => ui.reset('profile') }, initials(r.name)))),
          // Where to: highlighted widget first in the stack, with the original saved-place chips under it.
          h('div', { class: 'where-panel', style: { marginBottom: '12px' } },
            h('button', { class: 'searchbar hi', onclick: () => ui.go('where', { pickup: here() }) },
              h('span', { class: 'sb-ic' }, icon('search')), h('span', { class: 'grow' }, h('b', null, 'Where to?'), h('small', null, `From ${placeName(here())} · current location`)),
              h('span', { class: 'sb-now', onclick: e => { e.stopPropagation(); ui.go('schedule', { pickup: here() }); } }, icon('clock', 14), 'Now')),
            h('div', { class: 'saved' }, r.saved.filter(x => x.place !== here()).map(x => h('button', { onclick: () => ui.go('book', { pickup: here(), drop: x.place, trip: x.place === 'rgia' ? 'airport' : 'city' }) }, icon(x.label === 'Home' ? 'home' : x.label === 'Airport' ? 'plane' : 'work'), x.label)))),
          !work() && s.get().wallets[app.who] && h('button', { class: 'card flex', style: { width: '100%', textAlign: 'left', gap: '12px', marginBottom: '10px', padding: '12px 14px' }, onclick: () => ui.reset('wallet') },
            h('span', { class: 'ic' }, icon('wallet')), h('span', { class: 'grow' }, h('div', { class: 'label' }, 'Easydrivess Money'), h('div', { style: { fontWeight: 600, fontSize: '16px' } }, inr(s.get().wallets[app.who].balance))),
            h('span', { class: 'btn dark sm', onclick: e => { e.stopPropagation(); topUpSheet(app, s, app.who); } }, icon('plus', 15), 'Add')),
          (r.company || r.workCompany) && h('div', { class: 'tabs-sm', style: { marginBottom: '12px' } },
            ['personal', 'work'].map(p => h('button', { 'aria-pressed': String(app.profile === p), onclick: () => { app.profile = p; ui.dirty(); } }, p === 'personal' ? 'Personal' : `Work · ${st.companies.find(c => c.id === (r.company || r.workCompany)).name}`))),
          // Live feature carousel: each frame is real data for one feature; tap opens the one on screen.
          (() => {
            const cls = me().prefs?.cls || app.lastCls; const eta = etaFor(s, cls, rebook.pickup);
            const near = st.drivers.filter(d => d.online && !d.busy).length;
            const air = estimate(s, { pickup: here(), drop: 'rgia', cls, trip: 'airport' });
            const ic = estimate(s, { pickup: here(), drop: 'vijayawada', cls: 'SUV', trip: 'intercity' });
            const w = st.wallets[app.who]; const top = upcoming[0];
            const frames = [
              { label: eta != null ? `A ${cls} can be at your door in` : `No ${cls} free nearby`, num: eta != null ? String(eta) : '--', unit: 'min', sent: [`${near} cars free around ${placeName(rebook.pickup)}. To ${placeName(rebook.drop)} `, { chip: inr(rbEst.fare) }, ', tap to book.'], go: () => ui.go('book', { pickup: rebook.pickup, drop: rebook.drop, trip: 'city' }) },
              { label: 'Airport drop to RGIA', num: inr(air.fare).replace(/,/g, ','), unit: `${air.min} min · flight tracked`, sent: ['We plan around your flight and wait ', { chip: '45 min free' }, ' on pickups.'], go: () => ui.go('airport', { pickup: here() }) },
              { label: 'Intercity · Vijayawada', num: '275', unit: 'km door to door', sent: ['SUV one way from ', { chip: inr(ic.fare) }, '. Round trips with the same driver.'], go: () => ui.go('intercity', { pickup: here() }) },
              { label: top ? `${top.templateId ? 'Repeating' : 'Scheduled'} ride` : 'Schedule ahead', num: top ? fmtTime(top.at).replace(/ (AM|PM)/, '') : '9:00', unit: top ? fmtTime(top.at).slice(-2) : 'AM tomorrow', sent: top ? [`${top.cls} to ${placeName(top.drop)}, driver assigned `, { chip: '20 min before' }, '.'] : ['Book once, ', { chip: 'repeat every weekday' }, '. We dispatch it for you.'], go: () => ui.go('schedule', { pickup: here() }) },
              w ? { label: 'Easydrivess Money', num: inr(w.balance), unit: 'balance', sent: ['Pay in one tap. Refunds land ', { chip: 'instantly' }, '.'], go: () => ui.reset('wallet') }
                : { label: 'Work rides', num: '0', unit: 'you pay', sent: ['Rides are billed to ', { chip: 'your company' }, '.'], go: () => ui.go('p-work') },
              { label: 'Safety on every ride', num: '112', unit: 'one tap away', sent: [`${me().contacts.length} trusted contact${me().contacts.length === 1 ? '' : 's'} get a `, { chip: 'live link' }, ' on SOS.'], go: () => ui.go('safety') },
            ];
            return featureHero(frames);
          })(),
          next && h('button', { class: 'card flex', style: { width: '100%', textAlign: 'left', gap: '12px', marginBottom: '10px', padding: '12px 14px' }, onclick: () => ui.go('p-repeat') },
            h('span', { class: 'ic' }, icon(next.templateId ? 'repeat' : 'clock')),
            h('span', { class: 'grow' }, h('div', { style: { fontWeight: 600, fontSize: '14.5px' } }, `${next.templateId ? 'Repeating' : 'Scheduled'} · ${fmtTime(next.at)}`), h('div', { class: 'label' }, `${next.cls} to ${placeName(next.drop)} · ${inr(next.fare)} · driver assigned 20 min before`)),
            h('span', { class: 'pill violet' }, 'Set')),
          h('div', { class: 'choices mt16' },
            [['city', 'City', 'city'], ['airport', 'Airport', 'plane'], ['intercity', 'Intercity', 'route'], ['schedule', 'Schedule', 'calendar']].map(([k, l, ic]) =>
              h('button', { class: 'choice', onclick: () => k === 'city' ? ui.go('where', { pickup: here() }) : ui.go(k, { pickup: here() }) }, animIcon(k), l))),
          h('button', { class: 'card mt12', style: { width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px' }, onclick: () => book({ ...rebook, trip: 'city' }, app.lastCls, rbEst.fare) },
            h('span', { class: 'ic' }, icon('repeat')),
            h('span', { class: 'grow' }, h('div', { style: { fontWeight: 600, fontSize: '14.5px' } }, `Book again: ${placeName(rebook.drop)}`), h('div', { class: 'label' }, `${app.lastCls} · ${inr(rbEst.fare)} · from ${placeName(rebook.pickup)}`)),
            h('span', { class: 'pill violet' }, '1 tap')),
          h('div', { class: 'mt12' }, ad('rider-home', 'home')),
          upcoming.length > 1 && h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Scheduled')),
            upcoming.slice(1).map(x => h('div', { class: 'row' }, h('span', { class: 'ic' }, icon('clock')), h('div', { class: 'grow' }, h('div', { class: 't' }, `${placeName(x.pickup)} to ${placeName(x.drop)}`), h('div', { class: 's' }, `${fmtTime(x.at)} · ${x.cls}`)), h('button', { class: 'btn dark sm', onclick: () => cancelRide(s, x.id) }, 'Cancel'))))),
        tabbar('home'),
      ];
    },

    where({ pickup }) {
      const q = (app.q || '').toLowerCase();
      const list = placeList.filter(p => p.id !== pickup && p.kind !== 'city' && p.name.toLowerCase().includes(q));
      return [topbar('Where to?', { back: ui.back, menu: false }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card flat', style: { padding: '12px 14px' } },
            h('div', { class: 'flex' }, h('span', { class: 'dot', style: { color: 'var(--aqua)' } }), h('div', { class: 'grow' }, h('div', { class: 'label' }, 'Pickup'), h('div', { style: { fontWeight: 500 } }, `${placeName(pickup)} · current location`))),
            h('div', { class: 'divider', style: { margin: '10px 0' } }),
            h('div', { class: 'flex' }, h('span', { class: 'dot', style: { color: 'var(--periwinkle)' } }), h('input', { class: 'input', style: { background: 'transparent', border: 0, padding: 0, height: '28px' }, placeholder: 'Search a place', value: app.q || '', oninput: e => { app.q = e.target.value; ui.dirty(); } }))),
          h('div', { class: 'mt12' }, list.map(p => h('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: () => { app.q = ''; ui.go('book', { pickup, drop: p.id, trip: p.id === 'rgia' ? 'airport' : 'city' }); } },
            h('span', { class: 'ic' }, icon(p.kind === 'airport' ? 'plane' : p.kind === 'hotel' ? 'hotel' : p.kind === 'office' ? 'work' : 'pin')),
            h('div', { class: 'grow' }, h('div', { class: 't' }, p.name), h('div', { class: 's' }, 'Hyderabad'))))))];
    },

    airport(p) {
      const dir = app.airDir || 'to';
      const flights = dir === 'to' ? [{ no: '6E 2034', t: '11:40 AM', to: 'Delhi', dep: 2.7 }, { no: 'AI 543', t: '1:15 PM', to: 'Mumbai', dep: 4.25 }] : [{ no: '6E 5321', t: '11:10 AM', to: 'from Bengaluru', dep: 2.2 }];
      const f = app.flight ?? 0;
      const now = s.get().now;
      const fl = flights[f];
      const leave = dir === 'to' ? now + Math.max(0, fl.dep - 2.25) * H : now + fl.dep * H + 15 * 60e3;
      const params = dir === 'to'
        ? { pickup: p.pickup, drop: 'rgia', trip: 'airport', at: leave - now > 25 * 60e3 ? leave : null, flight: { no: fl.no, land: now + fl.dep * H, delay: 0 } }
        : { pickup: 'rgia', drop: p.pickup, trip: 'airport', at: leave, flight: { no: fl.no, land: now + fl.dep * H, delay: 0 } };
      return [topbar('Airport', { back: ui.back, menu: false }),
        h('div', { class: 'scroll' },
          h('div', { class: 'tabs-sm' }, [['to', 'To the airport'], ['from', 'Pick me up']].map(([k, l]) => h('button', { 'aria-pressed': String(dir === k), onclick: () => { app.airDir = k; app.flight = 0; ui.dirty(); } }, l))),
          h('div', { class: 'hero mt12' },
            h('div', { class: 'num-label' }, dir === 'to' ? 'Leave by' : 'Pickup at'),
            scrollNumber(fmtTime(leave).replace(/ (AM|PM)/, ''), [], { size: 8 }),
            sentence(dir === 'to' ? ['Flight ', { chip: fl.no }, ` departs ${fl.t}. We plan 2 h 15 min before, with traffic.`] : ['We track ', { chip: fl.no }, ' and move your pickup if it lands late. Free wait 45 min.'])),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Your flight'), h('span', { class: 'label' }, 'Found from your tickets')),
            flights.map((x, i) => h('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: () => { app.flight = i; ui.dirty(); } },
              h('span', { class: 'ic' }, icon('plane')), h('div', { class: 'grow' }, h('div', { class: 't' }, `${x.no} · ${x.to}`), h('div', { class: 's' }, `${dir === 'to' ? 'Departs' : 'Lands'} ${x.t} · Terminal 1`)),
              h('span', { class: `select ${i === f ? 'on' : ''}` }, i === f ? icon('check') : null))))),
        h('div', { class: 'dock' }, btn('Choose car', { arrow: true, onClick: () => ui.go('book', params) }))];
    },

    intercity(p) {
      const dest = app.icDest || 'vijayawada'; const round = !!app.icRound;
      return [topbar('Intercity', { back: ui.back, menu: false }),
        h('div', { class: 'scroll' },
          h('p', { class: 'display', style: { fontSize: '28px', margin: '6px 0 14px' } }, 'Out of town,', h('br'), h('span', { class: 'dim' }, 'door to door.')),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, 'Going to')),
            ['vijayawada', 'warangal'].map(id => h('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: () => { app.icDest = id; ui.dirty(); } },
              h('span', { class: 'ic' }, icon('route')), h('div', { class: 'grow' }, h('div', { class: 't' }, places[id].name), h('div', { class: 's' }, id === 'vijayawada' ? '275 km · about 4 h 30 min' : '145 km · about 2 h 20 min')),
              h('span', { class: `select ${dest === id ? 'on' : ''}` }, dest === id ? icon('check') : null)))),
          h('div', { class: 'card mt12 flex between' }, h('div', null, h('div', { style: { fontWeight: 500 } }, 'Round trip'), h('div', { class: 'label' }, 'Driver waits, return the same day')), h('button', { class: 'toggle', 'aria-pressed': String(round), onclick: () => { app.icRound = !round; ui.dirty(); } }))),
        h('div', { class: 'dock' }, btn('Choose car', { arrow: true, onClick: () => ui.go('book', { pickup: p.pickup, drop: dest, trip: 'intercity', round }) }))];
    },

    schedule(p) {
      const st = s.get(); const r = me();
      const d0 = new Date(st.now + IST); const base = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()) - IST;
      const times = [['Today 6:30 PM', base + 18.5 * H], ['Tomorrow 9:00 AM', base + 33 * H], ['Tomorrow 6:30 PM', base + 42.5 * H]];
      const ti = app.schT ?? 0; const rep = !!app.schRep; const dest = app.schDest || (r.company ? (here() === r.home ? r.company : r.home) : 'hitec');
      const tRide = times[ti][1];
      return [topbar('Schedule', { back: ui.back, menu: false }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, 'To')),
            h('div', { class: 'tabs-sm' }, r.saved.map(x => h('button', { 'aria-pressed': String(dest === x.place), onclick: () => { app.schDest = x.place; ui.dirty(); } }, x.label)))),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'When')),
            times.map(([l], i) => h('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: () => { app.schT = i; ui.dirty(); } }, h('span', { class: 'ic' }, icon('clock')), h('div', { class: 'grow t' }, l), h('span', { class: `select ${i === ti ? 'on' : ''}` }, i === ti ? icon('check') : null)))),
          h('div', { class: 'card mt12 flex between' }, h('div', null, h('div', { style: { fontWeight: 500 } }, 'Repeat every weekday'), h('div', { class: 'label' }, 'Booked and dispatched automatically')), h('button', { class: 'toggle', 'aria-pressed': String(rep), onclick: () => { app.schRep = !rep; ui.dirty(); } }))),
        h('div', { class: 'dock' }, btn('Choose car', { arrow: true, onClick: () => ui.go('book', { pickup: dest === p.pickup ? 'hitec' : p.pickup, drop: dest, trip: 'city', at: tRide, repeat: rep }) }))];
    },

    book(p) {
      const st = s.get();
      const ests = Object.fromEntries(CLASSES.map(c => [c, estimate(s, { pickup: p.pickup, drop: p.drop, cls: c, trip: p.trip, at: p.at })]));
      if (p.round) for (const c of CLASSES) ests[c].fare = Math.round(ests[c].fare * 1.85);
      const cls = app.pick && ests[app.pick] ? app.pick : app.lastCls;
      const i = CLASSES.indexOf(cls); const e = ests[cls];
      const etas = Object.fromEntries(CLASSES.map(c => [c, etaFor(s, c, p.pickup)]));
      const company = work();
      const fares = CLASSES.map(c => String(ests[c].fare));
      const pts = [places[p.pickup], places[p.drop]];
      const rt = { points: e.km > 100 ? [pts[0], pts[1]] : estimateRoute(p) };
      return [topbar(p.trip === 'airport' ? 'Airport ride' : p.trip === 'intercity' ? 'Intercity ride' : 'Choose your car', { back: () => { app.pick = null; ui.back(); }, menu: false }),
        h('div', { class: 'scroll' },
          map({ height: 150, routes: [rt], pins: [{ ...pts[0], color: '#E9E8FB', label: placeName(p.pickup) }, { ...pts[1], color: '#8F8CF2', label: placeName(p.drop) }], focus: p.trip === 'intercity' ? [pts[0], { x: pts[1].x - 60, y: pts[1].y }] : pts, labels: false }),
          h('div', { class: 'hero mt12', style: { paddingTop: '14px' } },
            h('div', { class: 'num-label', style: { marginBottom: '8px' } }, `${cls} fare`),
            scrollNumber('₹' + fares[i], [fares[i - 2], fares[i - 1], fares[i + 1], fares[i + 2]], { size: 7.5 }),
            sentence([e.sentence.replace(/^₹[\d,]+\. /, '').replace(/\.$/, '') + '. Condition ', { chip: String(e.score ?? '—') }, `. ${e.km} km, about ${e.min} min.`])),
          explainer(app, 'fare'),
          h('div', { class: 'classes mt12' }, CLASSES.map(c => {
            const x = ests[c]; const cs = x.car ? conditionScore(x.car, st.now) : null;
            return h('button', { class: 'cls', 'aria-pressed': String(c === cls), onclick: () => { app.pick = c; ui.dirty(); } },
              carArt(c),
              h('div', null, h('div', { class: 'n' }, c), h('div', { class: 'm' }, `${SEATS[c]} seats · ${BAGS[c]} bags · ${etas[c] != null ? etas[c] + ' min away' : 'none nearby'}`)),
              h('div', { class: 'f' }, inr(x.fare), cs && h('small', null, `${cs.score} condition`)));
          })),
          h('div', { class: 'card mt12', style: { padding: '4px 14px' } },
            h('div', { class: 'row' }, h('span', { class: 'ic' }, icon('clock')), h('div', { class: 'grow' }, h('div', { class: 't' }, p.at ? `Scheduled ${fmtTime(p.at)}` : 'Leave now'), p.repeat && h('div', { class: 's' }, 'Repeats every weekday'))),
            h('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: () => !company && payMethodSheet(app, s) }, h('span', { class: 'ic' }, icon(company ? 'work' : 'wallet')), h('div', { class: 'grow' }, h('div', { class: 't' }, company ? `${st.companies.find(c => c.id === company).name} pays` : payLabel(s, me()).title), h('div', { class: 's' }, company ? 'You pay ₹0' : payLabel(s, me()).sub)), !company && h('span', { class: 'label' }, 'Change')))),
        h('div', { class: 'dock' },
          app.err && h('div', { class: 'card flex', style: { marginBottom: '8px', background: 'rgba(255,90,69,.12)', gap: '10px' } }, h('div', { class: 'small grow', style: { color: '#FF8A78' } }, app.err), app.errAction === 'topup' && h('button', { class: 'btn primary sm', onclick: () => topUpSheet(app, s, app.who, () => { app.err = null; ui.dirty(); }) }, 'Add money')),
          btn(`Book ${cls} · ${inr(e.fare)}`, { arrow: true, onClick: () => { app.pick = null; book(p, cls, e.fare); } }))];
    },

    ride({ id }) {
      const st = s.get(); const r = st.rides.find(x => x.id === id);
      if (!r) { ui.reset('home'); return screens.home(); }
      if (r.status === 'completed') return complete(r);
      if (r.status === 'cancelled') { ui.reset('home'); return screens.home(); }
      const alert = st.alerts.find(a => a.rideId === r.id && a.status === 'open');
      if (alert) return sos(r, alert);
      const d = st.drivers.find(x => x.id === r.driverId);
      const m = mapForRide(s, r, { height: r.status === 'onboard' ? 260 : 170 });
      let heroEl;
      if (r.status === 'finding') {
        heroEl = h('div', { class: 'hero' },
          h('div', { class: 'num-label' }, 'Finding your car'),
          h('div', { class: 'num-row pulse' }, dotNumber('...', { size: 9, off: false })),
          sentence(r.noCars ? [`No ${r.cls} free nearby yet. `, { chip: 'Still trying' }, ' You can cancel any time at no cost.'] : [`Matching the closest ${r.cls} with condition above `, { chip: '85' }, r.at ? ` for ${fmtTime(r.at)}.` : '.']));
      } else if (r.status === 'arriving') {
        const left = Math.max(1, Math.ceil(r.approach.min * (1 - r.approach.progress)));
        heroEl = h('div', { class: 'hero' },
          h('div', { class: 'num-label' }, `Your ${r.cls} is arriving`),
          scrollNumber(String(left), [left + 2, left + 1, Math.max(0, left - 1), Math.max(0, left - 2)].map(String), { size: 11 }),
          h('div', { class: 'num-label', style: { margin: '6px 0 0' } }, 'min'),
          sentence([`${d.name.split(' ')[0]} is ${(r.approach.km * (1 - r.approach.progress)).toFixed(1)} km away. Check the plate `, { chip: st.cars.find(c => c.id === r.carId).plate }, '.']));
      } else if (r.status === 'arrived') {
        heroEl = h('div', { class: 'hero condition' },
          h('div', { class: 'num-label' }, 'Your driver is here. Share this code'),
          h('div', { class: 'num-row' }, dotNumber(r.otp, { size: 11, off: false })),
          sentence(['Check the plate ', { chip: st.cars.find(c => c.id === r.carId).plate }, ' before you get in.']));
      } else {
        const left = Math.max(1, Math.ceil(r.min * (1 - r.progress)));
        heroEl = h('div', { class: 'hero' },
          h('div', { class: 'num-label' }, `Heading to ${placeName(r.drop)}`),
          scrollNumber(String(left), [], { size: 10 }),
          h('div', { class: 'num-label', style: { margin: '6px 0 0' } }, 'min left'),
          sentence(['Tracked live by ', { chip: me().contact.name }, ' and the Easydrivess safety desk.']));
      }
      return [topbar(r.status === 'onboard' ? 'On the trip' : r.status === 'finding' ? (r.at ? 'Scheduled' : 'Booking') : 'Your ride', { back: () => ui.reset('home'), menu: () => rideMenu(r) }),
        h('div', { class: 'scroll' },
          r.status === 'onboard' ? [map(m), h('div', { class: 'mt12' }, heroEl)] : [heroEl, h('div', { class: 'mt12' }, map(m))],
          r.status !== 'finding' && h('div', { class: 'mt12' }, driverCard(s, r, { onCall: () => callSheet(app, { name: s.get().drivers.find(d => d.id === r.driverId).name, role: 'Your driver' }), onChat: () => chatSheet(app, s, r, 'rider') })),
          r.status === 'arriving' && h('div', { class: 'card mt12 flex between' }, h('div', null, h('div', { style: { fontWeight: 600 } }, 'Ride OTP'), h('div', { class: 'label' }, 'Share only after you check the plate')), h('div', { class: 'otp' }, r.otp.split('').map(c => h('div', { class: 'd' }, dotNumber(c, { size: 4.5, off: false }))))),
          (r.stops.length > 0 || r.status === 'onboard') && h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, r.stops.length ? 'Your route' : 'Trip')), stopList(s, r, { me: app.who })),
          r.status === 'finding' && h('div', { class: 'mt12' }, ad('rider-finding', r.id)),
          h('div', { class: 'tiles mt12' }, tile('Fare', inr(r.fare), null), tile('Payment', payLabel(s, me(), r).short)),
          h('div', { class: 'flex mt12', style: { gap: '8px' } },
            r.status === 'finding' || r.status === 'arriving' ? h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => cancelRide(s, r.id) }, 'Cancel ride') : h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => shareSheet(app, s, r, me()) }, icon('share', 18), 'Share trip'),
            r.status !== 'finding' && h('button', { class: 'btn ember', style: { flex: 1 }, onclick: () => raiseAlert(s, r.id, 'sos') }, icon('sos', 18), 'SOS')))];
    },

    trips() {
      const list = myRides().filter(r => !ACTIVE.includes(r.status)).slice(0, 14);
      return [topbar('My trips'),
        h('div', { class: 'scroll' },
          h('div', { class: 'card', style: { padding: '2px 14px' } }, list.length ? list.map(r => h('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: () => receipt(r) }, h('span', { class: 'ic' }, icon(r.trip === 'airport' ? 'plane' : r.trip === 'intercity' ? 'route' : 'car')), h('div', { class: 'grow' }, h('div', { class: 't' }, `${placeName(r.pickup)} to ${placeName(r.drop)}`), h('div', { class: 's' }, `${r.status === 'scheduled' ? fmtTime(r.at) : r.status === 'cancelled' ? 'Cancelled' : 'Completed ' + fmtTime(r.completedAt || r.createdAt)} · ${r.cls}`)), h('div', { class: 'strong' }, inr(r.fare))))
            : h('div', { class: 'small center', style: { padding: '24px 0' } }, 'Your trips will show here.')),
          h('div', { class: 'mt12' }, ad('rider-trips', 'trips'))),
        tabbar('trips')];
    },
  };

  function receipt(r) {
    const st = s.get(); const d = st.drivers.find(x => x.id === r.driverId); const car = st.cars.find(c => c.id === r.carId);
    openSheet(app, { title: inr(r.fare), sub: `${placeName(r.pickup)} to ${placeName(r.drop)} · ${r.cls}`, body: () => [
      h('div', { class: 'card', style: { padding: '2px 14px' } },
        [['Status', r.status === 'completed' ? 'Completed' : r.status[0].toUpperCase() + r.status.slice(1)], ['Booked', fmtTime(r.createdAt)], ['Driver', d ? `${d.name} · ${car.plate}` : '—'], ['Distance', `${r.km} km`], ['Paid with', payLabel(s, me(), r).title], ['Ride ID', r.id]].map(([k, v]) => h('div', { class: 'set' }, h('div', { class: 'grow' }, h('small', null, k)), h('b', { style: { fontWeight: 500 } }, v)))),
      h('div', { class: 'flex mt12', style: { gap: '8px' } },
        h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => { closeSheet(app); flash(app, 'Receipt emailed', `Sent to ${me().email}.`); } }, icon('doc', 17), 'Email receipt'),
        h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => { closeSheet(app); ui.reset('help', { rideId: r.id }); } }, icon('chat', 17), 'Get help')),
    ] });
  }

  function rideMenu(r) {
    menuSheet(app, 'Ride options', [
      { label: 'Share trip', icon: 'share', run: () => shareSheet(app, s, r, me()) },
      r.driverId && { label: 'Message driver', icon: 'chat', run: () => chatSheet(app, s, r, 'rider') },
      { label: 'Safety centre', icon: 'shield', sub: 'SOS, trusted contacts, 112', run: () => ui.go('safety') },
      { label: 'Report a problem', icon: 'flag', run: () => ui.go('help', { rideId: r.id }) },
      ['finding', 'arriving', 'scheduled'].includes(r.status) && { label: 'Cancel ride', icon: 'close', sub: 'Free before the driver arrives', danger: true, run: () => cancelRide(s, r.id) },
    ].filter(Boolean));
  }

  function bell() {
    const n = unread(s, 'rider', app.who);
    return h('button', { class: 'iconbtn', 'aria-label': `Notifications, ${n} unread`, style: { width: '48px', height: '48px' }, onclick: () => ui.go('inbox') }, icon('bell'), n ? h('span', { class: 'badge-led' }, n > 9 ? '9+' : n) : null);
  }

  const ctx = { s, app, ui, me, myRides, tabbar: (...a) => tabbar(...a), work, here };
  Object.assign(screens, profileScreens(ctx), { wallet: () => walletScreen(ctx), inbox: () => inboxScreen(ctx) });
  const estimateRoute = p => route(p.pickup, p.drop).points;

  function complete(r) {
    const st = s.get(); const d = st.drivers.find(x => x.id === r.driverId);
    const rated = app.rate?.[r.id] || {};
    const fin = () => { rateRide(s, r.id, { stars: rated.stars || 5, clean: rated.clean ?? true }); ui.reset('home'); };
    return [topbar('', { back: fin, menu: false, right: h('span', { class: 'pill violet' }, payLabel(s, me(), r).short) }),
      h('div', { class: 'scroll' },
        h('p', { class: 'display', style: { margin: '0 0 14px' } }, 'You', h('br'), h('span', { class: 'dim' }, 'arrived.')),
        h('div', { class: 'hero money' },
          h('div', { class: 'num-label' }, r.method === 'company' ? 'You pay' : r.method === 'cash' ? 'Pay the driver in cash' : 'Fare'),
          h('div', { class: 'num-row' }, dotNumber(r.method === 'company' ? '₹0' : '₹' + r.fare, { size: 9, off: false })),
          sentence([`${r.cls} · ${r.km} km. `, { chip: payLabel(s, me(), r).done }])),
        h('div', { class: 'card mt12' },
          h('div', { class: 'card-head' }, h('h3', null, `Rate ${d.name.split(' ')[0]}`)),
          h('div', { class: 'flex', style: { gap: '6px' } }, [1, 2, 3, 4, 5].map(n => h('button', { 'aria-label': `${n} stars`, style: { color: (rated.stars || 0) >= n ? 'var(--amber)' : 'var(--fg-3)' }, onclick: () => { app.rate = { ...app.rate, [r.id]: { ...rated, stars: n } }; ui.dirty(); } }, icon('star', 30)))),
          h('div', { class: 'divider' }),
          h('div', { class: 'flex between' }, h('div', { style: { fontWeight: 500 } }, 'Was the car clean?'),
            h('div', { class: 'flex', style: { gap: '8px' } },
              h('button', { class: 'iconbtn', 'aria-label': 'Yes', style: rated.clean === true ? { background: 'var(--aqua)', color: 'var(--ink)' } : null, onclick: () => { app.rate = { ...app.rate, [r.id]: { ...rated, clean: true } }; ui.dirty(); } }, icon('thumbup')),
              h('button', { class: 'iconbtn', 'aria-label': 'No', style: rated.clean === false ? { background: 'var(--ember)', color: '#fff' } : null, onclick: () => { app.rate = { ...app.rate, [r.id]: { ...rated, clean: false } }; ui.dirty(); } }, icon('thumbdown'))))),
        h('div', { class: 'mt12' }, ad('rider-complete', r.id))),
      h('div', { class: 'dock' }, btn('Done', { arrow: true, onClick: fin }))];
  }

  function sos(r, a) {
    return [topbar('', { menu: false, right: pill('SOS active', 'alert') }),
      h('div', { class: 'scroll' },
        h('p', { class: 'display', style: { margin: '4px 0 14px' } }, 'Help is', h('br'), h('span', { class: 'dim' }, 'on the way.')),
        h('div', { class: 'hero alert' }, h('div', { class: 'num-label' }, 'Stay on this screen. Your live location is shared.'),
          h('div', { class: 'stops' }, a.timeline.map(t => h('div', { class: 'stop done' }, h('span', { class: 'n' }, icon('check', 12)), h('div', null, h('div', { class: 't' }, t.text), h('div', { class: 's' }, fmtTime(t.at))), h('span'))))),
        h('div', { class: 'mt12' }, btn('Call 112 · Police', { kind: 'violet', ic: 'phone', onClick: () => callSheet(app, { name: 'Police · 112', role: 'Emergency services', number: '112' }) })),
        h('div', { class: 'mt8' }, btn("I'm safe now · close alert", { kind: 'dark', onClick: () => closeAlert(s, a.id) })))];
  }

  function tabbar(cur) {
    return h('div', { class: 'tabbar' }, h('nav', null,
      [['home', 'home'], ['trips', 'clock'], ['wallet', 'wallet'], ['profile', 'user']].map(([k, ic]) => h('button', { 'aria-label': k, 'aria-pressed': String(cur === k), onclick: () => ui.reset(k) }, icon(ic)))));
  }

  app.render = () => {
    const f = screens[ui.screen] || screens.home;
    return f(ui.params);
  };
  app.notifyKey = n => n.app === 'rider' && n.to === app.who;
  app.caption = () => `${me().name}${app.profile === 'work' ? ' · Work' : ''}`;
  app.controls = () => h('select', { class: 'input', style: { height: '32px', width: 'auto', fontSize: '12.5px', borderRadius: '10px' }, onchange: e => { app.who = e.target.value; app.profile = 'personal'; ui.reset('home'); } },
    [['r1', 'Ananya · public + Work'], ['e01', 'Priya · Orbit employee'], ['e05', 'Divya · Orbit employee'], ['r3', 'Deepak · public']].map(([v, l]) => h('option', { value: v, selected: app.who === v }, l)));
  app.galleryScreens = () => {
    const pick = (k, fn) => ({ before: () => { app._g = { who: app.who }; fn?.(); }, after: () => { Object.assign(app, app._g); } });
    return [
      { title: 'Home', screen: 'home' },
      { title: 'Where to', screen: 'where', params: { pickup: 'jubilee' } },
      { title: 'Choose your car', screen: 'book', params: { pickup: 'jubilee', drop: 'hitec', trip: 'city' } },
      { title: 'Airport', screen: 'airport', params: { pickup: 'jubilee' } },
      { title: 'Airport car', screen: 'book', params: { pickup: 'jubilee', drop: 'rgia', trip: 'airport' } },
      { title: 'Intercity', screen: 'intercity', params: { pickup: 'jubilee' } },
      { title: 'Schedule and repeat', screen: 'schedule', params: { pickup: 'jubilee' } },
      { title: 'Trips', screen: 'trips' }, { title: 'Safety', screen: 'safety' }, { title: 'Profile', screen: 'profile' },
    ];
  };
  return app;
}
