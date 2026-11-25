import { h, icon, dotNumber, initials } from '../ui/kit.js';
import { inr, fmtClock } from '../engine/store.js';
import { places } from '../engine/geo.js';
import { waHandle } from '../engine/whatsapp.js';
import { router } from './common.js';

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
        h('div', { style: { padding: '6px 6px 2px', fontSize: '13.5px' } }, m.text), h('span', { class: 'time' }, t));
      return h('div', { class: 'msg me' }, m.text, h('span', { class: 'time' }, t));
    }
    const active = last; // only the latest prompt's buttons stay tappable
    if (m.kind === 'buttons') return h('div', { class: 'qr', 'aria-disabled': String(!active) }, m.buttons.map(b => {
      const label = b.startsWith('loc:') ? places[b.slice(4)].name : b.startsWith('drop:') ? places[b.slice(5)].name : b;
      return h('button', { onclick: () => send(b) }, m.pin || b.startsWith('loc:') ? icon('pin') : b.startsWith('drop:') ? icon('flag') : null, b.startsWith('loc:') && b === m.buttons[0] ? `Share live location · ${label}` : label);
    }));
    if (m.kind === 'classes') return h('div', { class: 'waclass', style: active ? null : { opacity: .35, pointerEvents: 'none' } }, m.cards.map(c => h('button', { onclick: () => send(`cls:${c.cls}`) }, h('b', null, c.cls), h('span', null, `${c.min} min · condition ${c.score ?? '—'}`), h('em', null, inr(c.fare)))));
    if (m.kind === 'upi') return h('div', { class: 'msg bot', style: { padding: '12px' } },
      h('div', { class: 'flex between' }, h('div', null, h('div', { class: 'label' }, 'UPI payment link'), h('div', { style: { fontSize: '20px', fontWeight: 600 } }, inr(m.amount))), h('span', { class: 'pill violet' }, 'Pay now')),
      h('div', { class: 'small mt8' }, m.text));
    if (m.kind === 'driver') return h('div', { class: 'msg bot', style: { padding: '12px', minWidth: '78%' } },
      h('div', { class: 'label' }, 'Your driver'),
      h('div', { class: 'flex mt8' }, h('div', { class: 'avatar violet' }, initials(m.name)), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, m.name), h('div', { class: 'label flex', style: { gap: '4px' } }, icon('star', 11), `${m.rating} · ${m.car}`))),
      h('div', { class: 'flex between mt8' }, h('span', { class: 'pill light' }, m.plate), h('span', { class: 'pill good' }, `Condition ${m.score}`)),
      h('div', { class: 'small mt8' }, `${m.sentence} Arriving in ${m.eta} min.`),
      h('div', { class: 'flex between mt8' }, h('span', { class: 'label' }, 'Ride code'), dotNumber(m.otp, { size: 3.6, off: false })),
      h('span', { class: 'time' }, t));
    return h('div', { class: 'msg bot' }, m.text, h('span', { class: 'time' }, t));
  }

  app.render = () => {
    const c = chat();
    const msgs = c?.messages || [];
    const lastBotIdx = msgs.map((m, i) => (m.from === 'bot' && ['buttons', 'classes'].includes(m.kind) ? i : -1)).filter(i => i >= 0).pop();
    const lastUser = msgs.map((m, i) => (m.from === 'user' ? i : -1)).filter(i => i >= 0).pop() ?? -1;
    return [
      h('div', { class: 'chat-head' }, h('button', { class: 'iconbtn ghost' }, icon('back')), h('div', { style: { width: '36px', height: '36px' } }, h('svg', { viewBox: '0 0 32 32', width: 36, height: 36 }, h('rect', { width: 32, height: 32, rx: 16, fill: '#6246EA' }), h('path', { d: 'M10 9h12v3.6h-8v2.2h6v3.2h-6v2.4h8V24H10z', fill: '#fff' }))),
        h('div', { class: 'grow' }, h('b', null, 'Easydrivess'), h('small', null, 'Business account · replies instantly')), h('button', { class: 'iconbtn ghost' }, icon('phone'))),
      h('div', { class: 'chat' },
        !msgs.length && h('div', { class: 'center small', style: { margin: 'auto 20px', color: 'var(--fg-3)' } }, 'Book a cab by chat. No app needed. Say hi to start.'),
        msgs.map((m, i) => bubble(m, i, i === lastBotIdx && lastBotIdx > lastUser))),
      h('div', { class: 'composer' },
        !msgs.length || chat()?.stage === 'confirmed' ? h('button', { class: 'btn primary', style: { flex: 1, height: '42px' }, onclick: () => send('hi') }, msgs.length ? 'Book another ride' : 'Say hi') :
          h('input', { class: 'in', placeholder: 'Message', value: app.draft, oninput: e => { app.draft = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') { send(e.target.value); e.target.blur(); } } }),
        h('button', { class: 'send', 'aria-label': 'Send', onclick: () => send(app.draft || 'hi') }, icon('send'))),
    ];
  };
  app.caption = () => 'Rahul · no app installed';
  app.galleryScreens = () => [{ title: 'Chat booking', screen: 'chat' }];
  return app;
}
