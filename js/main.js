import { createStore, fmtClock, fmtTime } from './engine/store.js';
import { seed } from './engine/seed.js';
import { tick } from './engine/rides.js';
import { h, icon, mark } from './ui/kit.js';
import { createRider } from './apps/rider.js';
import { createDriver } from './apps/driver.js';
import { createManager } from './apps/manager.js';
import { createWhatsApp } from './apps/whatsapp.js';
import { createHotel } from './apps/hotel.js';
import { createOps } from './apps/ops.js';
import { SCENARIOS } from './scenarios.js';

// Sim seconds per real second at each speed. Ruling: "1×" is 15× real time so a ride plays in about two minutes.
const SPEEDS = [['1×', 15], ['4×', 60], ['16×', 240]];

let s, apps, presenter;
function boot() {
  s = createStore(); seed(s);
  apps = {
    rider: createRider(s), driver: createDriver(s), manager: createManager(s),
    whatsapp: createWhatsApp(s), hotel: createHotel(s), ops: createOps(s),
  };
  for (const a of Object.values(apps)) a.ui.dirty = markDirty;
  s.on('*', type => { if (type !== 'tick') markDirty(); });
  s.on('notify', n => {
    for (const a of Object.values(apps)) if (a.notifyKey?.(n)) { a.toast = { n, until: performance.now() + 4200 }; }
  });
  presenter = presenter || { view: 'live', speed: 0, playing: true, menu: false };
}

const PHONES = [['rider', 'Rider'], ['driver', 'Driver'], ['manager', 'Manager'], ['whatsapp', 'WhatsApp']];
const WEBS = [['hotel', 'Hotel desk', 'hotel.easydrivess.in'], ['ops', 'Operations console', 'ops.easydrivess.in']];

let dirty = true;
const markDirty = () => { dirty = true; };
const mounts = {};

function statusBar() {
  return h('div', { class: 'status' }, h('span', null, fmtClock(s.get().now).replace(/^0/, '')),
    h('span', { class: 'sig' },
      h('svg', { viewBox: '0 0 17 12', fill: 'currentColor' }, [0, 1, 2, 3].map(i => h('rect', { x: i * 4.5, y: 9 - i * 3, width: 3, height: 3 + i * 3, rx: 1 }))),
      h('svg', { viewBox: '0 0 24 12', style: { width: '25px' } }, h('rect', { x: .5, y: .5, width: 21, height: 11, rx: 3.5, fill: 'none', stroke: 'currentColor', opacity: .4 }), h('rect', { x: 2, y: 2, width: 16, height: 8, rx: 2, fill: 'currentColor' }), h('rect', { x: 22.5, y: 4, width: 1.5, height: 4, rx: .75, fill: 'currentColor', opacity: .4 }))));
}

function phone(id) {
  const a = apps[id];
  const kids = a.render();
  const toast = a.toast && a.toast.until > performance.now() ? h('div', { class: 'toast' }, h('span', { class: 'ic' }, icon(a.toast.n.tone === 'alert' ? 'sos' : 'bell', 16)), h('div', null, h('b', null, a.toast.n.title), h('span', null, a.toast.n.body))) : null;
  return h('div', { class: 'phone' }, h('div', { class: `screen${a.light ? ' light' : ''}` }, h('div', { class: 'island' }), statusBar(), toast, h('div', { class: 'app' }, kids), h('div', { class: 'home-ind' })));
}

function web(id, url) {
  return h('div', { class: 'browser', style: { height: presenter.view === 'live' ? '760px' : 'calc(100vh - 120px)' } },
    h('div', { class: 'chrome' }, h('div', { class: 'lights' }, h('i'), h('i'), h('i')), h('div', { class: 'url' }, url)),
    apps[id].render({ compact: presenter.view === 'live' && id === 'hotel' }));
}

