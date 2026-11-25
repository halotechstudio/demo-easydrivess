import { uid, notify, inr } from './store.js';

// Wallets: company (prepaid, manager), hotel (postpaid bill), rider (Easydrivess Money). Drivers hold a payout balance.
export const AUTO_PAYOUT_LIMIT = 2000;
export const MIN_PAYOUT = 100;
export const DAILY_PAYOUT_LIMIT = 25000;
export const PAYOUT_SPEEDS = {
  instant: { label: 'Instant', sub: 'UPI or IMPS, in about 2 minutes', fee: 5, ms: 90e3 },
  standard: { label: 'Standard', sub: 'Bank transfer, within 2 hours', fee: 0, ms: 2 * 3600e3 },
};

function entry(s, kind, ref, amount, wallet, note) {
  const e = { id: uid(s, 'L'), at: s.get().now, kind, ref, amount, wallet, note };
  s.get().ledger.unshift(e); s.dispatch('ledger', e); return e;
}
const ownerApp = w => (w.personal ? ['rider', w.id] : w.postpaid ? ['hotel', w.id] : ['manager', w.id]);

export function topUp(s, walletId, amount, method = 'UPI') {
  const w = s.get().wallets[walletId]; w.balance += amount;
  entry(s, 'topup', walletId, amount, walletId, `Added by ${method}`);
  const [app, to] = ownerApp(w);
  notify(s, app, to, 'Money added', `${inr(amount)} added by ${method}. Balance ${inr(w.balance)}.`, 'good', 'wallet');
  return w.balance;
}

// Prepaid wallets block what they cannot cover unless auto top-up is on. Postpaid (hotel) accrue a monthly bill.
export function charge(s, walletId, amount, ref, note) {
  if (walletId === 'self') { entry(s, 'fare', ref, amount, 'ops', note || 'Rider paid by UPI'); return 'ok'; }
  const w = s.get().wallets[walletId];
  if (!w) return 'no-wallet';
  if (!w.postpaid && w.balance < amount && w.auto?.on) {
    while (w.balance < amount) topUp(s, walletId, w.auto.amount, `auto top-up (${w.auto.method || 'UPI'})`);
  }
  if (!w.postpaid && w.balance < amount) return 'insufficient';
  w.balance += w.postpaid ? amount : -amount;
  entry(s, 'fare', ref, amount, walletId, note || (w.postpaid ? 'Added to monthly bill' : 'Paid from wallet'));
  if (!w.postpaid && w.auto?.on && w.balance < w.auto.below) topUp(s, walletId, w.auto.amount, `auto top-up (${w.auto.method || 'UPI'})`);
  else if (!w.postpaid && w.low && w.balance < w.low) { const [app, to] = ownerApp(w); notify(s, app, to, 'Wallet running low', `Balance ${inr(w.balance)}. Add money to keep rides booking.`, 'warn', 'wallet'); }
  return 'ok';
}

export function refund(s, walletId, amount, ref, note = 'Refund') {
  const w = s.get().wallets[walletId]; if (!w || amount <= 0) return;
  w.balance += w.postpaid ? -amount : amount;
  entry(s, 'refund', ref, amount, walletId, note);
  const [app, to] = ownerApp(w);
  notify(s, app, to, 'Refund', `${inr(amount)} back in your wallet. ${note}.`, 'good', 'wallet');
}

export function setAutoTopUp(s, walletId, auto) { const w = s.get().wallets[walletId]; w.auto = { ...w.auto, ...auto }; s.dispatch('wallet', w); }

export function driverCredit(s, d, ride) {
  const earn = Math.round(ride.fare * (1 - s.get().pricing.commission));
  d.wallet += earn; d.today += earn;
  entry(s, 'driver', ride.id, -earn, d.id, `Driver share to ${d.name}`);
  return earn;
}

// ---------- Driver payouts: requested → approved → sent → credited ----------
export function payoutCheck(s, driverId, amount, speed = 'instant') {
  const st = s.get(); const d = st.drivers.find(x => x.id === driverId);
  const fee = PAYOUT_SPEEDS[speed].fee;
  const today = st.payouts.filter(p => p.driverId === driverId && st.now - p.at < 86400e3 && p.status !== 'rejected').reduce((a, p) => a + p.amount, 0);
  if (amount < MIN_PAYOUT) return { ok: false, why: `Minimum withdrawal is ${inr(MIN_PAYOUT)}.` };
  if (amount + fee > d.wallet) return { ok: false, why: `You have ${inr(d.wallet)}${fee ? `, and instant has a ${inr(fee)} fee` : ''}.` };
  if (today + amount > DAILY_PAYOUT_LIMIT) return { ok: false, why: `Daily limit is ${inr(DAILY_PAYOUT_LIMIT)}. ${inr(DAILY_PAYOUT_LIMIT - today)} left today.` };
  return { ok: true, fee, needsApproval: amount > AUTO_PAYOUT_LIMIT };
}

