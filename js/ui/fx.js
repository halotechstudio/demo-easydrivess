// LED language: small dot-matrix glyphs that light up to say what a section is for,
// plus status LEDs and a running LED strip for live activity.
import { h } from './kit.js';

const G = {
  route: ['1000000', '1100000', '0110000', '0011100', '0000110', '0000011', '0000001'],
  car: ['0000000', '0111110', '1100011', '1111111', '1111111', '0100010', '0000000'],
  wallet: ['0000000', '1111110', '1000011', '1000111', '1000011', '1111110', '0000000'],
  money: ['0011100', '0100010', '0101000', '0011100', '0001010', '0100010', '0011100'],
  shield: ['0111110', '1100011', '1101011', '1100011', '0110110', '0011100', '0001000'],
  bell: ['0001000', '0011100', '0111110', '0111110', '0111110', '1111111', '0001000'],
  ad: ['0000010', '0000110', '1111110', '1111110', '1111110', '0000110', '0000010'],
  user: ['0011100', '0011100', '0011100', '0000000', '0111110', '1111111', '1111111'],
  users: ['0110110', '0110110', '0000000', '1111111', '1111111', '1111111', '0000000'],
  chart: ['0000001', '0000011', '0000111', '0001111', '0011111', '0111111', '1111111'],
  clock: ['0111110', '1001001', '1001001', '1001111', '1000001', '1000001', '0111110'],
  plane: ['0001000', '0001000', '0111110', '1111111', '0001000', '0011100', '0110110'],
  spark: ['0001000', '0001000', '1101011', '0010100', '1101011', '0001000', '0001000'],
  doc: ['1111100', '1000110', '1011111', '1000001', '1011101', '1000001', '1111111'],
  gear: ['0101010', '1111111', '0110110', '1100011', '0110110', '1111111', '0101010'],
  star: ['0001000', '0011100', '1111111', '0111110', '0011100', '0110110', '1100011'],
};
const COLOR = { route: '#8F8CF2', car: '#5EF2C6', wallet: '#B9AEFF', money: '#5EF2C6', shield: '#FF8A78', bell: '#FFB547', ad: '#FF8A78', user: '#E9E8FB', users: '#E9E8FB', chart: '#8F8CF2', clock: '#8F8CF2', plane: '#8F8CF2', spark: '#B9AEFF', doc: '#E9E8FB', gear: '#A6A6B4', star: '#FFB547' };

export function ledIcon(name, { size = 16, color } = {}) {
  const g = G[name] || G.spark; const c = color || COLOR[name] || '#8F8CF2';
  const dots = [];
  g.forEach((row, y) => row.split('').forEach((b, x) => dots.push(h('circle', { cx: x * 3 + 1.5, cy: y * 3 + 1.5, r: 1.15, class: b === '1' ? 'on' : '', style: b === '1' ? `--d:${(x + y) * 90}ms` : null }))));
  return h('svg', { class: 'led-ic', viewBox: '0 0 21 21', width: size, height: size, style: `--c:${c}` }, dots);
}
export const led = (color = 'var(--aqua)', pulse = false) => h('span', { class: `led${pulse ? ' pulse' : ''}`, style: `--c:${color}` });
export const ledStrip = (n = 14, color) => h('div', { class: 'ledstrip', style: color ? `--c:${color}` : null }, Array.from({ length: n }, (_, i) => h('i', { style: `--d:${i * 110}ms` })));

// Pick a glyph for a section title so every card head carries its own LED.
const RULES = [
  [/notif|inbox|alert/i, 'bell'], [/wallet|balance|money|transaction|invoice|bill|top-up|payment|pay/i, 'wallet'],
  [/payout|earn|withdraw|revenue|commission|fare|rate|pricing/i, 'money'], [/safety|sos|contact|privacy|rule/i, 'shield'],
  [/ad\b|ads|advert|placement/i, 'ad'], [/flight|airport|arrival|departure/i, 'plane'], [/car|fleet|condition|paper|checklist|ride types|document/i, 'car'],
  [/team|people|driver|who|admin/i, 'users'], [/profile|personal|account/i, 'user'], [/route|trip|ride|stop|happening|going|leaving|scheduled|transfer/i, 'route'],
  [/when|time|week|repeat/i, 'clock'], [/channel|lines|activity|chart/i, 'chart'], [/preference|setting|language|policy|budget/i, 'gear'], [/rate|star/i, 'star'],
];
export function decorate(root) {
  root.querySelectorAll('.card-head h3, .panel > h3').forEach(el => {
    if (el.querySelector('.led-ic')) return;
    const text = el.firstChild?.textContent || el.textContent;
    const hit = RULES.find(([re]) => re.test(text));
    el.prepend(ledIcon(hit ? hit[1] : 'spark'));
  });
}