// Re-render one mount, keeping scroll positions and skipping while the user types in it.
function paint(key, build) {
  const m = mounts[key]; if (!m) return;
  const ae = document.activeElement;
  if (ae && m.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  if (m.querySelector('.dragging')) return; // never replace a swipe mid-drag
  const scrolls = {}; m.querySelectorAll('[data-key], .scroll, .main, .chat').forEach((el, i) => { scrolls[el.dataset.key || i] = el.scrollTop; });
  const chatAtBottom = [...m.querySelectorAll('.chat')].some(el => el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  m.replaceChildren(build());
  m.querySelectorAll('[data-key], .scroll, .main, .chat').forEach((el, i) => { const v = scrolls[el.dataset.key || i]; if (v != null) el.scrollTop = v; });
  if (chatAtBottom || !Object.keys(scrolls).length) m.querySelectorAll('.chat').forEach(el => { el.scrollTop = el.scrollHeight; });
}

function bar() {
  const tab = (v, l) => h('button', { 'aria-pressed': String(presenter.view === v), onclick: () => { presenter.view = v; layout(); } }, l);
  return h('header', { class: 'bar' },
    h('div', { class: 'wordmark' }, mark('violet'), 'Easydrivess', h('span', { class: 'demo-tag' }, 'Demo')),
    h('nav', { class: 'tabs' }, tab('live', 'Live'), PHONES.map(([k, l]) => tab(k, l)), WEBS.map(([k, l]) => tab(k, l.split(' ')[0])), tab('gallery', 'Screens')),
    h('div', { class: 'spacer' }),
    h('div', { class: 'clock' },
      h('button', { class: 'iconbtn', style: { width: '32px', height: '32px' }, 'aria-label': presenter.playing ? 'Pause' : 'Play', onclick: () => { presenter.playing = !presenter.playing; layout(); } }, icon(presenter.playing ? 'pause' : 'play', 15)),
      h('span', { class: 'time', id: 'simclock' }, fmtTime(s.get().now)),
      h('div', { class: 'seg' }, SPEEDS.map(([l], i) => h('button', { 'aria-pressed': String(presenter.speed === i), onclick: () => { presenter.speed = i; layout(); } }, l)))),
    h('div', { style: { position: 'relative' } },
      h('button', { class: 'menu-btn', onclick: () => { presenter.menu = !presenter.menu; layout(); } }, icon('spark', 16), 'Scenarios'),
      presenter.menu && h('div', { class: 'dropdown' }, SCENARIOS.map(sc => h('button', { onclick: () => { presenter.menu = false; sc.run(s, apps, presenter); layout(); } }, h('b', null, sc.title), h('small', null, sc.note))),
        h('button', { onclick: () => { presenter.menu = false; boot(); layout(); } }, h('b', null, 'Reset demo'), h('small', null, 'Back to 9:00 AM with fresh data')))));
}

function layout() {
  const root = document.getElementById('root');
  const v = presenter.view;
  const stage = h('main', { class: `stage ${v === 'live' ? 'live' : ''}` });
  for (const k in mounts) delete mounts[k];
  if (v === 'live') {
    stage.append(h('div', { class: 'phones' }, PHONES.map(([k, l]) => {
      const m = h('div', { class: 'phone-scale', style: { '--k': .74 } }); mounts[k] = m;
      return h('div', { class: 'phone-col' }, h('div', { class: 'cap', 'data-cap': k, 'data-label': l }), m, apps[k].controls?.());
    })), h('div', { class: 'webs' }, WEBS.map(([k]) => { const m = h('div'); mounts[k] = m; return m; })));
  } else if (v === 'gallery') {
    stage.append(gallery());
  } else if (PHONES.some(([k]) => k === v)) {
    const m = h('div', { class: 'phone-scale', style: { '--k': 1 } }); mounts[v] = m;
    stage.append(h('div', { class: 'focus' }, h('div', { class: 'phone-col' }, h('div', { class: 'cap', 'data-cap': v, 'data-label': PHONES.find(([k]) => k === v)[1] }), m, apps[v].controls?.())));
  } else {
    const m = h('div'); mounts[v] = m; stage.append(h('div', { class: 'focus web' }, m));
  }
  root.replaceChildren(bar(), stage);
  dirty = true; frame.force = true;
}

function renderAll() {
  apps.driver.sync(apps.rider);
  for (const [k] of PHONES) paint(k, () => phone(k));
  for (const [k, , url] of WEBS) paint(k, () => web(k, url));
  const c = document.getElementById('simclock'); if (c) c.textContent = fmtTime(s.get().now);
  document.querySelectorAll('[data-cap]').forEach(el => { const t = apps[el.dataset.cap].caption?.() || ''; if (el.dataset.t !== t) { el.dataset.t = t; el.replaceChildren(h('b', null, el.dataset.label), ' · ', t); } });
}

let last = performance.now(), acc = 0, lastPaint = 0;
function frame(t) {
  const dt = Math.min(250, t - last); last = t;
  // A driver gets 20 real seconds to accept, whatever the sim speed.
  s.get().offerMs = 20000 * SPEEDS[presenter.speed][1];
  if (presenter.playing) {
    acc += dt * SPEEDS[presenter.speed][1];
    while (acc >= 1000) { tick(s, 1000); acc -= 1000; }
  }
  // Paint on change, and at 4 fps while anything moves.
  const moving = s.get().rides.some(r => ['finding', 'arriving', 'arrived', 'onboard'].includes(r.status)) || Object.values(apps).some(a => a.animating?.());
  if (frame.force || (dirty && t - lastPaint > 120) || (presenter.playing && moving && t - lastPaint > 250) || Object.values(apps).some(a => a.toast && a.toast.until < performance.now() && (a.toast = null, true))) {
    renderAll(); dirty = false; lastPaint = t; frame.force = false;
  } else if (t - lastPaint > 1000) { const c = document.getElementById('simclock'); if (c) c.textContent = fmtTime(s.get().now); }
  requestAnimationFrame(frame);
}

function gallery() {
  // Every screen of every phone app, captured from fresh app instances.
  const wrap = h('div', { class: 'gallery' });
  const shots = [];
  for (const [k, l] of PHONES) for (const sc of apps[k].galleryScreens?.() || []) shots.push([k, l, sc]);
  shots.forEach(([k, l, sc], i) => {
    const a = apps[k]; const saved = { screen: a.ui.screen, params: a.ui.params };
    a.ui.screen = sc.screen; a.ui.params = sc.params || {}; sc.before?.();
    let el; try { el = phone(k); } catch (e) { el = h('div', { class: 'phone' }); }
    a.ui.screen = saved.screen; a.ui.params = saved.params; sc.after?.();
    wrap.append(h('figure', null, h('div', { class: 'phone-scale', style: { '--k': .74 } }, el), h('figcaption', null, h('b', null, String(i + 1).padStart(2, '0')), `${l} · ${sc.title}`)));
  });
  return wrap;
}

boot(); layout(); requestAnimationFrame(frame);
window.__sim = { get s() { return s; }, apps: () => apps, paint: () => renderAll(), tick: ms => tick(s, ms), layout: () => layout(), presenter: () => presenter };
