// Single event store. Engine modules mutate state through helpers, then emit.
export function createStore(initial = {}) {
  const state = {
    now: Date.UTC(2026, 10, 25, 3, 30), // 09:00 IST
    riders: [], drivers: [], cars: [], rides: [], companies: [], hotels: [],
    wallets: {}, ledger: [], payouts: [], ads: [], adViews: {},
    pricing: null, alerts: [], whatsapp: {}, notifications: [], templates: [],
    seq: 1, ...initial,
  };
  const subs = {};
  const on = (type, fn) => { (subs[type] ||= []).push(fn); return () => { subs[type] = subs[type].filter(f => f !== fn); }; };
  const dispatch = (type, payload) => {
    for (const fn of subs[type] || []) fn(payload, state);
    for (const fn of subs['*'] || []) fn(type, payload, state);
  };
  return { get: () => state, on, dispatch };
}

export const uid = (s, prefix) => `${prefix}${String(s.get().seq++).padStart(4, '0')}`;

export function notify(s, app, to, title, body, tone = 'info') {
  const n = { id: uid(s, 'N'), app, to, title, body, tone, at: s.get().now, read: false };
  s.get().notifications.unshift(n);
  s.dispatch('notify', n);
  return n;
}

// IST helpers (UTC+5:30)
export const IST = 5.5 * 3600e3;
export const istHour = ms => new Date(ms + IST).getUTCHours() + new Date(ms + IST).getUTCMinutes() / 60;
export const fmtTime = ms => {
  const d = new Date(ms + IST); let h = d.getUTCHours(); const m = d.getUTCMinutes();
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
};
export const fmtClock = ms => { const d = new Date(ms + IST); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
export const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
