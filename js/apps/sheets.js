// Bottom sheets (phones) and dialogs (web): calls, chat, share, menus, ads, confirmations, toasts.
import { h, icon, initials, btn, pill, adCard } from '../ui/kit.js';
import { ledStrip } from '../ui/fx.js';
import { notify, fmtTime } from '../engine/store.js';
import { recordClick } from '../engine/ads.js';

export function openSheet(app, spec) { app.sheet = spec; app.ui.dirty?.(); }
export function closeSheet(app) { app.sheet?.onClose?.(); app.sheet = null; app.call = null; app.ui.dirty?.(); }
export function flash(app, title, body = '', tone = 'good') { app.toast = { n: { title, body, tone }, until: performance.now() + 3200 }; app.ui.dirty?.(); }

export function renderSheet(app, { web = false } = {}) {
  const sp = app.sheet; if (!sp) return null;
  const wrap = h('div', { class: web ? 'web-sheet' : 'sheet-wrap', onclick: e => { if (e.target === wrap) closeSheet(app); } },
    h('div', { class: 'sheet' }, !web && h('div', { class: 'grab' }),
      h('div', { class: 'flex between', style: { alignItems: 'flex-start' } },
        h('div', null, sp.title && h('h2', null, sp.title), sp.sub && h('p', { class: 'sub' }, sp.sub)),
        h('button', { class: 'iconbtn', 'aria-label': 'Close', style: { width: '34px', height: '34px', flex: 'none' }, onclick: () => closeSheet(app) }, icon('close', 16))),
      sp.body()));
  return wrap;
}

// ---------- Masked call ----------
export function callSheet(app, { name, role = '', number = '+91 80 4719 ••••' }) {
  app.call = { t0: performance.now(), muted: false, speaker: false };
  openSheet(app, {
    title: null, sub: null,
    body: () => {
      const c = app.call; if (!c) return null;
      const sec = Math.floor((performance.now() - c.t0) / 1000);
      const connected = sec >= 2;
      const t = connected ? `${String(Math.floor((sec - 2) / 60)).padStart(2, '0')}:${String((sec - 2) % 60).padStart(2, '0')}` : 'Calling…';
      return [
        h('div', { class: 'callring' }, h('div', { class: 'avatar lg violet', style: { width: '64px', height: '64px', fontSize: '20px' } }, initials(name))),
        h('div', { class: 'center' }, h('div', { style: { fontSize: '22px', fontWeight: 400 } }, name), h('div', { class: 'small' }, role), h('div', { class: 'label mt8' }, `${t} · masked number ${number}`)),
        h('div', { class: 'mt12' }, ledStrip(18, connected ? 'var(--aqua)' : 'var(--periwinkle)')),
        h('div', { class: 'flex mt16', style: { justifyContent: 'center', gap: '14px' } },
          roundBtn(c.muted ? 'Unmute' : 'Mute', 'minus', c.muted, () => { c.muted = !c.muted; app.ui.dirty(); }),
          roundBtn('Speaker', 'ad', c.speaker, () => { c.speaker = !c.speaker; app.ui.dirty(); }),
          roundBtn('End', 'phone', false, () => closeSheet(app), true)),
        h('p', { class: 'label center mt16' }, 'Neither side sees the other\'s real number. Calls are recorded for safety.'),
      ];
    },
  });
}
const roundBtn = (label, ic, on, fn, danger) => h('button', { class: 'center', onclick: fn, style: { display: 'grid', justifyItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--fg-2)' } },
  h('span', { class: 'iconbtn', style: { width: '58px', height: '58px', background: danger ? 'linear-gradient(180deg,#FF6B57,#E2402C)' : on ? 'var(--lavender)' : null, color: danger ? '#fff' : on ? 'var(--ink)' : null } }, icon(ic, 22)), label);

// ---------- In-app chat on a ride ----------
const QUICK = { rider: ['I\'m at the gate', 'Coming in 2 minutes', 'Please call when you arrive', 'I have extra luggage'], driver: ['I\'ve arrived', 'Stuck in traffic, 3 minutes', 'Which gate are you at?', 'Please share your OTP when you board'] };
export function chatSheet(app, s, ride, from) {
  const other = from === 'rider' ? s.get().drivers.find(d => d.id === ride.driverId)?.name : s.get().riders.find(r => r.id === ride.riderId)?.name || ride.guest;
  openSheet(app, {
    title: other, sub: `Ride ${ride.id} · messages stay inside the app`,
    body: () => {
      ride.chat ||= [];
      return [
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '120px' } },
          ride.chat.length ? ride.chat.map(m => h('div', { class: `msg ${m.from === from ? 'me' : 'bot'}` }, m.text, h('span', { class: 'time' }, fmtTime(m.at)))) : h('div', { class: 'label center', style: { margin: 'auto' } }, 'No messages yet.')),
        h('div', { class: 'qr mt12', style: { maxWidth: '100%' } }, QUICK[from].map(q => h('button', { onclick: () => {
          ride.chat.push({ from, text: q, at: s.get().now });
          notify(s, from === 'rider' ? 'driver' : 'rider', from === 'rider' ? ride.driverId : ride.riderId, `Message from ${from === 'rider' ? 'your rider' : 'your driver'}`, q, 'info', 'ride');
          setTimeout(() => { ride.chat.push({ from: from === 'rider' ? 'driver' : 'rider', text: from === 'rider' ? 'Okay, noted. See you soon.' : 'Okay, coming.', at: s.get().now }); app.ui.dirty(); }, 1400);
          app.ui.dirty();
        } }, q))),
      ];
    },
  });
}

