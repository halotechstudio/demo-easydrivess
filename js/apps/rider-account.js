// Rider account: profile and settings, Easydrivess Money wallet, payment methods, notification inbox.
import { h, icon, dotNumber, sentence, topbar, btn, pill, initials, tile } from '../ui/kit.js';
import { ledStrip, led } from '../ui/fx.js';
import { inr, fmtTime, inbox, unread, markRead, IST } from '../engine/store.js';
import { placeList } from '../engine/geo.js';
import { CLASSES } from '../engine/pricing.js';
import { topUp, setAutoTopUp } from '../engine/wallet.js';
import { openSheet, closeSheet, flash, confirmSheet, callSheet } from './sheets.js';
import { placeName, ACTIVE } from './common.js';

const toggle = (on, fn, label) => h('button', { class: 'toggle', 'aria-pressed': String(!!on), 'aria-label': label, onclick: fn });
const row = (ic, title, sub, onClick, right) => h('button', { class: 'set', onclick: onClick }, h('span', { class: 'ic' }, icon(ic)), h('span', { class: 'grow' }, h('b', null, title), sub && h('small', null, sub)), right ?? h('span', { class: 'chev' }, icon('back', 16)));
const field = (label, value, onInput, type = 'text') => h('div', { class: 'field mt12' }, h('label', null, label), h('input', { class: 'input', type, value, oninput: e => onInput(e.target.value) }));

export function payLabel(s, rider, ride) {
  const method = ride ? ride.method : rider.payMethod;
  const w = s.get().wallets[rider?.id];
  if (method === 'company') { const co = s.get().companies.find(c => c.id === (ride?.payer || rider.company || rider.workCompany)); return { title: `${co?.name || 'Company'} pays`, sub: 'You pay ₹0', short: 'Company', done: `${inr(ride?.fare || 0)} paid by company` }; }
  if (method === 'wallet') return { title: 'Easydrivess Money', sub: `Balance ${inr(w?.balance || 0)} · paid when you book`, short: 'Wallet', done: 'Paid from Easydrivess Money' };
  if (method === 'cash') return { title: 'Cash', sub: 'Pay the driver at the end', short: 'Cash', done: 'Pay in cash' };
  if (method === 'card') return { title: `Card ••${rider.cards?.[0]?.last4 || '0000'}`, sub: 'Charged after the ride', short: 'Card', done: 'Charged to your card' };
  return { title: `UPI · ${rider.upi?.[0] || 'upi'}`, sub: 'Charged after the ride', short: 'UPI', done: 'Paid by UPI' };
}

export function topUpSheet(app, s, walletId, after) {
  const st = { amt: 500, method: 'UPI' };
  openSheet(app, { title: 'Add money', sub: `Easydrivess Money · balance ${inr(s.get().wallets[walletId].balance)}`, body: () => [
    h('input', { class: 'amount-in', type: 'number', min: 50, value: st.amt, 'aria-label': 'Amount', oninput: e => { st.amt = Math.max(0, Number(e.target.value) || 0); } }),
    h('div', { class: 'tabs-sm', style: { justifyContent: 'center' } }, [200, 500, 1000, 2000].map(a => h('button', { 'aria-pressed': String(st.amt === a), onclick: () => { st.amt = a; app.ui.dirty(); } }, `+${inr(a)}`))),
    h('div', { class: 'seg2 mt16' }, ['UPI', 'Card', 'Net banking'].map(m => h('button', { 'aria-pressed': String(st.method === m), onclick: () => { st.method = m; app.ui.dirty(); } }, m))),
    h('div', { class: 'mt16' }, btn(`Add ${inr(st.amt)} by ${st.method}`, { kind: 'primary', arrow: true, disabled: st.amt < 50, onClick: () => { topUp(s, walletId, st.amt, st.method); closeSheet(app); flash(app, 'Money added', `${inr(st.amt)} added by ${st.method}.`); after?.(); } })),
    h('p', { class: 'label center mt8' }, 'Minimum ₹50. Refunds from cancelled rides land here instantly.'),
  ] });
}

