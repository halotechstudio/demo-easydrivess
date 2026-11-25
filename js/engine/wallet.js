import { uid, notify, inr } from './store.js';

const AUTO_PAYOUT_LIMIT = 2000;

function entry(s, kind, ref, amount, wallet, note) {
  const e = { id: uid(s, 'L'), at: s.get().now, kind, ref, amount, wallet, note };
  s.get().ledger.unshift(e); s.dispatch('ledger', e); return e;
}

export function topUp(s, walletId, amount, method = 'UPI') {
  const w = s.get().wallets[walletId]; w.balance += amount;
  entry(s, 'topup', walletId, amount, walletId, `Top-up by ${method}`);
  notify(s, 'manager', walletId, 'Wallet topped up', `${inr(amount)} added. Balance ${inr(w.balance)}.`, 'good');
  return w.balance;
}

// Prepaid wallets block what they cannot cover. Postpaid (hotel) accrue a monthly bill.
export function charge(s, walletId, amount, ref) {
  if (walletId === 'self') { entry(s, 'fare', ref, amount, 'ops', 'Rider paid by UPI'); return 'ok'; }
  const w = s.get().wallets[walletId];
  if (!w) return 'no-wallet';
  if (!w.postpaid && w.balance < amount) return 'insufficient';
  w.balance += w.postpaid ? amount : -amount;
  entry(s, 'fare', ref, amount, walletId, w.postpaid ? 'Added to monthly bill' : 'Paid from wallet');
  if (!w.postpaid && w.low && w.balance < w.low) notify(s, 'manager', walletId, 'Wallet running low', `Balance ${inr(w.balance)}. Add money to keep rides booking.`, 'warn');
  return 'ok';
}

export function refund(s, walletId, amount, ref) {
  const w = s.get().wallets[walletId]; if (!w) return;
  w.balance += w.postpaid ? -amount : amount;
  entry(s, 'refund', ref, -amount, walletId, 'Cancelled before pickup');
}

export function driverCredit(s, d, ride) {
  const earn = Math.round(ride.fare * (1 - s.get().pricing.commission));
  d.wallet += earn; d.today += earn;
  entry(s, 'driver', ride.id, -earn, d.id, `Driver share to ${d.name}`);
  return earn;
}

export function requestPayout(s, driverId, amount) {
  const st = s.get(); const d = st.drivers.find(x => x.id === driverId);
  amount = Math.min(amount, d.wallet);
  const p = { id: uid(s, 'P'), driverId, amount, to: `${d.name.split(' ')[0].toLowerCase()}@okaxis`, status: 'requested', at: st.now };
  st.payouts.unshift(p); d.wallet -= amount;
  if (amount <= AUTO_PAYOUT_LIMIT) pay(s, p, 'auto');
  else notify(s, 'ops', 'ops', 'Payout to approve', `${d.name} asked for ${inr(amount)}.`, 'warn');
  s.dispatch('payout', p);
  return p.id;
}

function pay(s, p, how) {
  p.status = 'paid'; p.paidAt = s.get().now; p.how = how;
  entry(s, 'payout', p.id, -p.amount, p.driverId, `Payout ${how === 'auto' ? '(auto)' : ''} to ${p.to}`);
  notify(s, 'driver', p.driverId, 'Money sent', `${inr(p.amount)} sent to ${p.to}.`, 'good');
}

export function approvePayouts(s, ids) {
  const list = s.get().payouts.filter(p => p.status === 'requested' && (ids === 'all' || ids.includes(p.id)));
  list.forEach(p => pay(s, p, 'approved'));
  s.dispatch('payout', list);
  return list.length;
}
