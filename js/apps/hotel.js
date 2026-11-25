import { h, icon, mark, pill, initials, dotNumber } from '../ui/kit.js';
import { inr, fmtTime } from '../engine/store.js';
import { estimate, bookRide, setFlightDelay, cancelRide } from '../engine/rides.js';
import { charge } from '../engine/wallet.js';
import { router, placeName, ACTIVE } from './common.js';
import { webBell, webToast } from './ops.js';

// Hotel front desk: guest transfers in three clicks (guest → car → book), billed to the room.
export function createHotel(s) {
  const ui = router('arrivals');
  const app = { id: 'hotel', ui, hotel: 'taj', open: null, cls: {} };
  const st = () => s.get();
  const hotel = () => st().hotels.find(x => x.id === app.hotel);
  const rideFor = g => st().rides.find(r => r.guestId === g.id && r.status !== 'cancelled');

  function book(g, cls, dir) {
    const now = st().now;
    const arriving = dir === 'in';
    const at = arriving ? g.land + (g.delay || 0) * 60e3 + 15 * 60e3 : g.checkout;
    const params = arriving ? { pickup: 'rgia', drop: hotel().place } : { pickup: hotel().place, drop: 'rgia' };
    const e = estimate(s, { ...params, cls, trip: 'airport', at });
    const id = bookRide(s, { riderId: `guest-${g.id}`, ...params, cls, trip: 'airport', channel: 'hotel', payer: app.hotel, at: at > now ? at : null, fare: e.fare, flight: arriving && g.flight ? { no: g.flight, land: g.land, delay: g.delay || 0 } : null, guest: g.name });
    const r = st().rides.find(x => x.id === id); r.guestId = g.id;
    charge(s, app.hotel, e.fare, id);
    app.open = null; ui.dirty();
  }

  function guestRow(g, dir) {
    const r = rideFor(g);
    const lands = g.land ? g.land + (g.delay || 0) * 60e3 : g.checkout;
    const open = app.open === g.id;
    const cls = app.cls[g.id] || (g.name.startsWith('Ms. Aiko') ? 'Luxury' : 'Sedan');
    const status = r ? ({ scheduled: `Pickup ${fmtTime(r.at)}`, finding: 'Finding car', arriving: 'Driver on the way', arrived: 'Driver at gate', onboard: 'On the way', completed: 'Arrived' }[r.status]) : null;
    const d = r && st().drivers.find(x => x.id === r.driverId);
    return [
      h('tr', { class: r ? '' : 'click', onclick: r ? null : () => { app.open = open ? null : g.id; ui.dirty(); } },
        h('td', null, h('div', { class: 'flex' }, h('div', { class: 'avatar', style: { width: '32px', height: '32px', fontSize: '11.5px' } }, initials(g.name)), h('div', null, h('div', { style: { fontWeight: 500 } }, g.name), h('div', { class: 'label' }, `Room ${g.room}`)))),
        h('td', null, g.flight ? h('div', null, h('div', null, g.flight), h('div', { class: 'label' }, g.from)) : h('span', { class: 'label' }, 'Checkout')),
        h('td', null, h('div', null, fmtTime(lands)), g.delay ? pill(`${g.delay} min late`, 'warn') : g.flight ? h('div', { class: 'label' }, 'On time') : null),
        h('td', null, r ? h('div', null, pill(status, r.status === 'completed' ? 'good' : ACTIVE.includes(r.status) ? 'violet' : ''), d && h('div', { class: 'label', style: { marginTop: '4px' } }, `${d.name} · ${st().cars.find(c => c.id === r.carId).plate}`)) : h('span', { class: 'label' }, 'Not booked')),
        h('td', { class: 'num' }, r ? h('div', { class: 'flex', style: { justifyContent: 'flex-end', gap: '6px' } },
          r.flight && r.status === 'scheduled' && h('button', { class: 'btn dark sm', onclick: e => { e.stopPropagation(); g.delay = (g.delay || 0) + 40; setFlightDelay(s, r.id, g.delay); } }, 'Flight update'),
          ['scheduled', 'finding'].includes(r.status) && h('button', { class: 'btn dark sm', onclick: e => { e.stopPropagation(); cancelRide(s, r.id, 'hotel'); } }, 'Cancel'))
          : h('button', { class: 'btn primary sm', onclick: e => { e.stopPropagation(); app.open = g.id; ui.dirty(); } }, dir === 'in' ? 'Book pickup' : 'Book drop'))),
      open && h('tr', null, h('td', { colspan: 5, style: { background: 'var(--s2)', borderRadius: '14px' } },
        h('div', { class: 'flex wrap', style: { gap: '8px', alignItems: 'stretch' } },
          ['Sedan', 'SUV', 'Luxury'].map(c => { const e = estimate(s, { pickup: dir === 'in' ? 'rgia' : hotel().place, drop: dir === 'in' ? hotel().place : 'rgia', cls: c, trip: 'airport' });
            return h('button', { class: 'card', style: { flex: 1, textAlign: 'left', padding: '12px 14px', background: c === cls ? 'var(--s3)' : 'var(--s1)', boxShadow: c === cls ? 'inset 0 0 0 1.5px var(--periwinkle)' : 'none', margin: 0 }, onclick: () => { app.cls[g.id] = c; ui.dirty(); } },
              h('div', { style: { fontWeight: 600 } }, c), h('div', { class: 'label' }, `Condition ${e.score} · ${e.min} min`), h('div', { style: { fontSize: '18px', fontWeight: 600, marginTop: '4px' } }, inr(e.fare))); }),
          h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', minWidth: '190px' } },
            h('button', { class: 'btn violet', style: { height: '46px' }, onclick: () => book(g, cls, dir) }, `Book ${cls} · bill room ${g.room}`),
            h('div', { class: 'label center' }, g.flight ? 'Flight tracked, pickup moves if it is late' : 'Leaves 3 h before departure'))))),
    ];
  }

  const pages = {
    arrivals() {
      const guests = hotel().guests.filter(g => g.flight);
      const transfers = st().rides.filter(r => r.payer === app.hotel && !r.history && r.status !== 'cancelled');
      return [h('div', { class: 'page-head' }, h('div', null, h('h2', null, 'Guest transfers', h('br'), h('span', { class: 'dim' }, `Today at ${hotel().name}`)), h('p', null, 'Click a guest, pick the car, book. Flights are tracked and pickups move on their own.'))),
        h('div', { class: 'wgrid c3' },
          kpi('Arriving today', guests.length, `${guests.filter(g => rideFor(g)).length} booked`),
          kpi('Transfers today', transfers.length + 1, 'incl. 1 completed'),
          kpi('This month, billed to rooms', inr(st().wallets[app.hotel].balance + 18640), 'Monthly invoice')),
        h('div', { class: 'panel mt16' }, h('h3', null, 'Arrivals', h('span', { class: 'label' }, 'RGIA to hotel')),
          h('table', { class: 't' }, h('thead', null, h('tr', null, ['Guest', 'Flight', 'Lands', 'Transfer', ''].map(x => h('th', null, x)))), h('tbody', null, guests.flatMap(g => guestRow(g, 'in'))))),
        h('div', { class: 'panel mt16' }, h('h3', null, 'Departures', h('span', { class: 'label' }, 'Hotel to RGIA')),
          h('table', { class: 't' }, h('thead', null, h('tr', null, ['Guest', 'Flight', 'Leaves', 'Transfer', ''].map(x => h('th', null, x)))), h('tbody', null, hotel().guests.filter(g => !g.flight).flatMap(g => guestRow(g, 'out')))))];
    },
    billing() {
      const tx = st().ledger.filter(e => e.wallet === app.hotel);
      return [h('div', { class: 'page-head' }, h('div', null, h('h2', null, 'Billing', h('br'), h('span', { class: 'dim' }, 'November 2026')), h('p', null, 'Every transfer is added to the guest folio and the monthly hotel invoice.'))),
        h('div', { class: 'panel' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Time', 'Ride', 'Note', 'Amount'].map(x => h('th', { class: x === 'Amount' ? 'num' : '' }, x)))),
          h('tbody', null, tx.length ? tx.map(e => h('tr', null, h('td', null, fmtTime(e.at)), h('td', null, e.ref), h('td', null, e.note), h('td', { class: 'num' }, inr(e.amount)))) : h('tr', null, h('td', { colspan: 4, class: 'label' }, 'No transfers billed today yet.')))))];
    },
  };
  const kpi = (k, v, d) => h('div', { class: 'panel kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k), d && h('div', { class: 'd' }, d));

  app.render = ({ compact } = {}) => h('div', { class: `webapp${compact ? ' compact' : ''}`, style: { flex: 1, minHeight: 0 } },
    h('aside', { class: 'side' },
      h('div', { class: 'brand' }, mark('violet'), h('span', null, 'Easydrivess', h('small', null, hotel().desk))),
      [['arrivals', 'Transfers', 'plane'], ['billing', 'Billing', 'doc']].map(([k, l, ic]) => h('button', { 'aria-pressed': String(ui.screen === k), onclick: () => ui.reset(k), title: l }, icon(ic), h('span', { class: 'lbl' }, l)))),
    h('div', { class: 'main', style: { position: 'relative' } }, webBell(s, app, 'hotel', app.hotel), (pages[ui.screen] || pages.arrivals)()),
    app.toast && app.toast.until > performance.now() && webToast(app.toast.n));
  app.notifyKey = n => n.app === 'hotel' && n.to === app.hotel;
  return app;
}
