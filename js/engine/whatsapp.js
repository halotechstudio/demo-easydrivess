import { places } from './geo.js';
import { inr, fmtTime } from './store.js';
import { CLASSES } from './pricing.js';
import { bookRide, estimate, carOf } from './rides.js';
import { conditionScore } from './pricing.js';

// Chat booking without the app. Four taps after "hi": trip type → location → drop → class.
const SUGGEST = { City: ['hitec', 'banjara', 'secunderabad', 'gachibowli'], Intercity: ['vijayawada', 'warangal'] };
const PIN_CHOICES = ['jubilee', 'kondapur', 'begumpet', 'gachibowli'];

function chatOf(s, id) {
  const st = s.get();
  return (st.whatsapp[id] ||= { id, name: 'Rahul Varma', phone: '+91 99890 41207', stage: 'start', data: {}, messages: [] });
}
const bot = (c, m) => { const msg = { from: 'bot', at: Date.now(), ...m }; c.messages.push(msg); return msg; };

export function waHandle(s, chatId, input) {
  const st = s.get(); const c = chatOf(s, chatId); const out = [];
  const say = m => out.push(bot(c, m));
  const label = input.startsWith('loc:') ? `📍 Location · ${places[input.slice(4)].name}` : input.startsWith('drop:') ? places[input.slice(5)].name : input.startsWith('cls:') ? input.slice(4) : input;
  c.messages.push({ from: 'user', text: label.replace('📍 ', ''), kind: input.startsWith('loc:') ? 'location' : 'text', place: input.startsWith('loc:') ? input.slice(4) : null });

  if (/^(hi|hello|hey|book)/i.test(input) || c.stage === 'start' || c.stage === 'confirmed' && /^(hi|book)/i.test(input)) {
    c.stage = 'type'; c.data = {};
    say({ kind: 'text', text: `Hello ${c.name.split(' ')[0]}. Where are you going today?` });
    say({ kind: 'buttons', buttons: ['Airport', 'City', 'Intercity'] });
  } else if (c.stage === 'type' && ['Airport', 'City', 'Intercity'].includes(input)) {
    c.data.type = input; c.stage = 'pickup';
    say({ kind: 'text', text: 'Share your pickup location.' });
    say({ kind: 'buttons', buttons: PIN_CHOICES.map(p => `loc:${p}`), pin: true });
  } else if (c.stage === 'pickup' && input.startsWith('loc:')) {
    c.data.pickup = input.slice(4);
    if (c.data.type === 'Airport') { c.data.drop = 'rgia'; c.stage = 'cls'; classCards(s, c, say); }
    else {
      c.stage = 'drop';
      say({ kind: 'text', text: 'Where to? Pick one or type a place.' });
      say({ kind: 'buttons', buttons: SUGGEST[c.data.type].map(p => `drop:${p}`) });
    }
  } else if (c.stage === 'drop' && input.startsWith('drop:')) {
    c.data.drop = input.slice(5); c.stage = 'cls'; classCards(s, c, say);
  } else if (c.stage === 'cls' && input.startsWith('cls:')) {
    const cls = input.slice(4); const trip = c.data.type.toLowerCase();
    const riderId = `wa-${chatId}`;
    if (!st.riders.some(r => r.id === riderId)) st.riders.push({ id: riderId, name: c.name, phone: c.phone, gender: 'm', saved: [], contact: { name: 'Family', phone: '' }, whatsapp: true });
    const rideId = bookRide(s, { riderId, pickup: c.data.pickup, drop: c.data.drop, cls, trip: trip === 'city' ? 'city' : trip, channel: 'whatsapp', payer: 'self', chatId });
    const ride = st.rides.find(r => r.id === rideId);
    c.data.rideId = rideId; c.stage = 'confirmed'; st.stats.waBookingsToday++;
    say({ kind: 'text', text: `Booked. ${cls} from ${places[c.data.pickup].name} to ${places[c.data.drop].name}, ${inr(ride.fare)}. Finding your driver now.` });
    say({ kind: 'upi', amount: ride.fare, text: 'Pay now by UPI, or pay the driver at the end.' });
    s.dispatch('whatsapp', c);
  } else {
    say({ kind: 'text', text: 'Sorry, I did not get that. Tap one of the options, or say "hi" to start again.' });
  }
  s.dispatch('whatsapp', c);
  return out;
}

function classCards(s, c, say) {
  const trip = c.data.type.toLowerCase();
  const cards = CLASSES.map(cls => { const e = estimate(s, { pickup: c.data.pickup, drop: c.data.drop, cls, trip }); return { cls, fare: e.fare, min: e.min, score: e.score }; });
  say({ kind: 'text', text: `${places[c.data.pickup].name} to ${places[c.data.drop].name}. Choose your car.` });
  say({ kind: 'classes', cards });
}

// Ride updates pushed back into the chat.
export function waOnUpdate(s, ride, what) {
  if (!ride.chatId) return;
  const c = s.get().whatsapp[ride.chatId]; if (!c) return;
  if (what === 'assigned') {
    const d = s.get().drivers.find(x => x.id === ride.driverId); const car = carOf(s, d.id);
    const cs = conditionScore(car, s.get().now);
    bot(c, { kind: 'driver', name: d.name, rating: d.rating, car: `${car.model} · ${car.color}`, plate: car.plate, score: cs.score, sentence: cs.sentence, otp: ride.otp, eta: ride.approach.min });
  } else if (what === 'onboard') bot(c, { kind: 'text', text: 'Trip started. Share live trip with family: easydrivess.in/t/' + ride.id.toLowerCase() });
  else if (what === 'completed') bot(c, { kind: 'text', text: `You've arrived. Fare ${inr(ride.fare)}. Reply 1–5 to rate ${s.get().drivers.find(x => x.id === ride.driverId).name.split(' ')[0]}.` });
  s.dispatch('whatsapp', c);
}
export { fmtTime };