export function payMethodSheet(app, s) {
  const r = s.get().riders.find(x => x.id === app.who); const w = s.get().wallets[app.who];
  const opts = [
    w && ['wallet', 'Easydrivess Money', `Balance ${inr(w.balance)}`, 'wallet'],
    ...r.upi.map(u => ['upi', `UPI · ${u}`, 'Charged after the ride', 'bolt']),
    ...(r.cards || []).map(k => ['card', `${k.brand} ••${k.last4}`, `Expires ${k.exp}`, 'money']),
    ['cash', 'Cash', 'Pay the driver at the end', 'money'],
  ].filter(Boolean);
  openSheet(app, { title: 'Pay with', body: () => [h('div', { class: 'card', style: { padding: '2px 14px' } }, opts.map(([k, t, sub, ic]) => h('button', { class: 'set', onclick: () => { r.payMethod = k; closeSheet(app); flash(app, 'Payment updated', t, 'info'); } },
    h('span', { class: 'ic' }, icon(ic)), h('span', { class: 'grow' }, h('b', null, t), h('small', null, sub)), h('span', { class: `select ${r.payMethod === k ? 'on' : ''}` }, r.payMethod === k ? icon('check') : null)))),
    w && h('div', { class: 'mt12' }, btn('Add money to wallet', { kind: 'dark', ic: 'plus', onClick: () => topUpSheet(app, s, app.who) }))] });
}

// ---------- Wallet ----------
export function walletScreen({ s, app, ui, me, tabbar }) {
  const w = s.get().wallets[app.who];
  if (!w) return [topbar('Wallet'), h('div', { class: 'scroll' }, h('div', { class: 'card' }, h('div', { class: 'small' }, 'Company rides are paid by your employer. Switch to a personal profile to use Easydrivess Money.'))), tabbar('wallet')];
  const f = app.wfilter || 'all';
  const tx = s.get().ledger.filter(e => e.wallet === app.who && (f === 'all' || (f === 'rides' ? e.kind === 'fare' : f === 'added' ? e.kind === 'topup' : ['refund', 'cashback'].includes(e.kind))));
  const spent = s.get().ledger.filter(e => e.wallet === app.who && e.kind === 'fare').reduce((a, e) => a + e.amount, 0);
  return [topbar('Easydrivess Money'),
    h('div', { class: 'scroll' },
      h('div', { class: 'hero money' }, h('div', { class: 'num-label' }, 'Balance'),
        h('div', { class: 'num-row' }, dotNumber('₹' + w.balance.toLocaleString('en-IN'), { size: 8, off: false })),
        sentence(w.auto?.on ? ['Auto top-up adds ', { chip: inr(w.auto.amount) }, ` when you drop below ${inr(w.auto.below)}.`] : ['Pay for rides in one tap. Refunds land here ', { chip: 'instantly' }, '.']),
        h('div', { class: 'flex mt12', style: { gap: '8px' } }, btn('Add money', { kind: 'primary', ic: 'plus', onClick: () => topUpSheet(app, s, app.who) }), h('button', { class: 'btn dark', style: { flex: 'none', padding: '0 16px' }, 'aria-label': 'Payment settings', title: 'Payment settings', onclick: () => ui.go('p-pay') }, icon('settings', 18)))),
      h('div', { class: 'tiles mt12' }, tile('Spent on rides', inr(spent)), tile('Cashback earned', inr(s.get().ledger.filter(e => e.wallet === app.who && e.kind === 'cashback').reduce((a, e) => a + e.amount, 0)))),
      h('div', { class: 'card mt12' }, h('div', { class: 'flex between' }, h('div', null, h('b', { style: { fontWeight: 500 } }, 'Auto top-up'), h('div', { class: 'label' }, `Add ${inr(w.auto?.amount || 500)} by UPI below ${inr(w.auto?.below || 200)}`)), toggle(w.auto?.on, () => { setAutoTopUp(s, app.who, { on: !w.auto?.on }); flash(app, w.auto.on ? 'Auto top-up on' : 'Auto top-up off', '', 'info'); }, 'Auto top-up')),
        w.auto?.on && h('div', { class: 'seg2 mt12' }, [300, 500, 1000].map(a => h('button', { 'aria-pressed': String(w.auto.amount === a), onclick: () => { setAutoTopUp(s, app.who, { amount: a }); } }, `Add ${inr(a)}`)))),
      h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Transactions')),
        h('div', { class: 'tabs-sm' }, [['all', 'All'], ['rides', 'Rides'], ['added', 'Added'], ['back', 'Refunds']].map(([k, l]) => h('button', { 'aria-pressed': String(f === k), onclick: () => { app.wfilter = k; ui.dirty(); } }, l))),
        h('div', { class: 'mt8' }, tx.length ? tx.slice(0, 10).map(e => h('div', { class: 'row' },
          h('span', { class: 'ic', style: { color: e.kind === 'fare' ? 'var(--fg-2)' : 'var(--aqua)' } }, icon(e.kind === 'topup' ? 'plus' : e.kind === 'fare' ? 'car' : e.kind === 'cashback' ? 'spark' : 'repeat')),
          h('div', { class: 'grow' }, h('div', { class: 't' }, e.note), h('div', { class: 's' }, fmtTime(e.at))),
          h('div', { class: 'strong', style: { color: e.kind === 'fare' ? 'var(--fg)' : 'var(--aqua)' } }, `${e.kind === 'fare' ? '−' : '+'}${inr(Math.abs(e.amount))}`))) : h('div', { class: 'small', style: { padding: '12px 0' } }, 'Nothing here yet.')))),
    tabbar('wallet')];
}

