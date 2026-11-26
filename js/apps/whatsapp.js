import { h, icon, dotNumber, initials } from '../ui/kit.js';
import { inr, fmtClock } from '../engine/store.js';
import { places } from '../engine/geo.js';
import { waHandle } from '../engine/whatsapp.js';
import { router } from './common.js';
import { callSheet, menuSheet, openSheet, closeSheet, flash } from './sheets.js';
import { btn } from '../ui/kit.js';

const sv = (d, w = 22, extra = {}) => h('svg', { viewBox: '0 0 24 24', width: w, height: w, fill: 'currentColor', ...extra }, h('path', { d }));
const P = {
  emoji: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 18.2a8.2 8.2 0 110-16.4 8.2 8.2 0 010 16.4zM8.6 10.8a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6zm6.8 0a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6zM12 17.4c2.3 0 4.2-1.5 4.9-3.6H7.1c.7 2.1 2.6 3.6 4.9 3.6z',
  clip: 'M16.5 6.5v10.6a4.5 4.5 0 01-9 0V5.6a3 3 0 016 0v10.5a1.5 1.5 0 01-3 0V6.5H9v9.6a3 3 0 006 0V5.6a4.5 4.5 0 00-9 0v11.5a6 6 0 0012 0V6.5z',
  cam: 'M12 9.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6zM20 5h-3.2l-1.8-2H9L7.2 5H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2zm-8 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z',
  mic: 'M12 15a3.5 3.5 0 003.5-3.5v-6a3.5 3.5 0 00-7 0v6A3.5 3.5 0 0012 15zm6.1-3.5a6.1 6.1 0 01-12.2 0H4.2a7.8 7.8 0 006.9 7.7V22h1.8v-2.8a7.8 7.8 0 006.9-7.7z',
  send: 'M2 21l21-9L2 3v7l15 2-15 2z',
  video: 'M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11z',
  call: 'M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z',
  lock: 'M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3z',
  check: 'M9.5 16.2L5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z',
};
const meta = (t, me) => h('span', { class: 'time' }, t, me ? h('svg', { class: 'tk', viewBox: '0 0 20 12', width: 17, height: 11, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, h('path', { d: 'M1 6.5l3.2 3.2L11 2.5M8.2 9.2l.5.5L15.5 2.5' })) : null);
const logo = n => h('svg', { viewBox: '0 0 32 32', width: n, height: n }, h('rect', { width: 32, height: 32, rx: 16, fill: '#6246EA' }), h('path', { d: 'M10 9h12v3.6h-8v2.2h6v3.2h-6v2.4h8V24H10z', fill: '#fff' }));

// A generic chat app (our own drawing, not WhatsApp's branding) driving the chat-booking engine.
export function createWhatsApp(s) {
  const ui = router('chat');
  const app = { id: 'whatsapp', ui, chat: 'wa-rahul', draft: '' };
  const chat = () => s.get().whatsapp[app.chat];
  const send = text => { if (!text.trim()) return; waHandle(s, app.chat, text.trim()); app.draft = ''; ui.dirty(); };

  function bubble(m, i, last) {
    const t = fmtClock(s.get().now);
    if (m.from === 'user') {
      if (m.kind === 'location') return h('div', { class: 'msg me', style: { padding: '6px' } },
        h('div', { style: { borderRadius: '13px', overflow: 'hidden', background: '#2B1D86', height: '86px', width: '190px', position: 'relative' } },
          h('svg', { viewBox: '0 0 190 86', width: 190, height: 86 }, [20, 50, 80, 110, 140, 170].map(x => h('line', { x1: x, y1: 0, x2: x - 20, y2: 86, stroke: 'rgba(255,255,255,.08)' })), [20, 45, 70].map(y => h('line', { x1: 0, y1: y, x2: 190, y2: y + 6, stroke: 'rgba(255,255,255,.08)' })), h('circle', { cx: 95, cy: 43, r: 8, fill: '#E9E8FB', stroke: '#2B1D86', 'stroke-width': 3 }))),
        h('div', { style: { padding: '6px 6px 2px', fontSize: '13.5px' } }, m.text), meta(t, true));
      return h('div', { class: 'msg me' }, m.text, meta(t, true));
    }
    const active = last; // only the latest prompt's buttons stay tappable
    if (m.kind === 'buttons') return h('div', { class: 'qr', 'aria-disabled': String(!active) }, m.buttons.map(b => {
      const label = b.startsWith('loc:') ? places[b.slice(4)].name : b.startsWith('drop:') ? places[b.slice(5)].name : b;
      return h('button', { onclick: () => send(b) }, m.pin || b.startsWith('loc:') ? icon('pin') : b.startsWith('drop:') ? icon('flag') : null, b.startsWith('loc:') && b === m.buttons[0] ? `Share live location · ${label}` : label);
    }));
    if (m.kind === 'classes') return h('div', { class: 'waclass', style: active ? null : { opacity: .35, pointerEvents: 'none' } }, m.cards.map(c => h('button', { onclick: () => send(`cls:${c.cls}`) }, h('b', null, c.cls), h('span', null, `${c.min} min · condition ${c.score ?? '—'}`), h('em', null, inr(c.fare)))));
    if (m.kind === 'upi') return h('div', { class: 'msg bot', style: { padding: '12px' } },
      h('div', { class: 'flex between' }, h('div', null, h('div', { class: 'label' }, 'UPI payment link'), h('div', { style: { fontSize: '20px', fontWeight: 600 } }, inr(m.amount))), m.paid ? h('span', { class: 'pill good' }, 'Paid') : h('button', { class: 'pill violet', onclick: () => payUpi(m) }, 'Pay now')),
      h('div', { class: 'small mt8' }, m.text));
    if (m.kind === 'driver') return h('div', { class: 'msg bot', style: { padding: '12px', minWidth: '78%' } },
      h('div', { class: 'label' }, 'Your driver'),
      h('div', { class: 'flex mt8' }, h('div', { class: 'avatar violet' }, initials(m.name)), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, m.name), h('div', { class: 'label flex', style: { gap: '4px' } }, icon('star', 11), `${m.rating} · ${m.car}`))),
      h('div', { class: 'flex between mt8' }, h('span', { class: 'pill light' }, m.plate), h('span', { class: 'pill good' }, `Condition ${m.score}`)),
      h('div', { class: 'small mt8' }, `${m.sentence} Arriving in ${m.eta} min.`),
      h('div', { class: 'flex between mt8' }, h('span', { class: 'label' }, 'Ride code'), dotNumber(m.otp, { size: 3.6, off: false })),
      meta(t));
    return h('div', { class: 'msg bot' }, m.text, meta(t));
  }

  app.render = () => {
    const c = chat();
    const msgs = c?.messages || [];
    const lastBotIdx = msgs.map((m, i) => (m.from === 'bot' && ['buttons', 'classes'].includes(m.kind) ? i : -1)).filter(i => i >= 0).pop();
    const lastUser = msgs.map((m, i) => (m.from === 'user' ? i : -1)).filter(i => i >= 0).pop() ?? -1;
    const started = msgs.length && chat()?.stage !== 'confirmed';
    const call = () => callSheet(app, { name: 'Easydrivess', role: 'Booking line' });
    return [
      h('div', { class: 'chat-head' },
        h('button', { class: 'iconbtn ghost', 'aria-label': 'Chat options', onclick: () => menuSheet(app, 'Chat', [{ label: 'Start a new booking', icon: 'plus', run: () => send('hi') }, { label: 'Clear this chat', icon: 'close', danger: true, run: () => { const c = chat(); if (c) { c.messages = []; c.stage = 'start'; } ui.dirty(); } }]) }, icon('back')),
        h('div', { class: 'wa-av' }, logo(38)),
        h('div', { class: 'grow' }, h('b', null, 'Easydrivess', h('i', { class: 'vb' }, sv(P.check, 10))), h('small', null, msgs.length ? 'online' : 'Business account')),
        h('button', { class: 'iconbtn ghost', 'aria-label': 'Video call', onclick: call }, sv(P.video, 21)),
        h('button', { class: 'iconbtn ghost', 'aria-label': 'Call Easydrivess', onclick: call }, sv(P.call, 19))),
      h('div', { class: 'chat' },
        h('div', { class: 'wa-day' }, 'Today'),
        h('div', { class: 'wa-sys' }, sv(P.lock, 11), ' Messages are end-to-end encrypted. This business uses a secure service to manage this chat.'),
        !msgs.length && h('div', { class: 'wa-intro' }, logo(64),
          h('b', null, 'Easydrivess'), h('span', null, 'Cab booking · Gurugram'),
          h('p', null, 'Book a cab in 4 taps. Fare locked before you confirm. Pay by UPI or to the driver.')),
        msgs.map((m, i) => bubble(m, i, i === lastBotIdx && lastBotIdx > lastUser))),
      !started && h('div', { class: 'wa-suggest' }, h('button', { onclick: () => send('hi') }, msgs.length ? '\u{1F695} Book another ride' : '\u{1F44B} Hi'), !msgs.length && h('button', { onclick: () => send('hi') }, '\u{1F695} Book a cab')),
      h('div', { class: 'composer' },
        h('div', { class: 'wa-in' }, h('button', { class: 'ic', 'aria-label': 'Emoji' }, sv(P.emoji, 22)),
          h('input', { class: 'in', placeholder: 'Message', value: app.draft, oninput: e => { app.draft = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') { send(e.target.value); e.target.blur(); } } }),
          h('button', { class: 'ic', 'aria-label': 'Attach' }, sv(P.clip, 21, { style: 'transform:rotate(-45deg)' })),
          h('button', { class: 'ic', 'aria-label': 'Camera' }, sv(P.cam, 20))),
        h('button', { class: 'send', 'aria-label': 'Send', onclick: () => send(app.draft || 'hi') }, sv(P.send, 21))),
    ];
  };
  function payUpi(m) {
    const st = { appName: 'GPay' };
    openSheet(app, { title: `Pay ${inr(m.amount)}`, sub: 'To Easydrivess · UPI', body: () => [
      h('div', { class: 'seg2' }, ['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(n => h('button', { 'aria-pressed': String(st.appName === n), onclick: () => { st.appName = n; ui.dirty(); } }, n))),
      h('div', { class: 'mt16' }, btn(`Pay with ${st.appName}`, { kind: 'primary', arrow: true, onClick: () => {
        m.paid = true; const c = chat(); c.messages.push({ from: 'bot', kind: 'text', text: `Payment of ${inr(m.amount)} received via ${st.appName}. Thank you.` });
        const r = s.get().rides.find(x => x.id === c.data.rideId); if (r) r.prepaid = true;
        closeSheet(app); flash(app, 'Paid', `${inr(m.amount)} via ${st.appName}.`);
      } })),
    ] });
  }
  app.caption = () => 'Rahul · no app installed';
  app.galleryScreens = () => [{ title: 'Chat booking', screen: 'chat' }];
  return app;
}
