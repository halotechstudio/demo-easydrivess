// Driver account: withdraw flow with destination and speed, payout tracking, bank and UPI accounts, profile, inbox.
import { h, icon, dotNumber, sentence, topbar, btn, pill, initials, tile } from '../ui/kit.js';
import { led, ledStrip } from '../ui/fx.js';
import { inr, fmtTime, inbox, unread, markRead } from '../engine/store.js';
import { payoutCheck, requestPayout, PAYOUT_SPEEDS, MIN_PAYOUT, DAILY_PAYOUT_LIMIT, addAccount, setPrimary } from '../engine/wallet.js';
import { openSheet, closeSheet, flash, confirmSheet, callSheet } from './sheets.js';
import { reserveRide, releaseRide } from '../engine/rides.js';
import { classEligible } from '../engine/pricing.js';
import { places } from '../engine/geo.js';
import { explainer } from '../ui/explain.js';

const toggle = (on, fn, label) => h('button', { class: 'toggle', 'aria-pressed': String(!!on), 'aria-label': label, onclick: fn });
const STEP = [['requested', 'Requested'], ['approved', 'Approved'], ['sent', 'Sent to bank'], ['paid', 'Credited']];

export function driverAccountScreens({ s, app, ui, me, car, tabbar }) {
  const w = app.wd ||= { amount: null, acct: null, speed: 'instant' };
  const nm = id => places[id]?.name.split(' · ')[0] || id;
  const dayLabel = at => { const d = Math.floor((at + 5.5 * 3600e3) / 864e5) - Math.floor((st().now + 5.5 * 3600e3) / 864e5); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`; };
  function st() { return s.get(); }
  function rideCard(r, mine) {
    const d = me(); const earn = Math.round(r.fare * (1 - st().pricing.commission));
    return h('div', { class: 'card mt12' },
      h('div', { class: 'flex between' },
        h('div', null, h('div', { class: 'label' }, `${dayLabel(r.at)} · ${r.trip === 'airport' ? 'Airport' : r.trip === 'intercity' ? 'Intercity' : 'City'} · ${r.cls}`), h('div', { style: { fontSize: '26px', fontWeight: 300, letterSpacing: '-.02em' } }, fmtTime(r.at))),
        h('div', { style: { textAlign: 'right' } }, h('div', { class: 'label' }, 'You earn'), h('div', { style: { fontSize: '20px', fontWeight: 600, color: 'var(--aqua)' } }, inr(earn)))),
      h('div', { class: 'small mt8' }, `${nm(r.pickup)} → ${nm(r.drop)} · ${r.km} km · about ${r.min} min`),
      h('div', { class: 'mt12' }, mine
        ? h('div', { class: 'flex', style: { gap: '8px' } }, pill('Yours', 'good'), h('span', { class: 'grow label' }, 'Sent to you 20 min before pickup'), h('button', { class: 'btn dark sm', onclick: () => confirmSheet(app, { title: 'Release this booking?', sub: 'It goes back to other drivers. Releasing often lowers your priority.', confirm: 'Release', danger: true, run: () => { releaseRide(s, r.id, d.id); flash(app, 'Released', 'The booking is open to other drivers.', 'info'); } }) }, 'Release'))
        : btn('Accept booking', { kind: 'primary', arrow: true, onClick: () => { const res = reserveRide(s, r.id, d.id); res.ok ? flash(app, 'Booking confirmed', `${nm(r.pickup)} at ${fmtTime(r.at)} is yours.`) : flash(app, 'Could not accept', res.why, 'warn'); } })));
  }
  return {
    scheduled() {
      const d = me(); const c = car();
      const up = st().rides.filter(r => r.status === 'scheduled' && r.at > st().now).sort((a, b) => a.at - b.at);
      const mine = up.filter(r => r.reservedBy === d.id);
      const open = up.filter(r => !r.reservedBy && classEligible(c, st().now).includes(r.cls) && (r.trip !== 'intercity' || d.prefs.intercity) && (r.trip !== 'airport' || d.prefs.airport));
      const earn = mine.reduce((a, r) => a + Math.round(r.fare * (1 - st().pricing.commission)), 0);
      return [topbar('Scheduled'),
        h('div', { class: 'scroll' },
          h('div', { class: 'hero condition' }, h('div', { class: 'num-label' }, 'Booked ahead'),
            h('div', { class: 'num-row' }, dotNumber(String(mine.length), { size: 10, off: false })),
            sentence(mine.length ? ['Rides you have claimed. ', { chip: `${inr(earn)} lined up` }] : [`${open.length} rides open for your ${c.cls}. `, { chip: 'Claim one' }])),
          explainer(app, 'scheduled'),
          mine.length > 0 && h('div', { class: 'card-head mt16' }, h('h3', null, 'Your bookings')),
          mine.map(r => rideCard(r, true)),
          h('div', { class: 'card-head mt16' }, h('h3', null, 'Open for you')),
          open.length ? open.map(r => rideCard(r, false)) : h('div', { class: 'card small' }, 'No open bookings for your car right now. New ones appear as riders schedule.')),
        tabbar('scheduled')];
    },

    withdraw() {
      const d = me();
      if (w.amount == null || w.amount > d.wallet) w.amount = Math.max(0, d.wallet - PAYOUT_SPEEDS[w.speed].fee);
      const acct = d.accounts.find(a => a.id === w.acct) || d.accounts.find(a => a.primary);
      const chk = payoutCheck(s, d.id, w.amount, w.speed);
      const after = d.wallet - w.amount - PAYOUT_SPEEDS[w.speed].fee;
      return [topbar('Withdraw', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'hero money' },
            h('div', { class: 'num-label' }, 'You receive'),
            h('div', { class: 'num-row' }, dotNumber('₹' + (w.amount || 0).toLocaleString('en-IN'), { size: 8, off: false })),
            sentence([`Wallet ${inr(d.wallet)}. `, w.speed === 'instant' ? { chip: `${inr(PAYOUT_SPEEDS.instant.fee)} instant fee` } : { chip: 'No fee' }, ` · ${inr(Math.max(0, after))} stays in your wallet.`])),
          h('input', { type: 'range', class: 'mt16', min: 0, max: d.wallet, step: 50, value: w.amount, 'aria-label': 'Amount', oninput: e => { w.amount = Number(e.target.value); }, onchange: () => ui.dirty() }),
          h('div', { class: 'tabs-sm mt8' }, [['All', d.wallet - PAYOUT_SPEEDS[w.speed].fee], ['Half', Math.floor(d.wallet / 2 / 50) * 50], ['₹500', 500], ['₹1,000', 1000]].map(([l, v]) => h('button', { 'aria-pressed': String(w.amount === v), onclick: () => { w.amount = Math.max(0, Math.min(v, d.wallet)); ui.dirty(); } }, l))),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Send to'), h('button', { class: 'label', style: { color: 'var(--lavender)' }, onclick: () => ui.go('accounts') }, 'Manage')),
            d.accounts.map(a => h('button', { class: 'set', onclick: () => { w.acct = a.id; ui.dirty(); } }, h('span', { class: 'ic' }, icon(a.kind === 'upi' ? 'bolt' : 'money')), h('span', { class: 'grow' }, h('b', null, a.label), h('small', null, a.kind === 'upi' ? 'UPI · arrives in minutes' : `Bank · ${a.ifsc}`)), h('span', { class: `select ${acct?.id === a.id ? 'on' : ''}` }, acct?.id === a.id ? icon('check') : null)))),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Speed')),
            Object.entries(PAYOUT_SPEEDS).map(([k, sp]) => h('button', { class: 'set', onclick: () => { w.speed = k; ui.dirty(); } }, h('span', { class: 'ic' }, icon(k === 'instant' ? 'bolt' : 'clock')), h('span', { class: 'grow' }, h('b', null, `${sp.label} · ${sp.fee ? inr(sp.fee) + ' fee' : 'free'}`), h('small', null, sp.sub)), h('span', { class: `select ${w.speed === k ? 'on' : ''}` }, w.speed === k ? icon('check') : null)))),
          chk.ok && chk.needsApproval && h('p', { class: 'label center mt12' }, `Over ${inr(2000)} needs a quick approval from Easydrivess, usually within 15 minutes.`),
          !chk.ok && w.amount > 0 && h('p', { class: 'small center mt12', style: { color: '#FF8A78' } }, chk.why),
          h('p', { class: 'label center mt8' }, `Minimum ${inr(MIN_PAYOUT)} · up to ${inr(DAILY_PAYOUT_LIMIT)} a day`)),
        h('div', { class: 'dock' }, btn(`Withdraw ${inr(w.amount || 0)}`, { arrow: true, disabled: !chk.ok, onClick: () => {
          const res = requestPayout(s, d.id, w.amount, { accountId: acct?.id, speed: w.speed });
          if (res.error) { flash(app, 'Could not withdraw', res.error, 'warn'); return; }
          w.amount = null; ui.reset('payout', { id: res.id });
        } }))];
    },

    payout({ id }) {
      const p = s.get().payouts.find(x => x.id === id); if (!p) { ui.reset('earnings'); return []; }
      const reached = STEP.filter(([k]) => p.steps?.[k]).length;
      return [topbar('Withdrawal', { back: () => ui.reset('earnings') }),
        h('div', { class: 'scroll' },
          h('div', { class: `hero ${p.status === 'rejected' ? 'alert' : p.status === 'paid' ? 'condition' : 'money'}` },
            h('div', { class: 'num-label' }, { paid: 'Credited', processing: 'On its way', requested: 'Waiting for approval', rejected: 'Returned to wallet' }[p.status]),
            h('div', { class: 'num-row' }, dotNumber('₹' + p.amount.toLocaleString('en-IN'), { size: 8, off: false })),
            p.status === 'processing' && h('div', { class: 'mt8' }, ledStrip(16, 'var(--aqua)')),
            sentence([`To ${p.to}. `, { chip: PAYOUT_SPEEDS[p.speed || 'instant'].label }, p.fee ? ` · fee ${inr(p.fee)}` : ' · no fee', p.utr ? `. ${p.utr}.` : '.'])),
          h('div', { class: 'card mt12' }, h('div', { class: 'stops' }, STEP.map(([k, l], i) => h('div', { class: `stop ${p.steps?.[k] ? 'done' : i === reached ? 'cur' : ''}` },
            h('span', { class: 'n' }, p.steps?.[k] ? icon('check', 12) : i + 1), h('div', null, h('div', { class: 't' }, l), h('div', { class: 's' }, p.steps?.[k] ? fmtTime(p.steps[k]) : i === reached && p.status !== 'rejected' ? 'In progress' : 'Pending')), h('span'))))),
          p.status === 'rejected' && h('div', { class: 'card mt12 small' }, `Returned: ${p.why}. The money is back in your wallet.`),
          h('div', { class: 'tiles mt12' }, tile('Request', p.id), tile('Requested at', fmtTime(p.at))),
          h('div', { class: 'mt12' }, btn('Help with this payout', { kind: 'dark', ic: 'chat', onClick: () => callSheet(app, { name: 'Driver support', role: 'Payouts desk' }) })))];
    },

    accounts() {
      const d = me();
      return [topbar('Bank and UPI', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card', style: { padding: '2px 14px' } }, d.accounts.map(a => h('div', { class: 'set' }, h('span', { class: 'ic' }, icon(a.kind === 'upi' ? 'bolt' : 'money')), h('span', { class: 'grow' }, h('b', null, a.label), h('small', null, a.kind === 'upi' ? 'UPI ID · verified' : `${a.holder} · ${a.ifsc}`)),
            a.primary ? pill('Primary', 'good') : h('button', { class: 'btn dark sm', onclick: () => { setPrimary(s, d.id, a.id); flash(app, 'Primary updated', a.label); } }, 'Make primary')))),
          h('div', { class: 'flex mt12', style: { gap: '8px' } },
            h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => addAcct('upi') }, icon('plus', 17), 'UPI ID'),
            h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => addAcct('bank') }, icon('plus', 17), 'Bank account')),
          h('p', { class: 'label center mt12' }, 'Accounts are checked with a ₹1 penny-drop before the first payout.'))];
    },

    profile() {
      const d = me(); const c = car(); const p = d.prefs;
      const tg = (k, t, sub) => h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, t), sub && h('small', null, sub)), toggle(p[k], () => { p[k] = !p[k]; ui.dirty(); }, t));
      const row = (ic, t, sub, fn) => h('button', { class: 'set', onclick: fn }, h('span', { class: 'ic' }, icon(ic)), h('span', { class: 'grow' }, h('b', null, t), sub && h('small', null, sub)), h('span', { class: 'chev' }, icon('back', 16)));
      return [topbar('Profile'),
        h('div', { class: 'scroll' },
          h('div', { class: 'hero plain', style: { padding: '18px' } }, h('div', { class: 'flex' }, h('div', { class: 'avatar lg violet', style: { width: '62px', height: '62px', fontSize: '20px' } }, initials(d.name)),
            h('div', { class: 'grow' }, h('div', { style: { fontSize: '21px', fontWeight: 500 } }, d.name), h('div', { class: 'label' }, `${d.phone} · ${d.languages}`), h('div', { class: 'flex mt8', style: { gap: '6px' } }, pill(`${d.rating} rating`, 'violet'), pill(`${d.trips.toLocaleString('en-IN')} trips`), pill('Police verified', 'good'))))),
          h('div', { class: 'card mt12', style: { padding: '6px 14px 4px' } }, h('div', { class: 'card-head', style: { margin: '8px 0 0' } }, h('h3', null, 'Account')),
            row('doc', 'Documents', Object.values(d.docs).every(v => v === 'verified') ? 'All verified' : 'Action needed', () => ui.go('docs')),
            row('money', 'Bank and UPI', d.accounts.find(a => a.primary)?.label, () => ui.go('accounts')),
            row('car', 'My car', `${c.model} · ${c.plate}`, () => ui.reset('car'))),
          h('div', { class: 'card mt12', style: { padding: '6px 14px 4px' } }, h('div', { class: 'card-head', style: { margin: '8px 0 0' } }, h('h3', null, 'Ride preferences')),
            tg('airport', 'Airport rides', 'RGIA pickups and drops'), tg('intercity', 'Intercity rides', 'Trips out of Hyderabad'),
            h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, `Pickups within ${p.maxPickupKm} km`), h('small', null, 'Requests further away are skipped'))),
            h('input', { type: 'range', min: 2, max: 12, value: p.maxPickupKm, 'aria-label': 'Pickup distance', oninput: e => { p.maxPickupKm = Number(e.target.value); }, onchange: () => ui.dirty() }),
            h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, 'Auto-accept rides'), h('small', null, 'Accept matching requests without a swipe')), toggle(d.auto, () => { d.auto = !d.auto; s.dispatch('driver', d); }, 'Auto accept'))),
          h('div', { class: 'card mt12', style: { padding: '6px 14px 4px' } }, h('div', { class: 'card-head', style: { margin: '8px 0 0' } }, h('h3', null, 'Notifications')),
            ...['rides', 'payouts', 'promos'].map(k => h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, { rides: 'Ride requests', payouts: 'Payouts', promos: 'Partner offers' }[k])), toggle(p.notifications[k], () => { p.notifications[k] = !p.notifications[k]; ui.dirty(); }, k)))),
          h('div', { class: 'card mt12', style: { padding: '2px 14px' } }, row('chat', 'Driver support', '24×7, Telugu, Hindi, English', () => callSheet(app, { name: 'Driver support', role: '24×7 help desk' })), row('shield', 'Safety desk', 'For emergencies on a trip', () => callSheet(app, { name: 'Easydrivess safety desk', role: 'Emergency line' }))),
          h('div', { class: 'mt12' }, btn(d.online ? 'Go offline' : 'Go online', { kind: 'dark', ic: 'power', onClick: () => { d.online = !d.online; s.dispatch('driver', d); flash(app, d.online ? 'You are online' : 'You are offline', d.online ? 'Ride requests will start coming in.' : 'No new requests until you go online.', 'info'); } }))),
        tabbar('profile')];
    },

    docs() {
      const d = me(); const c = car();
      const list = [['Driving licence', d.docs.licence, 'Valid till 2031 · DigiLocker'], ['Aadhaar', d.docs.aadhaar, 'Verified by OTP'], ['Police verification', d.docs.police, 'Valid till Mar 2027'], ['Bank account', d.docs.bank, 'Penny-drop verified'],
        ...Object.entries(c.docs).map(([k, v]) => [{ rc: 'Vehicle RC', insurance: 'Insurance', permit: 'Permit', puc: 'PUC', fitness: 'Fitness' }[k], v === 'valid' ? 'verified' : v, v === 'valid' ? 'Valid' : `Renew: ${v}`])];
      return [topbar('Documents', { back: ui.back }),
        h('div', { class: 'scroll' }, h('div', { class: 'card', style: { padding: '2px 14px' } }, list.map(([t, v, sub]) => h('div', { class: 'set' }, h('span', { class: 'ic' }, icon('doc')), h('span', { class: 'grow' }, h('b', null, t), h('small', null, sub)),
          v === 'verified' ? pill('Verified', 'good') : h('button', { class: 'btn primary sm', onclick: () => flash(app, 'Uploaded', `${t} sent for review. Usually under 2 hours.`) }, 'Upload')))))];
    },

    inbox() {
      const list = inbox(s, 'driver', app.who);
      return [topbar('Notifications', { back: ui.back, right: unread(s, 'driver', app.who) ? h('button', { class: 'label', style: { color: 'var(--lavender)' }, onclick: () => markRead(s, 'driver', app.who) }, 'Read all') : h('span') }),
        h('div', { class: 'scroll' }, list.length ? h('div', { class: 'card', style: { padding: '2px 14px' } }, list.slice(0, 30).map(n => h('button', { class: `notif ${n.read ? '' : 'unread'}`, onclick: () => { markRead(s, 'driver', app.who, n.id); const p = /Withdraw|Money|payout/i.test(n.title) && s.get().payouts.find(x => x.driverId === app.who); p ? ui.go('payout', { id: p.id }) : ui.dirty(); } },
          h('span', { class: 'ic', style: { color: n.tone === 'good' ? 'var(--aqua)' : n.tone === 'alert' ? 'var(--ember)' : 'var(--periwinkle)' } }, icon(n.kind === 'payout' ? 'money' : n.tone === 'alert' ? 'sos' : 'car', 17)),
          h('span', { class: 'grow' }, h('div', { class: 't', style: { fontWeight: 600, fontSize: '14px' } }, n.title), h('div', { class: 'small' }, n.body), h('div', { class: 'label' }, fmtTime(n.at))))))
          : h('div', { class: 'hero plain center' }, ledStrip(12), h('p', { class: 'sentence mt12' }, 'Ride requests, payouts and alerts show here.')))];
    },
  };

  function addAcct(kind) {
    const st = { a: '', b: '' };
    openSheet(app, { title: kind === 'upi' ? 'Add a UPI ID' : 'Add a bank account', sub: 'Checked with a ₹1 penny-drop, refunded at once.', body: () => [
      h('input', { class: 'input', placeholder: kind === 'upi' ? 'name@bank' : 'Account number', value: st.a, oninput: e => { st.a = e.target.value; } }),
      kind === 'bank' && h('input', { class: 'input mt8', placeholder: 'IFSC, e.g. HDFC0001234', value: st.b, oninput: e => { st.b = e.target.value.toUpperCase(); } }),
      h('div', { class: 'mt12' }, btn('Verify and add', { kind: 'primary', onClick: () => {
        const ok = kind === 'upi' ? /^[\w.-]+@\w+$/.test(st.a) : /^\d{9,18}$/.test(st.a) && /^[A-Z]{4}0\w{6}$/.test(st.b);
        if (!ok) { flash(app, 'Check the details', kind === 'upi' ? 'A UPI ID looks like name@bank.' : 'Account number is 9 to 18 digits; IFSC is 11 characters.', 'warn'); return; }
        const d = me(); addAccount(s, d.id, kind === 'upi' ? { kind, label: st.a, verified: true } : { kind, label: `${st.b.slice(0, 4)} Bank ••${st.a.slice(-4)}`, ifsc: st.b, holder: d.name, verified: true });
        closeSheet(app); flash(app, 'Account verified', '₹1 sent and refunded.');
      } })),
    ] });
  }
}