// ---------- Notifications ----------
const KIND_ICON = { ride: 'car', wallet: 'wallet', payout: 'money', safety: 'sos', promo: 'ad', system: 'bell' };
export function inboxScreen({ s, app, ui, myRides }) {
  const list = inbox(s, 'rider', app.who);
  const open = n => {
    markRead(s, 'rider', app.who, n.id);
    const r = n.rideId && s.get().rides.find(x => x.id === n.rideId);
    if (r && (ACTIVE.includes(r.status) || r.status === 'completed' && !r.rating)) ui.reset('ride', { id: r.id });
    else if (n.kind === 'wallet') ui.reset('wallet');
    else ui.dirty();
  };
  return [topbar('Notifications', { back: ui.back, right: unread(s, 'rider', app.who) ? h('button', { class: 'label', style: { color: 'var(--lavender)' }, onclick: () => markRead(s, 'rider', app.who) }, 'Read all') : h('span') }),
    h('div', { class: 'scroll' },
      list.length ? h('div', { class: 'card', style: { padding: '2px 14px' } }, list.slice(0, 30).map(n => h('button', { class: `notif ${n.read ? '' : 'unread'}`, onclick: () => open(n) },
        h('span', { class: 'ic', style: { color: n.tone === 'alert' ? 'var(--ember)' : n.tone === 'good' ? 'var(--aqua)' : n.tone === 'warn' ? 'var(--amber)' : 'var(--periwinkle)' } }, icon(KIND_ICON[n.kind] || 'bell', 17)),
        h('span', { class: 'grow' }, h('div', { class: 't', style: { fontWeight: 600, fontSize: '14px' } }, n.title), h('div', { class: 'small' }, n.body), h('div', { class: 'label', style: { marginTop: '3px' } }, fmtTime(n.at))))))
        : h('div', { class: 'hero plain center' }, h('div', { class: 'mt12' }, ledStrip(12)), h('p', { class: 'sentence mt12' }, 'You are all caught up. Ride updates, wallet activity and offers show here.'))),
  ];
}

