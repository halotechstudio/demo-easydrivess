// Stylised Hyderabad in a 1000×700 map space. North is up.
export const UNIT_KM = 0.06;   // map unit to straight-line km
export const ROAD = 1.25;      // road distance over straight line

const P = (id, name, x, y, kind = 'area') => ({ id, name, x, y, kind });
const list = [
  P('rgia', 'RGIA Airport', 560, 660, 'airport'),
  P('hitec', 'HITEC City', 360, 280), P('madhapur', 'Madhapur', 405, 268), P('kondapur', 'Kondapur', 330, 228),
  P('gachibowli', 'Gachibowli', 300, 330), P('jubilee', 'Jubilee Hills', 465, 318), P('banjara', 'Banjara Hills', 520, 352),
  P('begumpet', 'Begumpet', 585, 262), P('ameerpet', 'Ameerpet', 548, 296), P('secunderabad', 'Secunderabad', 680, 222),
  P('kukatpally', 'Kukatpally', 425, 172), P('miyapur', 'Miyapur', 335, 120), P('lbnagar', 'LB Nagar', 735, 470),
  P('uppal', 'Uppal', 810, 285), P('manikonda', 'Manikonda', 340, 410), P('kokapet', 'Kokapet', 225, 372),
  P('gandipet', 'Gandipet', 120, 395), P('attapur', 'Attapur', 470, 452), P('tolichowki', 'Tolichowki', 440, 385),
  P('nanakramguda', 'Nanakramguda', 262, 352),
  P('orbit', 'Orbit Infotech · HITEC', 372, 292, 'office'), P('acme', 'Acme · Gachibowli', 296, 342, 'office'),
  P('taj', 'Taj Krishna', 532, 360, 'hotel'), P('novotel', 'Novotel HICC', 345, 252, 'hotel'),
  P('vijayawada', 'Vijayawada', 990, 520, 'city'), P('warangal', 'Warangal', 990, 120, 'city'),
];
export const places = Object.fromEntries(list.map(p => [p.id, p]));
export const placeList = list;
const intercityKm = { vijayawada: 275, warangal: 145 };

// Arterial roads for the map drawing (polylines of place ids / points).
export const roads = [
  ['gandipet', 'kokapet', 'nanakramguda', 'gachibowli', 'hitec', 'madhapur', 'jubilee', 'banjara', 'ameerpet', 'begumpet', 'secunderabad', 'uppal'],
  ['miyapur', 'kondapur', 'hitec', 'gachibowli', 'manikonda', 'tolichowki', 'attapur', 'rgia'],
  ['kukatpally', 'madhapur', 'jubilee', 'tolichowki'],
  ['kukatpally', 'ameerpet', 'banjara', 'attapur', 'lbnagar'],
  ['secunderabad', 'begumpet', 'ameerpet'],
  ['uppal', 'lbnagar', 'rgia'],
  ['nanakramguda', 'rgia'],
].map(r => r.map(id => places[id]));

const pt = p => (typeof p === 'string' ? places[p] : p);

export function distanceKm(a, b) {
  a = pt(a); b = pt(b);
  if (intercityKm[a.id] || intercityKm[b.id]) return intercityKm[a.id] || intercityKm[b.id];
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * UNIT_KM * ROAD * 10) / 10;
}

export function bearing(a, b) {
  a = pt(a); b = pt(b);
  return (Math.atan2(b.x - a.x, a.y - b.y) * 180 / Math.PI + 360) % 360;
}
export const angleDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export function minutesFor(km) {
  if (km > 60) return Math.round(km / 62 * 60);
  if (km > 18) return Math.round(km / 40 * 60);
  return Math.round(km / 26 * 60 + 4);
}

// Route between two places: a gently bent polyline for drawing, plus km/min.
export function route(a, b) {
  a = pt(a); b = pt(b);
  const km = distanceKm(a, b);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const nx = -(b.y - a.y), ny = b.x - a.x, len = Math.hypot(nx, ny) || 1;
  const bend = Math.min(40, len * 0.08);
  const mid = { x: mx + nx / len * bend, y: my + ny / len * bend };
  const points = [{ x: a.x, y: a.y }, { x: (a.x + mid.x) / 2, y: (a.y + mid.y) / 2 + 3 }, mid, { x: (mid.x + b.x) / 2, y: (mid.y + b.y) / 2 - 3 }, { x: b.x, y: b.y }];
  return { points, km, min: minutesFor(km) };
}

// Route through a sequence of place ids.
export function pathOf(ids) {
  let points = [], km = 0, min = 0; const legs = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const r = route(ids[i], ids[i + 1]);
    legs.push(r); km += r.km; min += r.min; points = points.concat(i ? r.points.slice(1) : r.points);
  }
  return { points, km: Math.round(km * 10) / 10, min, legs };
}

export function along(points, t) {
  if (!points?.length) return { x: 0, y: 0 };
  t = Math.max(0, Math.min(1, t));
  let total = 0; const seg = [];
  for (let i = 0; i < points.length - 1; i++) { const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y); seg.push(d); total += d; }
  let target = total * t;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) { const f = seg[i] ? target / seg[i] : 0; return { x: points[i].x + (points[i + 1].x - points[i].x) * f, y: points[i].y + (points[i + 1].y - points[i].y) * f }; }
    target -= seg[i];
  }
  return { ...points[points.length - 1] };
}
