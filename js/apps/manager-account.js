// Manager account: company wallet (top-up methods, auto top-up, team budgets, transactions, invoices), company settings, inbox.
import { h, icon, dotNumber, sentence, topbar, btn, pill, initials, tile } from '../ui/kit.js';
import { ledStrip } from '../ui/fx.js';
import { inr, fmtTime, inbox, unread, markRead } from '../engine/store.js';
import { CLASSES } from '../engine/pricing.js';
import { topUp, setAutoTopUp } from '../engine/wallet.js';
import { openSheet, closeSheet, flash, confirmSheet, callSheet } from './sheets.js';

const toggle = (on, fn, label) => h('button', { class: 'toggle', 'aria-pressed': String(!!on), 'aria-label': label, onclick: fn });
const row = (ic, t, sub, fn, right) => h('button', { class: 'set', onclick: fn }, h('span', { class: 'ic' }, icon(ic)), h('span', { class: 'grow' }, h('b', null, t), sub && h('small', null, sub)), right ?? h('span', { class: 'chev' }, icon('back', 16)));

export function managerAccountScreens({ s, app, ui, co, staff, wallet, tabbar }) {
  const st = () => s.get();

  function addMoney() {
    const w = wallet(); const f = { amt: 25000, method: 'UPI' };
    openSheet(app, { title: 'Add money', sub: `${co().name} wallet · balance ${inr(w.balance)}`, body: () => [
      h('input', { class: 'amount-in', type: 'number', value: f.amt, 'aria-label': 'Amount', oninput: e => { f.amt = Math.max(0, Number(e.target.value) || 0); } }),
      h('div', { class: 'tabs-sm', style: { justifyContent: 'center' } }, [10000, 25000, 50000, 100000].map(a => h('button', { 'aria-pressed': String(f.amt === a), onclick: () => { f.amt = a; app.ui.dirty(); } }, inr(a)))),
      h('div', { class: 'seg2 mt16' }, ['UPI', 'Net banking', 'Card', 'Bank transfer'].map(m => h('button', { 'aria-pressed': String(f.method === m), onclick: () => { f.method = m; app.ui.dirty(); } }, m))),
      f.method === 'Bank transfer' ? h('div', { class: 'card mt12' }, h('div', { class: 'label' }, 'Send NEFT or RTGS to your company\'s own account. It is credited automatically within 30 minutes.'),
        [['Bank', w.va.bank], ['Account', w.va.account], ['IFSC', w.va.ifsc], ['Name', `Easydrivess · ${co().name}`]].map(([k, v]) => h('div', { class: 'set' }, h('span', { class: 'grow' }, h('small', null, k)), h('b', { style: { fontWeight: 500 } }, v))),
        h('div', { class: 'mt12' }, btn('Simulate transfer arriving', { kind: 'dark', onClick: () => { topUp(s, app.company, f.amt, 'Bank transfer'); closeSheet(app); flash(app, 'Transfer received', `${inr(f.amt)} credited.`); } })))
        : h('div', { class: 'mt16' }, btn(`Pay ${inr(f.amt)} by ${f.method}`, { kind: 'primary', arrow: true, disabled: f.amt < 1000, onClick: () => { topUp(s, app.company, f.amt, f.method); closeSheet(app); flash(app, 'Money added', `${inr(f.amt)} by ${f.method}. GST invoice sent to accounts.`); } })),
    ] });
  }

  return {
    wallet() {
      const w = wallet(); const f = app.tf || 'all';
      const tx = st().ledger.filter(e => e.wallet === app.company && (f === 'all' || (f === 'rides' ? e.kind === 'fare' : f === 'added' ? e.kind === 'topup' : e.kind === 'refund')));
      const monthSpend = st().ledger.filter(e => e.wallet === app.company && e.kind === 'fare').reduce((a, e) => a + e.amount, 0) + 182400;
      const budgets = st().budgets?.[app.company] || [];
      return [topbar('Company wallet'),
        h('div', { class: 'scroll' },
          h('div', { class: 'hero money' }, h('div', { class: 'num-label' }, 'Balance'),
            h('div', { class: 'num-row' }, dotNumber('₹' + w.balance.toLocaleString('en-IN'), { size: 6.5, off: false })),
            sentence(w.auto?.on ? ['Auto top-up adds ', { chip: inr(w.auto.amount) }, ` by ${w.auto.method} below ${inr(w.auto.below)}.`] : [`About ${Math.floor(w.balance / 290)} rides left. `, { chip: 'Auto top-up off' }]),
            h('div', { class: 'flex mt12', style: { gap: '8px' } }, btn('Add money', { kind: 'primary', ic: 'plus', onClick: addMoney }), h('button', { class: 'btn dark', style: { flex: 'none', padding: '0 16px' }, 'aria-label': 'Invoices', onclick: () => ui.go('invoices') }, icon('doc', 18)))),
          h('div', { class: 'tiles mt12' }, tile('Spent this month', inr(monthSpend)), tile('Saved by sharing', inr(st().stats.savedToday + 21600))),
          h('div', { class: 'card mt12' }, h('div', { class: 'flex between' }, h('div', null, h('b', { style: { fontWeight: 500 } }, 'Auto top-up'), h('div', { class: 'label' }, `${inr(w.auto.amount)} by ${w.auto.method} when below ${inr(w.auto.below)}`)), toggle(w.auto?.on, () => setAutoTopUp(s, app.company, { on: !w.auto.on }), 'Auto top-up')),
            w.auto?.on && [h('div', { class: 'label mt12' }, 'Add'), h('div', { class: 'seg2 mt8' }, [10000, 25000, 50000].map(a => h('button', { 'aria-pressed': String(w.auto.amount === a), onclick: () => setAutoTopUp(s, app.company, { amount: a }) }, inr(a)))),
              h('div', { class: 'label mt12' }, 'When balance drops below'), h('div', { class: 'seg2 mt8' }, [2000, 5000, 10000].map(a => h('button', { 'aria-pressed': String(w.auto.below === a), onclick: () => setAutoTopUp(s, app.company, { below: a }) }, inr(a))))]),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Team budgets'), h('span', { class: 'label' }, 'This month')),
            budgets.map(b => { const pct = Math.min(100, b.spent / b.limit * 100); return h('div', { style: { padding: '8px 0' } },
              h('div', { class: 'flex between' }, h('span', { style: { fontSize: '14px', fontWeight: 500 } }, b.team), h('span', { class: 'label' }, `${inr(b.spent)} of ${inr(b.limit)}`)),
              h('div', { style: { height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,.08)', marginTop: '6px', overflow: 'hidden' } }, h('div', { style: { width: pct + '%', height: '100%', borderRadius: '3px', background: pct > 85 ? 'var(--ember)' : pct > 60 ? 'var(--amber)' : 'var(--aqua)', boxShadow: `0 0 8px ${pct > 85 ? 'var(--ember)' : 'var(--aqua)'}` } }))); })),
          h('div', { class: 'card mt12' }, h('div', { class: 'card-head' }, h('h3', null, 'Transactions')),
            h('div', { class: 'tabs-sm' }, [['all', 'All'], ['rides', 'Rides'], ['added', 'Added'], ['refunds', 'Refunds']].map(([k, l]) => h('button', { 'aria-pressed': String(f === k), onclick: () => { app.tf = k; ui.dirty(); } }, l))),
            h('div', { class: 'mt8' }, tx.length ? tx.slice(0, 10).map(e => h('div', { class: 'row' }, h('span', { class: 'ic', style: { color: e.kind === 'fare' ? 'var(--fg-2)' : 'var(--aqua)' } }, icon(e.kind === 'topup' ? 'plus' : e.kind === 'refund' ? 'repeat' : 'car')), h('div', { class: 'grow' }, h('div', { class: 't' }, e.note), h('div', { class: 's' }, fmtTime(e.at))), h('div', { class: 'strong', style: { color: e.kind === 'fare' ? 'var(--fg)' : 'var(--aqua)' } }, `${e.kind === 'fare' ? '−' : '+'}${inr(Math.abs(e.amount))}`)))
              : h('div', { class: 'small', style: { padding: '12px 0' } }, 'Nothing in this view yet.')))),
        tabbar('wallet')];
    },

    invoices() {
      const months = [['November 2026', 'Running', 64210], ['October 2026', 'Paid', 182400], ['September 2026', 'Paid', 171930]];
      return [topbar('Invoices', { back: ui.back }),
        h('div', { class: 'scroll' },
          h('div', { class: 'card small' }, `GSTIN ${co().gstin} · sent monthly to accounts@${app.company}.in`),
          h('div', { class: 'card mt12', style: { padding: '2px 14px' } }, months.map(([m, sts, amt]) => row('doc', m, `${inr(amt)} · ${sts}`, () => flash(app, 'Downloading', `${m} invoice as PDF and Excel.`, 'info'), pill(sts, sts === 'Paid' ? 'good' : 'violet')))))];
    },

    settings() {
      const pol = st().policies[app.company];
      return [topbar('Company'),
        h('div', { class: 'scroll' },
          h('div', { class: 'hero plain', style: { padding: '18px' } }, h('div', { class: 'flex' }, h('div', { class: 'avatar lg violet', style: { width: '58px', height: '58px' } }, initials(co().name)),
            h('div', { class: 'grow' }, h('div', { style: { fontSize: '20px', fontWeight: 500 } }, co().name), h('div', { class: 'label' }, `${co().manager} · Admin · GSTIN ${co().gstin}`)))),
          h('div', { class: 'card mt12', style: { padding: '6px 14px 4px' } }, h('div', { class: 'card-head', style: { margin: '8px 0 0' } }, h('h3', null, 'People')),
            row('users', 'Team', `${staff().length} people · 1 join request`, () => ui.go('team')),
            row('user', 'Admins', `${co().manager} and 1 more`, () => flash(app, 'Admins', 'Neha Sharma (owner), Arjun Rao (finance).', 'info'))),
          h('div', { class: 'card mt12', style: { padding: '6px 14px 4px' } }, h('div', { class: 'card-head', style: { margin: '8px 0 0' } }, h('h3', null, 'Ride policy')),
            h('div', { class: 'label', style: { padding: '6px 2px' } }, 'Cars employees may book'),
            h('div', { class: 'seg2' }, CLASSES.map(c => h('button', { 'aria-pressed': String(pol.classes.includes(c)), onclick: () => { pol.classes = pol.classes.includes(c) ? pol.classes.filter(x => x !== c) : [...pol.classes, c]; ui.dirty(); } }, c))),
            h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, `Fare limit ${inr(pol.maxFare)}`), h('small', null, 'Per ride, per employee'))),
            h('input', { type: 'range', min: 500, max: 5000, step: 100, value: pol.maxFare, 'aria-label': 'Fare limit', oninput: e => { pol.maxFare = Number(e.target.value); }, onchange: () => ui.dirty() }),
            h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, `Approval above ${inr(pol.approvalAbove)}`), h('small', null, 'You approve before the car is sent'))),
            h('input', { type: 'range', min: 300, max: 3000, step: 100, value: pol.approvalAbove, 'aria-label': 'Approval threshold', oninput: e => { pol.approvalAbove = Number(e.target.value); }, onchange: () => ui.dirty() }),
            ...[['shareByDefault', 'Share cars by default', 'Smart plan groups same-route riders'], ['nightRule', 'Night safety rule', 'Women never first pickup or last drop after 8 PM'], ['weekendRides', 'Weekend rides', 'Employees can book on Saturday and Sunday']].map(([k, t, sub]) => h('div', { class: 'set' }, h('span', { class: 'grow' }, h('b', null, t), h('small', null, sub)), toggle(pol[k], () => { pol[k] = !pol[k]; if (k === 'shareByDefault') app.share = pol[k]; ui.dirty(); }, t)))),
          h('div', { class: 'card mt12', style: { padding: '6px 14px 4px' } }, h('div', { class: 'card-head', style: { margin: '8px 0 0' } }, h('h3', null, 'Billing')),
            row('wallet', 'Company wallet', inr(wallet().balance), () => ui.reset('wallet')),
            row('doc', 'Invoices', 'Monthly GST invoices', () => ui.go('invoices')),
            row('money', 'Team budgets', `${(st().budgets[app.company] || []).length} teams`, () => ui.reset('wallet'))),
          h('div', { class: 'card mt12', style: { padding: '2px 14px' } }, row('bell', 'Notifications', 'Bookings, SOS, low wallet', () => ui.go('inbox')), row('chat', 'Account manager', 'Easydrivess corporate desk', () => callSheet(app, { name: 'Corporate desk', role: 'Your account manager' })))),
        tabbar('settings')];
    },

    inbox() {
      const list = inbox(s, 'manager', app.company);
      return [topbar('Notifications', { back: ui.back, right: unread(s, 'manager', app.company) ? h('button', { class: 'label', style: { color: 'var(--lavender)' }, onclick: () => markRead(s, 'manager', app.company) }, 'Read all') : h('span') }),
        h('div', { class: 'scroll' }, list.length ? h('div', { class: 'card', style: { padding: '2px 14px' } }, list.slice(0, 30).map(n => h('button', { class: `notif ${n.read ? '' : 'unread'}`, onclick: () => { markRead(s, 'manager', app.company, n.id); n.kind === 'wallet' ? ui.reset('wallet') : n.tone === 'alert' ? ui.reset('rides') : ui.dirty(); } },
          h('span', { class: 'ic', style: { color: n.tone === 'alert' ? 'var(--ember)' : n.tone === 'good' ? 'var(--aqua)' : n.tone === 'warn' ? 'var(--amber)' : 'var(--periwinkle)' } }, icon(n.kind === 'wallet' ? 'wallet' : n.tone === 'alert' ? 'sos' : 'bell', 17)),
          h('span', { class: 'grow' }, h('div', { class: 't', style: { fontWeight: 600, fontSize: '14px' } }, n.title), h('div', { class: 'small' }, n.body), h('div', { class: 'label' }, fmtTime(n.at))))))
          : h('div', { class: 'hero plain center' }, ledStrip(12), h('p', { class: 'sentence mt12' }, 'Bookings, wallet alerts and safety alerts for your team show here.')))];
    },
  };
}