// ---------- Profile and settings ----------
export function profileScreens({ s, app, ui, me, tabbar, myRides }) {
  const sec = (title, kids) => h('div', { class: 'card mt12', style: { padding: '6px 14px 4px' } }, h('div', { class: 'card-head', style: { margin: '8px 0 0' } }, h('h3', null, title)), kids);
  return {
    profile() {
      const r = me(); const w = s.get().wallets[app.who]; const tpl = s.get().templates.filter(t => t.riderId === app.who);
      return [topbar('Account', { menu: () => ui.go('p-info') }),
        h('div', { class: 'scroll' },
          h('div', { class: 'hero plain', style: { padding: '18px' } },
            h('div', { class: 'flex' }, h('div', { class: 'avatar lg violet', style: { width: '62px', height: '62px', fontSize: '20px' } }, initials(r.name)),
              h('div', { class: 'grow' }, h('div', { style: { fontSize: '21px', fontWeight: 500 } }, r.name), h('div', { class: 'label' }, `${r.phone} · ${r.email}`), h('div', { class: 'flex mt8', style: { gap: '6px' } }, pill(`${r.rating} rating`, 'violet'), pill(`${r.trips} trips`), pill(`Since ${r.since}`)))),
            h('button', { class: 'btn dark sm mt12', style: { width: '100%' }, onclick: () => ui.go('p-info') }, icon('user', 15), 'Edit profile')),
          w && h('button', { class: 'card mt12 flex', style: { width: '100%', textAlign: 'left', gap: '12px' }, onclick: () => ui.reset('wallet') }, h('span', { class: 'ic' }, icon('wallet')), h('span', { class: 'grow' }, h('b', { style: { fontWeight: 500, display: 'block' } }, 'Easydrivess Money'), h('small', { class: 'label' }, w.auto?.on ? 'Auto top-up on' : 'Tap to add money')), h('b', { style: { fontSize: '17px' } }, inr(w.balance))),
          sec('Account', [row('user', 'Personal details', `${r.name} · ${r.email}`, () => ui.go('p-info')), row('pin', 'Saved places', r.saved.map(x => x.label).join(', '), () => ui.go('p-places')), row('wallet', 'Payment methods', payLabel(s, r).title, () => ui.go('p-pay'))]),
          sec('Rides', [row('car', 'Ride preferences', `${r.prefs.cls} · AC ${r.prefs.ac ? 'on' : 'off'}${r.prefs.quiet ? ' · quiet ride' : ''}`, () => ui.go('p-prefs')), row('repeat', 'Repeating rides', tpl.length ? `${tpl.length} active` : 'None yet', () => ui.go('p-repeat')), (r.company || r.workCompany) && row('work', 'Work profile', s.get().companies.find(c => c.id === (r.company || r.workCompany)).name, () => ui.go('p-work'))]),
          sec('Safety', [row('shield', 'Safety centre', 'SOS, 112, ride checks', () => ui.go('safety')), row('users', 'Trusted contacts', r.contacts.map(c => c.name).join(', ') || 'Add someone', () => ui.go('p-contacts'))]),
          sec('App', [row('bell', 'Notifications', Object.values(r.prefs.notify).filter(Boolean).length + ' of 5 on', () => ui.go('p-notify')), row('chat', 'Language', r.prefs.language, () => ui.go('p-lang')), row('doc', 'Privacy and data', 'Location, downloads, deletion', () => ui.go('p-privacy'))]),
          sec('Support', [row('chat', 'Help', 'Rides, payments, lost items', () => ui.go('help')), row('star', 'Rate Easydrivess', null, () => flash(app, 'Thank you', 'Opening the store page.', 'info'))]),
          h('div', { class: 'mt12' }, btn('Log out', { kind: 'dark', onClick: () => confirmSheet(app, { title: 'Log out?', sub: 'You can sign back in with your phone number and an OTP.', confirm: 'Log out', danger: true, run: () => flash(app, 'Demo', 'Logging out is disabled in the demo.', 'info') }) })),
          h('p', { class: 'label center mt12' }, 'Easydrivess 1.0 · Demo build')),
        tabbar('profile')];
    },

    'p-info'() {
      const r = me();
      return [topbar('Personal details', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'center', style: { padding: '8px 0 4px' } }, h('div', { class: 'avatar lg violet', style: { width: '76px', height: '76px', fontSize: '24px', margin: '0 auto' } }, initials(r.name)), h('button', { class: 'label mt8', style: { color: 'var(--lavender)' }, onclick: () => flash(app, 'Photo updated', 'Your new photo is live.') }, 'Change photo')),
          h('div', { class: 'card' },
            field('Full name', r.name, v => { r.name = v; }),
            field('Email', r.email, v => { r.email = v; }, 'email'),
            h('div', { class: 'field mt12' }, h('label', null, 'Mobile'), h('div', { class: 'flex' }, h('input', { class: 'input', value: r.phone, disabled: true }), pill('Verified', 'good'))),
            h('div', { class: 'field mt12' }, h('label', null, 'Gender'), h('div', { class: 'seg2' }, [['f', 'Woman'], ['m', 'Man'], ['x', 'Rather not say']].map(([k, l]) => h('button', { 'aria-pressed': String(r.gender === k), onclick: () => { r.gender = k; ui.dirty(); } }, l)))),
            h('p', { class: 'label mt8' }, 'Gender is used only for the night safety rule on shared rides.'))),
        h('div', { class: 'dock' }, btn('Save', { kind: 'primary', onClick: () => { ui.back(); flash(app, 'Saved', 'Your details are updated.'); } }))];
    },

    'p-places'() {
      const r = me();
      return [topbar('Saved places', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card', style: { padding: '2px 14px' } }, r.saved.map((x, i) => h('div', { class: 'set' }, h('span', { class: 'ic' }, icon(x.label === 'Home' ? 'home' : x.label === 'Airport' ? 'plane' : x.label === 'Work' || x.label === 'Office' ? 'work' : 'pin')), h('span', { class: 'grow' }, h('b', null, x.label), h('small', null, placeName(x.place))),
            h('button', { class: 'iconbtn', 'aria-label': `Remove ${x.label}`, style: { width: '34px', height: '34px' }, onclick: () => confirmSheet(app, { title: `Remove ${x.label}?`, confirm: 'Remove', danger: true, run: () => { r.saved.splice(i, 1); flash(app, 'Removed', `${x.label} is no longer saved.`, 'info'); } }) }, icon('close', 15))))),
          h('div', { class: 'mt12' }, btn('Add a place', { kind: 'dark', ic: 'plus', onClick: () => addPlace(r) })))];
    },

    'p-pay'() {
      const r = me(); const w = s.get().wallets[app.who];
      return [topbar('Payment methods', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card', style: { padding: '2px 14px' } },
            w && payRow('wallet', 'Easydrivess Money', `Balance ${inr(w.balance)}`, 'wallet'),
            r.upi.map(u => payRow('upi', `UPI · ${u}`, 'Verified', 'bolt')),
            (r.cards || []).map(k => payRow('card', `${k.brand} ••${k.last4}`, `Expires ${k.exp}`, 'money')),
            payRow('cash', 'Cash', 'Pay the driver at the end', 'money')),
          h('div', { class: 'flex mt12', style: { gap: '8px' } },
            h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => addUpi(r) }, icon('plus', 17), 'UPI ID'),
            h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => { r.cards.push({ id: 'k' + (r.cards.length + 1), brand: 'Mastercard', last4: String(1000 + Math.floor(Math.random() * 8999)), exp: '11/30' }); flash(app, 'Card added', 'Saved securely with your bank. CVV is never stored.'); } }, icon('plus', 17), 'Card')),
          h('p', { class: 'label center mt12' }, 'Tap a method to make it your default.'))];
      function payRow(k, t, sub, ic) { return h('button', { class: 'set', onclick: () => { r.payMethod = k; ui.dirty(); } }, h('span', { class: 'ic' }, icon(ic)), h('span', { class: 'grow' }, h('b', null, t), h('small', null, sub)), r.payMethod === k ? pill('Default', 'good') : h('span', { class: 'label' }, 'Set default')); }
    },

    'p-prefs'() {
      const p = me().prefs;
      const tg = (k, t, sub) => h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, t), sub && h('small', null, sub)), toggle(p[k], () => { p[k] = !p[k]; ui.dirty(); }, t));
      return [topbar('Ride preferences', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', null, 'Default car')), h('div', { class: 'seg2' }, CLASSES.map(c => h('button', { 'aria-pressed': String(p.cls === c), onclick: () => { p.cls = c; app.lastCls = c; ui.dirty(); } }, c)))),
          h('div', { class: 'card mt12', style: { padding: '2px 14px' } }, tg('ac', 'AC on', 'Driver sets AC before pickup'), tg('quiet', 'Quiet ride', 'Driver keeps conversation to a minimum'), tg('luggage', 'Extra luggage', 'Match cars with a bigger boot'), tg('pet', 'Travelling with a pet', 'Pet-friendly drivers only'), tg('womenDriver', 'Prefer women drivers', 'When one is nearby, at no extra cost'), tg('nightShare', 'Auto-share night rides', 'Trusted contacts get a live link after 9 PM')),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Music')), h('div', { class: 'seg2' }, ['Off', "Driver's choice", 'My phone'].map(m => h('button', { 'aria-pressed': String(p.music === m), onclick: () => { p.music = m; ui.dirty(); } }, m)))))];
    },

    'p-repeat'() {
      const tpl = s.get().templates.filter(t => t.riderId === app.who);
      return [topbar('Repeating rides', { back: ui.back }),
        h('div', { class: 'scroll' },
          tpl.length ? h('div', { class: 'card', style: { padding: '2px 14px' } }, tpl.map(t => h('div', { class: 'set' }, h('span', { class: 'ic' }, icon('repeat')), h('span', { class: 'grow' }, h('b', null, t.label), h('small', null, `${t.days.length === 5 ? 'Weekdays' : t.days.length + ' days'} · ${t.time} · ${t.cls}`)), toggle(!t.paused, () => { t.paused = !t.paused; if (t.paused) { t.days0 = t.days; t.days = []; } else t.days = t.days0 || [1, 2, 3, 4, 5]; ui.dirty(); }, 'Active'))))
            : h('div', { class: 'card small' }, 'None yet. Turn on "Repeat every weekday" when you schedule a ride.'),
          h('div', { class: 'mt12' }, btn('Schedule a repeating ride', { kind: 'dark', ic: 'plus', onClick: () => { app.schRep = true; ui.go('schedule', { pickup: 'jubilee' }); } })))];
    },

    'p-work'() {
      const r = me(); const co = s.get().companies.find(c => c.id === (r.company || r.workCompany)); const pol = s.get().policies?.[co.id];
      return [topbar('Work profile', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card' }, h('div', { style: { fontSize: '18px', fontWeight: 500 } }, co.name), h('div', { class: 'label' }, `Rides paid by the company wallet · approver ${co.manager}`)),
          pol && h('div', { class: 'card mt12', style: { padding: '2px 14px' } }, [['Allowed cars', pol.classes.join(', ')], ['Fare limit per ride', inr(pol.maxFare)], ['Needs approval above', inr(pol.approvalAbove)], ['Weekend rides', pol.weekendRides ? 'Allowed' : 'Not allowed']].map(([k, v]) => h('div', { class: 'set' }, h('span', { class: 'grow' }, h('small', null, k)), h('b', { style: { fontWeight: 500 } }, v)))),
          h('div', { class: 'card mt12 flex between' }, h('div', null, h('b', { style: { fontWeight: 500 } }, 'Use Work profile on weekdays'), h('div', { class: 'label' }, '9 AM to 8 PM, switches automatically')), toggle(app.autoWork, () => { app.autoWork = !app.autoWork; ui.dirty(); }, 'Auto work profile')))];
    },

    'p-contacts'() {
      const r = me();
      return [topbar('Trusted contacts', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('p', { class: 'small', style: { margin: '0 4px 10px' } }, 'They get a live link when you press SOS, and on rides you choose to share.'),
          h('div', { class: 'card', style: { padding: '2px 14px' } }, r.contacts.map((c, i) => h('div', { class: 'set' }, h('div', { class: 'avatar' }, initials(c.name)), h('span', { class: 'grow' }, h('b', null, c.name), h('small', null, `${c.phone}${c.auto ? ' · auto-share at night' : ''}`)),
            toggle(c.auto, () => { c.auto = !c.auto; ui.dirty(); }, 'Auto share'),
            h('button', { class: 'iconbtn', 'aria-label': `Remove ${c.name}`, style: { width: '34px', height: '34px' }, onclick: () => confirmSheet(app, { title: `Remove ${c.name}?`, confirm: 'Remove', danger: true, run: () => { r.contacts.splice(i, 1); r.contact = r.contacts[0] || { name: 'No contact', phone: '' }; } }) }, icon('close', 15))))),
          h('div', { class: 'mt12' }, btn('Add a contact', { kind: 'dark', ic: 'plus', onClick: () => addContact(r) })))];
    },

    'p-notify'() {
      const n = me().prefs.notify;
      const tg = (k, t, sub) => h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, t), h('small', null, sub)), toggle(n[k], () => { n[k] = !n[k]; ui.dirty(); }, t));
      return [topbar('Notifications', { back: ui.back }),
        h('div', { class: 'scroll' }, h('div', { class: 'card', style: { padding: '2px 14px' } },
          tg('rides', 'Ride updates', 'Driver assigned, arriving, OTP, arrival'), tg('wallet', 'Wallet and payments', 'Money added, refunds, low balance'), tg('promos', 'Offers', 'Sponsored deals from partners'), tg('whatsapp', 'WhatsApp updates', 'Trip details on WhatsApp too'), tg('email', 'Email receipts', `To ${me().email}`)),
          h('p', { class: 'label center mt12' }, 'Safety alerts are always on.'))];
    },

    'p-lang'() {
      const p = me().prefs;
      return [topbar('Language', { back: ui.back }),
        h('div', { class: 'scroll' }, h('div', { class: 'card', style: { padding: '2px 14px' } }, [['English', 'English'], ['తెలుగు', 'Telugu'], ['हिन्दी', 'Hindi'], ['اردو', 'Urdu']].map(([l, en]) => h('button', { class: 'set', onclick: () => { p.language = en; ui.dirty(); flash(app, 'Language set', `${en}. The demo stays in English.`, 'info'); } }, h('span', { class: 'grow' }, h('b', null, l), h('small', null, en)), h('span', { class: `select ${p.language === en ? 'on' : ''}` }, p.language === en ? icon('check') : null)))))];
    },

    'p-privacy'() {
      return [topbar('Privacy and data', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card', style: { padding: '2px 14px' } },
            h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, 'Location'), h('small', null, 'Shared only while a ride is active')), pill('Ride only', 'good')),
            row('doc', 'Download my data', 'Trips, payments and settings as a file', () => flash(app, 'Requested', `We will email ${me().email} within 24 hours.`)),
            row('shield', 'Ad personalisation', 'Ads never use your trip history', () => flash(app, 'Always private', 'Advertisers never see your trips.', 'info'))),
          h('div', { class: 'card mt12', style: { padding: '2px 14px' } }, row('close', 'Delete account', 'Removes your data under the DPDP Act, 2023', () => confirmSheet(app, { title: 'Delete your account?', sub: 'Your wallet balance is refunded to your UPI first. This cannot be undone.', confirm: 'Delete account', danger: true, run: () => flash(app, 'Demo', 'Deletion is disabled in the demo.', 'info') }))))];
    },

    safety() {
      const r = me();
      return [topbar('Safety centre', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('p', { class: 'display', style: { fontSize: '30px', margin: '6px 0 16px' } }, 'Your safety,', h('br'), h('span', { class: 'dim' }, 'one tap away.')),
          h('div', { class: 'flex', style: { gap: '8px' } }, btn('Call 112', { kind: 'violet', ic: 'phone', onClick: () => callSheet(app, { name: 'Police · 112', role: 'Emergency services', number: '112' }) }), h('button', { class: 'btn dark', style: { flex: 1 }, onclick: () => ui.go('p-contacts') }, icon('users', 18), 'Contacts')),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'On every ride')),
            ['OTP before boarding', 'Verified drivers, police checked', 'Car condition checked daily', 'Route deviation alerts', 'Masked calls'].map(t => h('div', { class: 'row' }, led('var(--aqua)'), h('div', { class: 'grow t' }, t), pill('On', 'good')))))];
    },

    help({ rideId } = {}) {
      const topics = ['I was charged the wrong fare', 'I left something in the car', 'My driver was unprofessional', 'The car was not clean', 'Refund for a cancelled ride', 'Something else'];
      return [topbar('Help', { back: ui.back }),
        h('div', { class: 'scroll' },
          rideId && h('div', { class: 'card small' }, `About ride ${rideId}`),
          h('div', { class: 'card mt12', style: { padding: '2px 14px' } }, topics.map(t => row('chat', t, null, () => openSheet(app, { title: t, sub: 'A support agent replies within 5 minutes, 24×7.', body: () => [h('textarea', { class: 'input', style: { height: '96px', paddingTop: '10px' }, placeholder: 'Tell us what happened' }), h('div', { class: 'mt12' }, btn('Send to support', { kind: 'primary', onClick: () => { closeSheet(app); flash(app, 'Ticket raised', `Ticket #${4800 + Math.floor(Math.random() * 99)}. We will reply in the app and by SMS.`); } }))] })))),
          h('div', { class: 'mt12' }, btn('Call support', { kind: 'dark', ic: 'phone', onClick: () => callSheet(app, { name: 'Easydrivess support', role: '24×7 help desk' }) })))];
    },
  };

  function addPlace(r) {
    const st = { label: 'Gym', place: 'kondapur' };
    openSheet(app, { title: 'Add a place', body: () => [
      h('div', { class: 'tabs-sm' }, ['Gym', 'College', 'Parents', 'Other'].map(l => h('button', { 'aria-pressed': String(st.label === l), onclick: () => { st.label = l; app.ui.dirty(); } }, l))),
      h('div', { class: 'card mt12', style: { padding: '2px 14px', maxHeight: '220px', overflow: 'auto' } }, placeList.filter(p => p.kind !== 'city').map(p => h('button', { class: 'set', onclick: () => { st.place = p.id; app.ui.dirty(); } }, h('span', { class: 'grow' }, h('b', null, p.name)), h('span', { class: `select ${st.place === p.id ? 'on' : ''}` }, st.place === p.id ? icon('check') : null)))),
      h('div', { class: 'mt12' }, btn(`Save ${st.label}`, { kind: 'primary', onClick: () => { r.saved.push({ ...st }); closeSheet(app); flash(app, 'Place saved', `${st.label} · ${placeName(st.place)}`); } })),
    ] });
  }
  function addUpi(r) {
    const st = { v: '' };
    openSheet(app, { title: 'Add a UPI ID', sub: 'We verify it with a ₹1 request that is refunded at once.', body: () => [h('input', { class: 'input', placeholder: 'name@bank', value: st.v, oninput: e => { st.v = e.target.value; } }),
      h('div', { class: 'mt12' }, btn('Verify and add', { kind: 'primary', onClick: () => { if (!/^[\w.-]+@\w+$/.test(st.v)) { flash(app, 'Check the UPI ID', 'It looks like name@bank.', 'warn'); return; } r.upi.push(st.v); closeSheet(app); flash(app, 'UPI ID verified', st.v); } }))] });
  }
  function addContact(r) {
    const st = { name: '', phone: '+91 ' };
    openSheet(app, { title: 'Add a trusted contact', body: () => [field('Name', st.name, v => { st.name = v; }), field('Mobile', st.phone, v => { st.phone = v; }, 'tel'),
      h('div', { class: 'mt16' }, btn('Add contact', { kind: 'primary', onClick: () => { if (!st.name.trim() || st.phone.replace(/\D/g, '').length < 12) { flash(app, 'Add a name and a 10-digit number', '', 'warn'); return; } r.contacts.push({ id: 'c' + (r.contacts.length + 1), name: st.name.trim(), phone: st.phone, auto: true }); closeSheet(app); flash(app, 'Contact added', `${st.name} will get your live link on SOS.`); } }))] });
  }
}