// ---------- Share trip ----------
export function shareSheet(app, s, ride, rider) {
  const sel = new Set((rider?.contacts || []).filter(c => c.auto).map(c => c.id));
  openSheet(app, {
    title: 'Share this trip', sub: 'They see the car, driver and live location until you arrive.',
    body: () => [
      h('div', { class: 'card flex between' }, h('div', null, h('div', { class: 'label' }, 'Live link'), h('div', { style: { fontWeight: 600 } }, `easydrivess.in/t/${ride.id.toLowerCase()}`)), h('button', { class: 'btn dark sm', onclick: () => flash(app, 'Link copied', 'Paste it anywhere to share your trip.') }, 'Copy')),
      h('div', { class: 'card mt12' }, (rider?.contacts || []).map(c => h('button', { class: 'set', onclick: () => { sel.has(c.id) ? sel.delete(c.id) : sel.add(c.id); app.ui.dirty(); } },
        h('div', { class: 'avatar' }, initials(c.name)), h('div', { class: 'grow' }, h('b', null, c.name), h('small', null, c.phone)), h('span', { class: `select ${sel.has(c.id) ? 'on' : ''}` }, sel.has(c.id) ? icon('check') : null)))),
      h('div', { class: 'mt16' }, btn(`Share with ${sel.size || 'no one'}`, { kind: 'primary', disabled: !sel.size, onClick: () => {
        ride.sharedWith = [...sel]; ride.log.push({ at: s.get().now, text: `Trip shared with ${sel.size} contact${sel.size > 1 ? 's' : ''}` });
        closeSheet(app); flash(app, 'Trip shared', `${(rider.contacts || []).filter(c => sel.has(c.id)).map(c => c.name).join(', ')} can follow along by SMS.`);
      } })),
    ],
  });
}

// ---------- Menus, ads, confirmations ----------
export function menuSheet(app, title, items) {
  openSheet(app, { title, body: () => h('div', { class: 'card', style: { padding: '2px 14px' } }, items.map(it => h('button', { class: 'set', onclick: () => { closeSheet(app); it.run(); } },
    h('span', { class: 'ic', style: it.danger ? { color: 'var(--ember)' } : null }, icon(it.icon)), h('div', { class: 'grow' }, h('b', { style: it.danger ? { color: '#FF8A78' } : null }, it.label), it.sub && h('small', null, it.sub)), h('span', { class: 'chev' }, icon('back', 16))))) });
}
export function adSheet(app, s, ad) {
  recordClick(s, ad.id);
  openSheet(app, {
    title: ad.advertiser, sub: 'Sponsored offer',
    body: () => [adCard(ad), h('div', { class: 'card mt12' }, h('div', { class: 'small' }, `${ad.title}. ${ad.sub}. Offer details are sent to your phone by SMS; Easydrivess never shares your trips with advertisers.`)),
      h('div', { class: 'mt16' }, btn(ad.cta, { kind: 'primary', onClick: () => { closeSheet(app); flash(app, 'Offer sent', `${ad.advertiser} details are on their way by SMS.`); } })),
      h('button', { class: 'btn block mt8', style: { color: 'var(--fg-3)', height: '40px' }, onclick: () => { closeSheet(app); flash(app, 'Hidden', 'You will see fewer offers like this.', 'info'); } }, 'Not interested')],
  });
}
export function confirmSheet(app, { title, sub, confirm, danger, run }) {
  openSheet(app, { title, sub, body: () => [btn(confirm, { kind: danger ? 'violet' : 'primary', onClick: () => { closeSheet(app); run(); } }), h('button', { class: 'btn block mt8', style: { color: 'var(--fg-2)', height: '42px' }, onclick: () => closeSheet(app) }, 'Not now')] });
}
export { pill };
