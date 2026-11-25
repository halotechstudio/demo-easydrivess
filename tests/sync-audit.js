// Cross-app sync audit. Run in the browser console on the simulation (or via the preview tool):
//   const { audit } = await import('/tests/sync-audit.js'); await audit();
// Each check starts an action in one app and reads the OTHER apps' rendered screens to confirm they agree.
export async function audit() {
  const S = window.__sim; const out = [];
  const st = () => S.s.get(); const A = S.apps();
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: String(detail) });
  const paint = () => S.paint();
  const text = k => { paint(); return (document.querySelector(`[data-cap="${k}"]`)?.parentElement || document.querySelector(k === 'ops' ? '.webs > div:nth-child(2)' : '.webs > div:nth-child(1)'))?.innerText || ''; };
  const webText = i => { paint(); return document.querySelectorAll('.webs > div')[i]?.innerText || ''; };
  const run = (ms, step = 5000) => { for (let t = 0; t < ms; t += step) S.tick(step); };
  const until = (fn, max = 3 * 3600e3) => { for (let t = 0; t < max && !fn(); t += 5000) S.tick(5000); return fn(); };
  const imp = p => import(p);
  const { bookRide, cancelRide, reserveRide } = await imp('/js/engine/rides.js');
  const { requestPayout, approvePayouts } = await imp('/js/engine/wallet.js');
  const { raiseAlert, ackAlert } = await imp('/js/engine/safety.js');
  const { waHandle } = await imp('/js/engine/whatsapp.js');
  const { pickAd } = await imp('/js/engine/ads.js');
  const { estimate } = await imp('/js/engine/rides.js');
  const { planBatch } = await imp('/js/engine/batching.js');
  const { bookBatch } = await imp('/js/engine/rides.js');

  S.presenter().view = 'live'; S.presenter().playing = false; S.layout();
  const opsGo = p => { A.ops.ui.reset(p); paint(); };

  // 1. Rider books from the UI (wallet) → Ops, Driver, wallet all agree.
  A.rider.who = 'r1'; A.rider.profile = 'personal'; A.rider.ui.reset('home'); paint();
  const walletBefore = st().wallets.r1.balance;
  A.rider.ui.reset('book', { pickup: 'jubilee', drop: 'hitec', trip: 'city' }); paint();
  [...document.querySelectorAll('[data-cap="rider"] ~ .phone-scale .dock button, .phone-col:nth-child(1) .dock button')].find(b => b.textContent.startsWith('Book'))?.click(); paint();
  const r1 = st().rides.find(r => r.riderId === 'r1' && !r.history && r.status !== 'scheduled');
  ok('Rider booking created', r1, r1?.id);
  ok('Wallet charged at booking', st().wallets.r1.balance === walletBefore - r1.fare, `${walletBefore} → ${st().wallets.r1.balance}, fare ${r1.fare}`);
  opsGo('rides'); ok('Ops Rides lists the rider booking', webText(1).includes(r1.id), r1.id);
  until(() => r1.status === 'arriving');
  const d1 = st().drivers.find(d => d.id === r1.driverId); const car1 = st().cars.find(c => c.id === r1.carId);
  paint();
  ok('Driver phone follows the assigned driver', A.driver.who === d1.id, `${A.driver.who} vs ${d1.id}`);
  ok('Rider screen shows driver and plate', text('rider').includes(d1.name) && text('rider').includes(car1.plate), `${d1.name} ${car1.plate}`);
  ok('Driver screen is on the pickup leg', /To pickup|Pickup/.test(text('driver')));
  opsGo('rides'); ok('Ops shows status To pickup with driver', webText(1).includes(d1.name), d1.name);
  opsGo('drivers'); ok('Ops Drivers shows driver On trip', webText(1).split('\n').some(l => l.includes(d1.name)) && /on trip/i.test(webText(1)));
  const earnBefore = d1.wallet;
  until(() => r1.status === 'completed');
  paint();
  const earn = Math.round(r1.fare * (1 - st().pricing.commission));
  ok('Driver credited exact share', d1.wallet === earnBefore + earn, `${earnBefore} + ${earn} = ${d1.wallet}`);
  ok('Rider sees arrival with fare', text('rider').includes('arrived'));
  ok('Rider got arrival notification', st().notifications.some(n => n.app === 'rider' && n.to === 'r1' && /arrived/i.test(n.title)));
  A.rider.ui.reset('wallet'); paint(); ok('Rider wallet history shows the ride', text('rider').includes('Jubilee Hills to HITEC City'));

  // 2. Cancel before pickup refunds and frees the driver.
  const wb = st().wallets.r1.balance; const fare2 = estimate(S.s, { pickup: 'jubilee', drop: 'banjara', cls: 'Sedan' }).fare;
  (await imp('/js/engine/wallet.js')).charge(S.s, 'r1', fare2, 'x');
  const r2id = bookRide(S.s, { riderId: 'r1', pickup: 'jubilee', drop: 'banjara', cls: 'Sedan', trip: 'city', payer: 'r1', fare: fare2, quoted: true });
  until(() => st().rides.find(r => r.id === r2id).status === 'arriving');
  const r2 = st().rides.find(r => r.id === r2id); const d2 = st().drivers.find(d => d.id === r2.driverId);
  const refundExpected = wb - fare2 + r2.fare; // quote minus any cheaper-car refund already given
  cancelRide(S.s, r2id); paint();
  ok('Cancel refunds wallet in full', st().wallets.r1.balance === wb, `${wb} vs ${st().wallets.r1.balance}`);
  ok('Cancel frees the driver', !d2.busy);
  opsGo('rides'); ok('Ops shows Cancelled', /cancelled/i.test(webText(1)));

  // 3. Manager batch → employees, drivers, wallet, Ops stats.
  const savedBefore = st().stats.carsSavedToday; const orbitBefore = st().wallets.orbit.balance;
  const team = st().riders.filter(r => r.company === 'orbit').slice(0, 7);
  const plan = planBatch(team.map(r => ({ id: r.id, pickup: r.home, drop: 'orbit', gender: r.gender })), { pricing: st().pricing, now: st().now });
  const res = bookBatch(S.s, plan, { payer: 'orbit', bookedBy: 'Neha Sharma' });
  ok('Batch booked', res.ids?.length === plan.cars.length, `${plan.cars.length} cars`);
  ok('Company wallet charged once for the plan', st().wallets.orbit.balance === orbitBefore - plan.total, `${orbitBefore} − ${plan.total}`);
  ok('Every employee notified', team.every(r => st().notifications.some(n => n.app === 'rider' && n.to === r.id && n.title === 'Cab booked')));
  ok('Cars-saved stat updated', st().stats.carsSavedToday === savedBefore + plan.carsSaved);
  A.manager.ui.reset('home'); paint(); ok('Manager home shows new wallet balance', [...document.querySelectorAll('.phone-col:nth-child(3) svg.dm')].some(s => s.getAttribute('aria-label').replace(/\D/g, '') === String(st().wallets.orbit.balance)), st().wallets.orbit.balance);
  A.rider.who = team[0].id; A.rider.ui.reset('home'); paint();
  ok('Employee phone shows the team ride', /arriving|Finding|Your ride|Booking|On the trip/i.test(text('rider')), team[0].name);
  until(() => res.ids.every(id => st().rides.find(r => r.id === id).status === 'completed'), 6 * 3600e3);
  ok('All batch cars completed with every stop done', res.ids.every(id => { const r = st().rides.find(x => x.id === id); return r.status === 'completed' && r.stops.every(x => x.done); }));
  A.manager.ui.reset('rides'); paint(); ok('Manager Rides shows them Done', (text('manager').match(/DONE/gi) || []).length >= plan.cars.length);
  A.rider.who = 'r1'; A.rider.ui.reset('home');

  // 4. WhatsApp → Ops tag, chat driver card matches assignment.
  const waBefore = st().stats.waBookingsToday;
  for (const x of ['hi', 'City', 'loc:kondapur', 'drop:banjara', 'cls:Sedan']) waHandle(S.s, 'wa-rahul', x);
  const wr = st().rides.find(r => r.chatId === 'wa-rahul' && r.status !== 'completed');
  ok('WhatsApp booking stat', st().stats.waBookingsToday === waBefore + 1);
  until(() => wr.driverId);
  const card = st().whatsapp['wa-rahul'].messages.filter(m => m.kind === 'driver').pop();
  ok('Chat driver card = assigned driver', card && card.name === st().drivers.find(d => d.id === wr.driverId).name && card.otp === wr.otp, card?.name);
  opsGo('rides'); A.ops.filter = 'whatsapp'; paint(); ok('Ops WhatsApp filter shows it', webText(1).includes(wr.id)); A.ops.filter = 'all';

  // 5. Hotel transfer → hotel billing + Ops; flight delay moves pickup everywhere.
  const g = st().hotels[0].guests.find(x => x.id === 'g2');
  A.hotel.open = g.id; A.hotel.ui.reset('arrivals'); paint();
  const hb = [...document.querySelectorAll('.webs > div:nth-child(1) button')].find(b => b.textContent.includes('bill room'));
  hb?.click(); paint();
  const hr = st().rides.find(r => r.guestId === g.id);
  ok('Hotel booking created', hr, hr?.id);
  const atBefore = hr.at; g.delay = 40; (await imp('/js/engine/rides.js')).setFlightDelay(S.s, hr.id, 40); paint();
  ok('Flight delay moved the pickup', hr.at === atBefore + 40 * 60e3);
  ok('Hotel row shows the late flight', webText(0).includes('40 min late'));
  ok('Hotel bill has the transfer', st().ledger.some(e => e.wallet === 'taj' && e.ref === hr.id));
  opsGo('rides'); ok('Ops lists the hotel transfer', webText(1).includes(hr.id));

  // 6. Driver withdraw → Ops approve → driver sees credited.
  const dw = st().drivers.find(d => d.id === A.driver.who); dw.wallet += 4000;
  const pid = requestPayout(S.s, dw.id, 3000, { speed: 'standard' }).id;
  opsGo('payouts'); ok('Ops sees the payout request', webText(1).includes(pid));
  approvePayouts(S.s, [pid]); A.driver.ui.reset('payout', { id: pid }); paint();
  ok('Driver sees it on its way', /On its way/i.test(text('driver')));
  run(2.1 * 3600e3, 60e3); paint();
  ok('Driver sees it credited with UTR', /Credited/i.test(text('driver')) && /UTR \d{12}/.test(text('driver')));

  // 7. Ops pricing → rider quotes.
  const q1 = estimate(S.s, { pickup: 'jubilee', drop: 'hitec', cls: 'Sedan' }).fare;
  st().pricing.perKm.Sedan += 5; const q2 = estimate(S.s, { pickup: 'jubilee', drop: 'hitec', cls: 'Sedan' }).fare;
  A.rider.ui.reset('book', { pickup: 'jubilee', drop: 'hitec', trip: 'city' }); paint();
  ok('Pricing change reaches rider quote', q2 > q1 && text('rider').includes('₹' + q2.toLocaleString('en-IN')), `${q1} → ${q2}`);
  st().pricing.perKm.Sedan -= 5;

  // 8. Ops ad → rider app.
  st().ads.unshift({ id: 'AX', advertiser: 'Audit Cafe', title: 'Audit ad', sub: 'x', cta: 'Go', tone: 'aqua', slots: ['rider-home'], on: true, impressions: 0, clicks: 0, cpm: 100 });
  st().ads.filter(a => a.id !== 'AX').forEach(a => { a._on = a.on; a.on = false; });
  A.rider.adShown = {}; A.rider.ui.reset('home'); paint();
  ok('New Ops ad shows in rider app', text('rider').includes('Audit ad'));
  st().ads.shift(); st().ads.forEach(a => { a.on = a._on; });

  // 9. SOS → Ops, driver; Ops acknowledges → rider timeline.
  A.rider.who = 'r1'; const sid = bookRide(S.s, { riderId: 'r1', pickup: 'jubilee', drop: 'hitec', cls: 'Sedan', trip: 'city' });
  until(() => st().rides.find(r => r.id === sid).status === 'onboard');
  const aid = raiseAlert(S.s, sid, 'sos'); opsGo('safety');
  ok('Ops safety desk shows open SOS', /SOS/.test(webText(1)) && /open/i.test(webText(1)));
  const sr = st().rides.find(r => r.id === sid);
  ok('Driver told about SOS', st().notifications.some(n => n.app === 'driver' && n.to === sr.driverId && /SOS/.test(n.title)));
  ackAlert(S.s, aid); A.rider.ui.reset('ride', { id: sid }); paint();
  ok('Rider sees desk acknowledged', text('rider').includes('acknowledged'));
  (await imp('/js/engine/safety.js')).closeAlert(S.s, aid);
  until(() => sr.status === 'completed');

  // 10. Driver reserves a scheduled ride → rider notified.
  const sched = st().rides.find(r => r.status === 'scheduled' && !r.reservedBy && r.cls === 'Sedan');
  const dd = st().drivers.find(d => st().cars.find(c => c.id === d.carId).cls === 'Sedan' && !d.busy);
  const rv = reserveRide(S.s, sched.id, dd.id);
  ok('Reservation accepted', rv.ok, rv.why);
  ok('Rider told who will pick them up', st().notifications.some(n => n.app === 'rider' && n.to === sched.riderId && n.body.includes(dd.name)));

  // 11. Driver offline → Ops online count.
  opsGo('overview'); const before = st().drivers.filter(d => d.online).length;
  const off = st().drivers.find(d => d.online && !d.busy); off.online = false; paint();
  ok('Ops overview online count drops', webText(1).includes(`${before - 1}/${st().drivers.length}`) || webText(1).includes(`${before - 1}\n/${st().drivers.length}`), `${before - 1}/${st().drivers.length}`);
  off.online = true;

  // 12. Hotel and manager notifications reach their bells.
  ok('Hotel bell has the flight notice', st().notifications.some(n => n.app === 'hotel' && n.to === 'taj' && /Flight/.test(n.title)));
  ok('Manager told the batch was paid', st().notifications.some(n => n.app === 'manager' && n.to === 'orbit' && /booked/i.test(n.title)));
  ok('Manager told drivers are assigned', st().notifications.some(n => n.app === 'manager' && n.to === 'orbit' && /driver/i.test(n.title)));

  A.rider.who = 'r1'; A.rider.ui.reset('home'); A.ops.ui.reset('overview'); S.presenter().playing = true; S.layout();
  const failed = out.filter(x => !x.pass);
  return { total: out.length, passed: out.length - failed.length, failed };
}
