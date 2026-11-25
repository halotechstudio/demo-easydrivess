import { tick, bookRide } from './engine/rides.js';
import { raiseAlert } from './engine/safety.js';
import { IST } from './engine/store.js';

const until = (s, test, max = 2000) => { for (let i = 0; i < max && !test(); i++) tick(s, 5000); };

// Presenter shortcuts. Each sets the scene, then the presenter clicks through.
export const SCENARIOS = [
  { title: 'Airport drop in 4 taps', note: 'Rider: Airport → Choose car → Book', run: (s, a, p) => { a.rider.ui.reset('airport', { pickup: 'jubilee' }); p.view = 'live'; } },
  { title: 'Team of 7, smart plan', note: 'Manager: 7 colleagues grouped into 3 cars', run: (s, a, p) => { a.manager.selectMorningTeam(); a.manager.ui.reset('plan'); p.view = 'live'; } },
  { title: 'WhatsApp booking', note: 'Book by chat, no app', run: (s, a, p) => { a.whatsapp.ui.reset('chat'); p.view = 'whatsapp'; } },
  { title: 'Hotel guest, flight delayed', note: 'Hotel desk: book, then "Flight update"', run: (s, a, p) => { a.hotel.ui.reset('arrivals'); a.hotel.open = 'g3'; p.view = 'hotel'; } },
  { title: 'SOS on a live trip', note: 'Rider presses SOS; desk, manager, contact alerted', run: (s, a, p) => {
    const id = bookRide(s, { riderId: a.rider.who, pickup: 'jubilee', drop: 'hitec', cls: 'Sedan', trip: 'city', channel: 'app', payer: 'self' });
    until(s, () => s.get().rides.find(r => r.id === id).status === 'onboard');
    raiseAlert(s, id, 'sos'); a.rider.ui.reset('ride', { id }); a.ops.ui.reset('safety'); p.view = 'live';
  } },
  { title: 'Shine Check skipped', note: 'Score decays, Luxury rides stop', run: (s, a, p) => {
    const st = s.get(); const c = st.cars.find(x => x.id === 'c10'); c.shine.at = st.now - 3 * 864e5;
    a.driver.follow = false; a.driver.who = 'd10'; a.driver.ui.reset('home'); a.ops.ui.reset('fleet'); p.view = 'live';
  } },
  { title: 'Shine Check needs a retake', note: 'Rear seat flagged, retake one photo', run: (s, a, p) => { a.driver.follow = false; a.driver.failNext = true; a.driver.ui.reset('home'); a.driver.shine = { i: 0, t0: performance.now(), done: [], result: null }; p.view = 'driver'; } },
  { title: 'Night drop, safety rule', note: 'Jump to 10:20 PM, manager books drop home', run: (s, a, p) => {
    const st = s.get(); const d = new Date(st.now + IST); const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22, 20) - IST;
    if (t > st.now) until(s, () => s.get().now >= t, 20000);
    a.manager.selectMorningTeam(); a.manager.trip = 'out'; a.manager.ui.reset('plan'); p.view = 'live';
  } },
  { title: 'Low company wallet', note: 'Booking blocked until money is added', run: (s, a, p) => { s.get().wallets.orbit.balance = 900; a.manager.selectMorningTeam(); a.manager.ui.reset('plan'); p.view = 'manager'; } },
  { title: 'Busy hour', note: 'Demand 1.4× in Pricing, quotes update', run: (s, a, p) => { s.get().pricing.demand = 1.4; a.ops.ui.reset('pricing'); a.ops.draft = null; p.view = 'ops'; } },
  { title: 'Onboard a new car', note: '42-point checklist and papers', run: (s, a, p) => { a.ops.ui.reset('onboard'); p.view = 'ops'; } },
];