export function requestPayout(s, driverId, amount, { accountId, speed = 'instant' } = {}) {
  const st = s.get(); const d = st.drivers.find(x => x.id === driverId);
  const check = payoutCheck(s, driverId, amount, speed);
  if (!check.ok) return { error: check.why };
  const acct = (d.accounts || []).find(a => a.id === accountId) || (d.accounts || []).find(a => a.primary) || { label: `${d.name.split(' ')[0].toLowerCase()}@okaxis`, kind: 'upi' };
  const p = { id: uid(s, 'P'), driverId, amount, fee: check.fee, speed, to: acct.label, toKind: acct.kind, status: 'requested', at: st.now, steps: { requested: st.now } };
  st.payouts.unshift(p); d.wallet -= amount + check.fee;
  entry(s, 'payout', p.id, -(amount + check.fee), d.id, `Withdrawal to ${p.to}${check.fee ? ` (fee ${inr(check.fee)})` : ''}`);
  if (!check.needsApproval) approve(s, p, 'auto');
  else { notify(s, 'ops', 'ops', 'Payout to approve', `${d.name} asked for ${inr(amount)} to ${p.to}.`, 'warn', 'payout'); notify(s, 'driver', driverId, 'Withdrawal requested', `${inr(amount)} is waiting for approval. Usually within 15 minutes.`, 'info', 'payout'); }
  s.dispatch('payout', p);
  return { id: p.id };
}

function approve(s, p, how) {
  const now = s.get().now;
  p.status = 'processing'; p.how = how; p.steps.approved = now; p.steps.sent = now;
  notify(s, 'driver', p.driverId, how === 'auto' ? 'Withdrawal on its way' : 'Withdrawal approved', `${inr(p.amount)} to ${p.to}. ${PAYOUT_SPEEDS[p.speed].sub}.`, 'good', 'payout');
}

export function approvePayouts(s, ids) {
  const list = s.get().payouts.filter(p => p.status === 'requested' && (ids === 'all' || ids.includes(p.id)));
  list.forEach(p => approve(s, p, 'approved'));
  s.dispatch('payout', list);
  return list.length;
}

export function rejectPayout(s, id, why = 'Bank details need checking') {
  const st = s.get(); const p = st.payouts.find(x => x.id === id); if (!p || p.status !== 'requested') return;
  const d = st.drivers.find(x => x.id === p.driverId);
  p.status = 'rejected'; p.why = why; p.steps.rejected = st.now; d.wallet += p.amount + (p.fee || 0);
  entry(s, 'refund', p.id, p.amount + (p.fee || 0), d.id, 'Withdrawal returned to wallet');
  notify(s, 'driver', d.id, 'Withdrawal returned', `${inr(p.amount)} is back in your wallet. ${why}.`, 'warn', 'payout');
  s.dispatch('payout', p);
}

// Called every tick: processing payouts land after their speed's delay.
export function tickPayouts(s) {
  const st = s.get();
  for (const p of st.payouts) {
    if (p.status !== 'processing' || st.now - p.steps.sent < PAYOUT_SPEEDS[p.speed || 'instant'].ms) continue;
    p.status = 'paid'; p.paidAt = st.now; p.steps.paid = st.now;
    p.utr = `UTR ${String(Math.abs(hash(p.id)) % 1e12).padStart(12, '0')}`;
    notify(s, 'driver', p.driverId, 'Money credited', `${inr(p.amount)} credited to ${p.to}. ${p.utr}.`, 'good', 'payout');
    s.dispatch('payout', p);
  }
}
const hash = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) * 2654435761;

export function addAccount(s, driverId, acct) {
  const d = s.get().drivers.find(x => x.id === driverId);
  d.accounts ||= [];
  const a = { id: uid(s, 'BA'), primary: !d.accounts.length, ...acct };
  d.accounts.push(a); s.dispatch('driver', d); return a.id;
}
export function setPrimary(s, driverId, accountId) {
  const d = s.get().drivers.find(x => x.id === driverId);
  d.accounts.forEach(a => { a.primary = a.id === accountId; }); s.dispatch('driver', d);
}
