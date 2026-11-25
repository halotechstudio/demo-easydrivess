import { defaultPricing, DAY } from './pricing.js';
import { places } from './geo.js';
import { materialiseTemplates, bookRide } from './rides.js';

const H = 3600e3;

// Demo data only. Names and numbers are illustrative.
export function seed(s) {
  const st = s.get();
  const now = st.now;
  st.pricing = defaultPricing();

  const cars = [
    ['c01', 'TS 09 EK 4471', 'Maruti Dzire', 'Sedan', 2024, 'Pearl White', 96, 94, 95, 93],
    ['c02', 'TS 07 GH 2190', 'Honda City', 'Sedan', 2023, 'Lunar Silver', 92, 91, 93, 91],
    ['c03', 'TS 08 FA 7702', 'Hyundai Aura', 'Sedan', 2021, 'Typhoon Grey', 88, 86, 88, 86],
    ['c04', 'TS 09 BC 1184', 'Maruti Swift', 'Hatchback', 2022, 'Solid Fire Red', 90, 90, 90, 88],
    ['c05', 'TS 10 JD 5520', 'Hyundai i20', 'Hatchback', 2019, 'Polar White', 71, 78, 74, 76],
    ['c06', 'TS 07 HK 9031', 'Toyota Innova Crysta', 'SUV', 2023, 'Silver Metallic', 94, 93, 95, 94],
    ['c07', 'TS 09 LM 3302', 'Kia Carens', 'SUV', 2022, 'Imperial Blue', 89, 88, 90, 89],
    ['c08', 'TS 08 MN 6645', 'Mahindra XUV700', 'SUV', 2024, 'Midnight Black', 95, 92, 96, 95],
    ['c09', 'TS 09 PL 0007', 'Mercedes-Benz E-Class', 'Luxury', 2025, 'Obsidian Black', 98, 97, 98, 97],
    ['c10', 'TS 07 QA 1100', 'BMW 5 Series', 'Luxury', 2024, 'Carbon Black', 97, 95, 97, 96],
    ['c11', 'TS 10 RS 8812', 'Honda Amaze', 'Sedan', 2018, 'Radiant Red', 66, 74, 72, 74],
    ['c12', 'TS 08 TT 4408', 'Toyota Etios', 'Sedan', 2020, 'White Pearl', 84, 85, 84, 83],
    ['c13', 'TS 09 UV 2290', 'Maruti Ertiga', 'SUV', 2021, 'Pearl Arctic White', 87, 86, 86, 85],
    ['c14', 'TS 07 WX 6650', 'Tata Altroz', 'Hatchback', 2024, 'Opera Blue', 95, 92, 94, 92],
  ];
  st.cars = cars.map(([id, plate, model, cls, year, color, shine, feedback, fitness, onboard], i) => ({
    id, plate, model, cls, year, color, feedback, fitness, onboard, status: 'live',
    shine: { score: shine, at: i === 4 ? now - 2 * DAY : now - (1 + (i % 4)) * H, attire: i !== 4, photos: 4 },
    odometer: 18000 + i * 7350, serviceDue: i === 10 ? 'Overdue' : 'In 2,400 km',
    docs: { rc: 'valid', insurance: i === 10 ? 'expires in 9 days' : 'valid', permit: 'valid', puc: 'valid', fitness: 'valid' },
  }));

  const drivers = [
    ['d01', 'Ravi Kumar', 'c01', 'jubilee', 4.9, 1284], ['d02', 'Salma Begum', 'c02', 'madhapur', 4.8, 960],
    ['d03', 'Srinivas Rao', 'c03', 'ameerpet', 4.7, 2210], ['d04', 'Imran Pasha', 'c04', 'kondapur', 4.8, 1630],
    ['d05', 'Venkat Reddy', 'c05', 'tolichowki', 4.5, 820], ['d06', 'Mahesh Goud', 'c06', 'gachibowli', 4.9, 3105],
    ['d07', 'Anil Yadav', 'c07', 'begumpet', 4.7, 1402], ['d08', 'Prakash Naidu', 'c08', 'hitec', 4.8, 744],
    ['d09', 'Arjun Malhotra', 'c09', 'banjara', 5.0, 512], ['d10', 'Farhan Ali', 'c10', 'jubilee', 4.9, 688],
    ['d11', 'Raju Chary', 'c11', 'attapur', 4.4, 2950], ['d12', 'Lakshmi Devi', 'c12', 'secunderabad', 4.8, 1190],
    ['d13', 'Naveen Kumar', 'c13', 'kukatpally', 4.6, 1544], ['d14', 'Kiran Varma', 'c14', 'nanakramguda', 4.9, 402],
  ];
  st.drivers = drivers.map(([id, name, carId, at, rating, trips], i) => ({
    id, name, carId, rating, trips, online: i !== 13, busy: false, auto: true,
    acceptance: 82 + (i * 7) % 17, restHours: 6 + (i % 4), pos: { x: places[at].x + (i % 3) * 6, y: places[at].y - (i % 2) * 6 },
    wallet: 400 + i * 135, today: 0, todayTrips: 0, phone: `+91 98480 ${String(31000 + i * 77).slice(0, 5)}`,
    languages: i % 2 ? 'Telugu, Hindi' : 'Telugu, Hindi, English', verified: true,
    docs: { licence: 'verified', aadhaar: 'verified', police: 'verified', bank: 'verified' },
  }));
  // A new applicant waiting for onboarding in the ops console.
  st.applicants = [{ id: 'd15', name: 'Sai Teja', phone: '+91 98481 22045', car: { plate: 'TS 09 ZZ 1717', model: 'Hyundai Verna', cls: 'Sedan', year: 2025, color: 'Starry Night' }, docs: { licence: 'verified', aadhaar: 'verified', police: 'pending', bank: 'verified' } }];

  st.companies = [
    { id: 'orbit', name: 'Orbit Infotech', office: 'orbit', manager: 'Neha Sharma', gstin: '36AAECO1234F1Z5', team: 'Engineering' },
    { id: 'acme', name: 'Acme Analytics', office: 'acme', manager: 'Rahul Verma', gstin: '36AABCA9876K1Z2', team: 'Operations' },
  ];
  const staff = [
    // First seven: the morning team used in the demo.
    ['e01', 'Priya Nair', 'f', 'miyapur', 'orbit', 'Design'], ['e02', 'Karthik Iyer', 'm', 'kondapur', 'orbit', 'Engineering'],
    ['e03', 'Sneha Kulkarni', 'f', 'ameerpet', 'orbit', 'Finance'], ['e04', 'Rohan Mehta', 'm', 'banjara', 'orbit', 'Engineering'],
    ['e05', 'Divya Rao', 'f', 'jubilee', 'orbit', 'Product'], ['e06', 'Aditya Sen', 'm', 'gachibowli', 'orbit', 'Engineering'],
    ['e07', 'Meera Pillai', 'f', 'manikonda', 'orbit', 'HR'], ['e08', 'Vikram Shetty', 'm', 'kukatpally', 'orbit', 'Sales'],
    ['e09', 'Fatima Sheikh', 'f', 'madhapur', 'orbit', 'Engineering'],
    ['e10', 'Arun Prasad', 'm', 'secunderabad', 'acme', 'Operations'], ['e11', 'Kavya Menon', 'f', 'begumpet', 'acme', 'Analytics'],
    ['e12', 'Suresh Babu', 'm', 'lbnagar', 'acme', 'Operations'], ['e13', 'Nisha Gupta', 'f', 'attapur', 'acme', 'Analytics'],
    ['e14', 'Harsha Vardhan', 'm', 'kokapet', 'acme', 'Analytics'], ['e15', 'Zoya Khan', 'f', 'tolichowki', 'acme', 'Operations'],
  ];
  const publics = [
    ['r1', 'Ananya Reddy', 'f', 'jubilee', null, null], ['r2', 'Sameer Khan', 'm', 'banjara', null, null],
    ['r3', 'Deepak Jain', 'm', 'secunderabad', null, null], ['r4', 'Lavanya Rao', 'f', 'kondapur', null, null],
    ['r5', 'Tarun Bhatia', 'm', 'gachibowli', null, null],
  ];
  st.riders = [...staff, ...publics].map(([id, name, gender, home, company, team], i) => ({
    id, name, gender, home, company, team, phone: `+91 98801 ${String(10011 + i * 13)}`,
    saved: company ? [{ label: 'Home', place: home }, { label: 'Office', place: company }] : [{ label: 'Home', place: home }, { label: 'Work', place: 'hitec' }, { label: 'Airport', place: 'rgia' }],
    contact: { name: 'Amma', phone: '+91 98450 •••• 24' }, rating: 4.8,
  }));
  // Ananya works at Orbit too: Personal and Work profiles in one app.
  st.riders.find(r => r.id === 'r1').workCompany = 'orbit';
  for (const r of st.riders) {
    r.email = `${r.name.split(' ')[0].toLowerCase()}.${r.name.split(' ').slice(-1)[0].toLowerCase()}@${r.company ? r.company + '.in' : 'gmail.com'}`;
    r.contacts = [{ id: 'c1', name: r.contact.name, phone: r.contact.phone, auto: true }];
    r.payMethod = r.company ? 'company' : 'wallet';
    r.upi = [`${r.name.split(' ')[0].toLowerCase()}@okhdfc`];
    r.cards = r.id === 'r1' ? [{ id: 'k1', brand: 'Visa', last4: '4021', exp: '08/29' }] : [];
    r.prefs = { ac: true, quiet: false, music: 'Driver\'s choice', cls: 'Sedan', womenDriver: false, pet: false, luggage: false, nightShare: true, language: 'English',
      notify: { rides: true, wallet: true, promos: true, whatsapp: true, email: true } };
    r.since = 'March 2025'; r.trips = 40 + r.id.charCodeAt(1) * 3;
    // Past trip history used for the Frequent trips list.
    r.freq = r.company ? [{ pickup: r.home, drop: r.company, count: 34, cls: 'Sedan' }, { pickup: r.company, drop: r.home, count: 31, cls: 'Sedan' }, { pickup: r.home, drop: 'rgia', count: 4, cls: 'Sedan' }, { pickup: r.home, drop: 'banjara', count: 3, cls: 'Sedan' }, { pickup: r.home, drop: 'gachibowli', count: 2, cls: 'Sedan' }]
      : [{ pickup: r.home, drop: 'hitec', count: 22, cls: 'Sedan' }, { pickup: 'hitec', drop: r.home, count: 19, cls: 'Sedan' }, { pickup: r.home, drop: 'rgia', count: 6, cls: 'Sedan' }, { pickup: r.home, drop: 'banjara', count: 5, cls: 'Hatchback' }, { pickup: r.home, drop: 'gachibowli', count: 4, cls: 'Sedan' }];
  }

  st.hotels = [
    { id: 'taj', name: 'Taj Krishna', place: 'taj', desk: 'Front desk · Banjara Hills', guests: [
      { id: 'g1', name: 'Mr. Daniel Brooks', room: '412', flight: '6E 5321', from: 'Bengaluru', land: now + 2.2 * H, delay: 0 },
      { id: 'g2', name: 'Ms. Aiko Tanaka', room: '1108', flight: 'EK 528', from: 'Dubai', land: now + 5.5 * H, delay: 0 },
      { id: 'g3', name: 'Mr. & Mrs. Kapoor', room: '806', flight: 'AI 2589', from: 'Delhi', land: now + 1.1 * H, delay: 0 },
      { id: 'g4', name: 'Dr. Meenakshi Iyer', room: '215', flight: null, from: null, land: null, delay: 0, checkout: now + 3 * H },
    ] },
    { id: 'novotel', name: 'Novotel HICC', place: 'novotel', desk: 'Concierge · HITEC City', guests: [] },
  ];

  st.wallets = {
    orbit: { id: 'orbit', label: 'Orbit Infotech', balance: 48500, low: 5000 },
    acme: { id: 'acme', label: 'Acme Analytics', balance: 3200, low: 5000 },
    taj: { id: 'taj', label: 'Taj Krishna (monthly bill)', balance: 0, postpaid: true },
    ops: { id: 'ops', label: 'Easydrivess', balance: 0 },
  };
  st.wallets.orbit.auto = { on: false, below: 5000, amount: 25000, method: 'Net banking' };
  st.wallets.acme.auto = { on: false, below: 5000, amount: 10000, method: 'UPI' };
  st.wallets.orbit.va = { bank: 'ICICI Bank', account: 'EASYD0RBIT0001', ifsc: 'ICIC0000104' };
  st.budgets = { orbit: [{ team: 'Engineering', limit: 30000, spent: 18420 }, { team: 'Design', limit: 8000, spent: 2310 }, { team: 'Finance', limit: 6000, spent: 4870 }, { team: 'Sales', limit: 12000, spent: 3150 }, { team: 'HR', limit: 5000, spent: 960 }, { team: 'Product', limit: 7000, spent: 2240 }] };
  st.policies = { orbit: { classes: ['Hatchback', 'Sedan', 'SUV'], maxFare: 1500, approvalAbove: 1000, nightRule: true, shareByDefault: true, weekendRides: false } };
  // Easydrivess Money: a personal wallet for each public rider.
  for (const [id, bal] of [['r1', 1250], ['r2', 420], ['r3', 0], ['r4', 860], ['r5', 150]]) {
    st.wallets[id] = { id, label: 'Easydrivess Money', balance: bal, personal: true, low: 200, auto: { on: false, below: 200, amount: 500, method: 'UPI' } };
  }
  st.ledger = [
    { id: 'L-r1-1', at: now - 26 * H, kind: 'topup', ref: 'r1', amount: 1000, wallet: 'r1', note: 'Added by UPI' },
    { id: 'L-r1-2', at: now - 25 * H, kind: 'fare', ref: 'R0870', amount: 236, wallet: 'r1', note: 'Ride · HITEC City to Jubilee Hills' },
    { id: 'L-r1-3', at: now - 50 * H, kind: 'refund', ref: 'R0841', amount: 186, wallet: 'r1', note: 'Ride cancelled before pickup' },
    { id: 'L-r1-4', at: now - 74 * H, kind: 'cashback', ref: 'A1', amount: 50, wallet: 'r1', note: 'Kaveri Bank card offer' },
    { id: 'L-o-1', at: now - 20 * H, kind: 'topup', ref: 'orbit', amount: 25000, wallet: 'orbit', note: 'Added by Net banking' },
    { id: 'L-o-2', at: now - 15 * H, kind: 'fare', ref: 'B0711', amount: 1840, wallet: 'orbit', note: 'Evening drop · 6 cars' },
  ];
  for (const d of st.drivers) {
    const first = d.name.split(' ')[0].toLowerCase();
    d.accounts = [
      { id: `${d.id}-u`, kind: 'upi', label: `${first}@okaxis`, primary: true, verified: true },
      { id: `${d.id}-b`, kind: 'bank', label: `${['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak'][d.id.charCodeAt(2) % 5]} Bank ••${String(4100 + d.id.charCodeAt(2) * 7).slice(-4)}`, ifsc: 'HDFC0001234', holder: d.name, primary: false, verified: true },
    ];
    d.prefs = { airport: true, intercity: d.id !== 'd05', maxPickupKm: 6, women: false, autopilot: true, notifications: { rides: true, payouts: true, promos: false } };
  }
  st.payouts = [
    { id: 'P0001', driverId: 'd03', amount: 2650, fee: 0, speed: 'standard', to: 'srinivas@okaxis', toKind: 'upi', status: 'requested', at: now - 0.6 * H, steps: { requested: now - 0.6 * H } },
    { id: 'P0002', driverId: 'd11', amount: 1980, fee: 5, speed: 'instant', to: 'HDFC Bank ••4577', toKind: 'bank', status: 'paid', at: now - 14 * H, how: 'auto', utr: 'UTR 418829310057', steps: { requested: now - 14 * H, approved: now - 14 * H, sent: now - 14 * H, paid: now - 13.97 * H } },
    { id: 'P0003', driverId: 'd01', amount: 1500, fee: 5, speed: 'instant', to: 'ravi@okaxis', toKind: 'upi', status: 'paid', at: now - 22 * H, how: 'auto', utr: 'UTR 418822014731', steps: { requested: now - 22 * H, approved: now - 22 * H, sent: now - 22 * H, paid: now - 21.97 * H } },
  ];

  st.ads = [
    { id: 'A1', advertiser: 'Kaveri Bank', title: 'Travel card, 3% back on every ride', sub: 'Zero joining fee this month', cta: 'Apply', tone: 'majorelle', photo: 'https://images.unsplash.com/photo-1609429019995-8c40f49535a5?auto=format&fit=crop&w=720&h=300&q=70', slots: ['rider-home', 'rider-complete', 'manager-home'], on: true, impressions: 4210, clicks: 96, cpm: 300 },
    { id: 'A2', advertiser: 'Paradise Biryani', title: 'Biryani at your door in 30 minutes', sub: 'Order from the trip screen', cta: 'Order', tone: 'ember', photo: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=720&h=300&q=70', slots: ['rider-complete', 'rider-finding', 'rider-trips'], on: true, impressions: 9870, clicks: 412, cpm: 220 },
    { id: 'A3', advertiser: 'ShieldSure', title: 'Cab insurance from ₹19 a day', sub: 'Made for full-time drivers', cta: 'Get cover', tone: 'aqua', photo: 'https://images.unsplash.com/photo-1787571354001-b2c975845e09?auto=format&fit=crop&w=720&h=300&q=70', slots: ['driver-home', 'driver-earnings'], on: true, impressions: 3120, clicks: 140, cpm: 90 },
    { id: 'A4', advertiser: 'Inorbit Mall', title: 'Weekend sale, up to 50% off', sub: 'Ride there with Easydrivess', cta: 'See offers', tone: 'lavender', photo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=720&h=300&q=70', slots: ['rider-home', 'rider-finding'], on: true, impressions: 2650, clicks: 71, cpm: 180 },
  ];

  st.templates = [
    { id: 'T1', riderId: 'r1', pickup: 'hitec', drop: 'jubilee', cls: 'Sedan', days: [1, 2, 3, 4, 5], time: '18:30', payer: 'self', label: 'Evening home' },
  ];

  // History: a few completed trips today for the console.
  const hist = [
    ['r2', 'banjara', 'rgia', 'Sedan', 'airport', 'app', 'd02', 812, 3.1],
    ['r3', 'secunderabad', 'hitec', 'Sedan', 'city', 'whatsapp', 'd12', 398, 2.4],
    ['e10', 'secunderabad', 'acme', 'SUV', 'city', 'corporate', 'd07', 640, 2.0],
    ['g9', 'rgia', 'taj', 'Luxury', 'airport', 'hotel', 'd09', 2140, 1.6],
    ['r5', 'gachibowli', 'kondapur', 'Hatchback', 'city', 'app', 'd04', 186, 1.2],
  ];
  st.rides = hist.map(([riderId, pickup, drop, cls, trip, channel, driverId, fare, hAgo], i) => ({
    id: `R${String(901 + i)}`, riderId, riderIds: [riderId], pickup, drop, cls, trip, channel, status: 'completed', driverId,
    carId: st.drivers.find(d => d.id === driverId).carId, fare, createdAt: now - hAgo * H, completedAt: now - (hAgo - 0.7) * H, km: 0, min: 0, points: [], stops: [], payer: channel === 'corporate' ? 'acme' : channel === 'hotel' ? 'taj' : 'self', history: true,
  }));
  for (const r of st.rides) {
    st.ledger.push({ id: `L${r.id}`, at: r.createdAt, kind: 'fare', ref: r.id, amount: r.fare, wallet: 'ops', note: `${r.channel} ride` });
    const d = st.drivers.find(x => x.id === r.driverId); d.today += Math.round(r.fare * (1 - st.pricing.commission)); d.todayTrips++;
  }
  st.stats = { carsSavedToday: 6, savedToday: 2840, waBookingsToday: 1 };
  materialiseTemplates(s);
  seedUpcoming(s, now);
  st.notifications = st.notifications.filter(n => n.app !== 'ops');
  return s;
}

// Upcoming bookings drivers can claim in advance (Driver → Scheduled).
function seedUpcoming(s, now) {
  const list = [
    ['r2', 'banjara', 'rgia', 'Sedan', 'airport', 3.5], ['r3', 'secunderabad', 'rgia', 'Sedan', 'airport', 6],
    ['r4', 'kondapur', 'vijayawada', 'SUV', 'intercity', 22], ['r5', 'gachibowli', 'rgia', 'Hatchback', 'airport', 24.5],
    ['r2', 'jubilee', 'warangal', 'Sedan', 'intercity', 27], ['r3', 'begumpet', 'hitec', 'Luxury', 'city', 5],
  ];
  for (const [riderId, pickup, drop, cls, trip, hrs] of list) bookRide(s, { riderId, pickup, drop, cls, trip, channel: 'app', at: now + hrs * 3600e3 });
}