import { uid, notify } from './store.js';

export function raiseAlert(s, rideId, type = 'sos', by = 'rider') {
  const st = s.get(); const r = st.rides.find(x => x.id === rideId);
  const rider = st.riders.find(x => x.id === (r?.riderId));
  const a = { id: uid(s, 'S'), rideId, type, by, status: 'open', at: st.now, ack: null, timeline: [] };
  const t = text => a.timeline.push({ at: st.now, text });
  if (type === 'sos') {
    t(`${rider?.name || 'Rider'} pressed SOS on ${rideId}`);
    t(`Live location sent to ${rider?.contact?.name || 'trusted contact'} by SMS`);
    t('Safety desk alerted with car and driver details');
    if (r?.payer && st.companies.some(c => c.id === r.payer)) { t('Manager alerted'); notify(s, 'manager', r.payer, 'SOS on a team ride', `${rider?.name} pressed SOS.`, 'alert'); }
    if (r?.driverId) notify(s, 'driver', r.driverId, 'Rider pressed SOS', 'Stop safely. The safety desk will call you.', 'alert');
  } else t(type === 'deviation' ? `Car left the planned route on ${rideId}` : `Long stop on ${rideId}`);
  st.alerts.unshift(a);
  notify(s, 'ops', 'ops', type === 'sos' ? 'SOS open' : 'Route alert', a.timeline[0].text, 'alert');
  s.dispatch('alert', a);
  return a.id;
}

export function ackAlert(s, id, who = 'Safety desk') {
  const a = s.get().alerts.find(x => x.id === id); if (!a || a.ack) return;
  a.ack = who; a.timeline.push({ at: s.get().now, text: `${who} acknowledged and is calling` });
  const r = s.get().rides.find(x => x.id === a.rideId);
  if (r) notify(s, 'rider', r.riderId, 'Help is on the way', `${who} is calling you now.`, 'alert');
  s.dispatch('alert', a);
}
export function closeAlert(s, id) {
  const a = s.get().alerts.find(x => x.id === id); if (!a) return;
  a.status = 'closed'; a.timeline.push({ at: s.get().now, text: 'Rider marked safe, alert closed' });
  s.dispatch('alert', a);
}
