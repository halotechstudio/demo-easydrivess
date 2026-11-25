// Illustrated banner media for the demo advertisers (drawn SVG, no stock imagery).
// An uploaded image in Ops replaces the art with the advertiser's own creative.
const svg = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice"><defs>${bg}</defs><rect width="360" height="140" fill="url(#bg)"/>${body}</svg>`;
const lin = (a, b, c) => `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
const glow = (x, y, r, col, o = .55) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${o}" filter="url(#b)"/>`;
const blur = '<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>';

const ART = {
  card: svg(lin('#2B1D86', '#5A3FE0', '#8F7BFF') + blur,
    glow(260, 60, 60, '#B9AEFF') +
    `<g transform="translate(205 30) rotate(-14)"><rect width="128" height="80" rx="12" fill="#1B1450" stroke="rgba(255,255,255,.35)"/><rect x="12" y="20" width="22" height="16" rx="3" fill="#E9C46A"/><path d="M12 28h22M23 20v16" stroke="#B8902F" stroke-width="1"/><circle cx="102" cy="62" r="9" fill="#FF5A45" opacity=".9"/><circle cx="112" cy="62" r="9" fill="#FFB547" opacity=".85"/><rect x="12" y="56" width="60" height="5" rx="2.5" fill="rgba(255,255,255,.45)"/><rect x="12" y="45" width="84" height="5" rx="2.5" fill="rgba(255,255,255,.7)"/></g>` +
    `<g transform="translate(170 64) rotate(8)" opacity=".55"><rect width="110" height="68" rx="11" fill="#E9E8FB"/></g>`),
  biryani: svg(lin('#5A1A10', '#B23A24', '#F0703F') + blur,
    glow(270, 70, 60, '#FFB547', .6) +
    `<g transform="translate(205 40)"><path d="M10 50c0 30 30 44 60 44s60-14 60-44z" fill="#2A120C"/><ellipse cx="70" cy="50" rx="62" ry="14" fill="#E9A23B"/><g fill="#FFE3A3">${Array.from({ length: 26 }, (_, i) => `<ellipse cx="${18 + (i * 37) % 104}" cy="${44 + (i * 13) % 12}" rx="5" ry="2" transform="rotate(${(i * 47) % 180} ${18 + (i * 37) % 104} ${44 + (i * 13) % 12})"/>`).join('')}</g><circle cx="52" cy="44" r="5" fill="#7A3B12"/><circle cx="86" cy="47" r="4" fill="#3E7A2A"/>` +
    `<path d="M40 30c-6-10 6-14 0-24M70 26c-6-10 6-14 0-24M100 30c-6-10 6-14 0-24" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none" stroke-linecap="round"/></g>`),
  shield: svg(lin('#0E3D33', '#1F8A6E', '#5EF2C6') + blur,
    glow(270, 70, 55, '#5EF2C6', .5) +
    `<g transform="translate(230 18)"><path d="M50 0l46 18v34c0 30-20 52-46 64C24 104 4 82 4 52V18z" fill="#0B2A23" stroke="rgba(255,255,255,.45)" stroke-width="2"/><path d="M28 62l3-9a5 5 0 0 1 5-3h28a5 5 0 0 1 5 3l3 9v12H28z" fill="#5EF2C6"/><circle cx="37" cy="76" r="5" fill="#0B2A23"/><circle cx="65" cy="76" r="5" fill="#0B2A23"/><path d="M36 38l10 10 20-20" stroke="#E9E8FB" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`),
  mall: svg(lin('#C9C6F2', '#E9E8FB', '#FFFFFF') + blur,
    glow(280, 70, 60, '#8F8CF2', .45) +
    `<g transform="translate(210 26)"><path d="M10 34h56l-6 70H16z" fill="#6246EA"/><path d="M24 34v-8a14 14 0 0 1 28 0v8" stroke="#2B1D86" stroke-width="4" fill="none"/><path d="M62 46h58l-6 58H68z" fill="#FF5A45"/><path d="M78 46v-8a13 13 0 0 1 26 0v8" stroke="#8E2416" stroke-width="4" fill="none"/><text x="76" y="86" font-family="Urbanist,sans-serif" font-weight="700" font-size="22" fill="#fff">50%</text></g>`),
  generic: svg(lin('#2B1D86', '#6246EA', '#8F8CF2') + blur, glow(280, 70, 70, '#E9E8FB', .35)),
};
const BY_AD = { A1: 'card', A2: 'biryani', A3: 'shield', A4: 'mall' };
const BY_TONE = { majorelle: 'card', ember: 'biryani', aqua: 'shield', lavender: 'mall' };

export function adMediaURL(ad) {
  if (ad.media) return ad.media;
  const key = ad.art || BY_AD[ad.id] || BY_TONE[ad.tone] || 'generic';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART[key]);
}
