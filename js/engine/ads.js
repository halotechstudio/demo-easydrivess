import { IST } from './store.js';

// Ads never appear on these screens.
export const NO_AD_SLOTS = ['live-trip', 'sos', 'payment'];
export const AD_SLOTS = [
  { id: 'rider-home', label: 'Rider · home' }, { id: 'rider-finding', label: 'Rider · finding a car' },
  { id: 'rider-complete', label: 'Rider · trip complete' }, { id: 'rider-trips', label: 'Rider · my trips' },
  { id: 'driver-home', label: 'Driver · home' }, { id: 'driver-earnings', label: 'Driver · earnings' },
  { id: 'manager-home', label: 'Manager · home' },
];
const CAP = 3;
const day = ms => Math.floor((ms + IST) / 86400e3);
const key = (viewer, ad, ms) => `${viewer}|${ad}|${day(ms)}`;

export function pickAd(s, slot, viewer) {
  if (NO_AD_SLOTS.includes(slot)) return null;
  const st = s.get();
  const ok = st.ads.filter(a => a.on && a.slots.includes(slot) && (st.adViews[key(viewer, a.id, st.now)] || 0) < CAP);
  if (!ok.length) return null;
  return ok.sort((a, b) => (st.adViews[key(viewer, a.id, st.now)] || 0) - (st.adViews[key(viewer, b.id, st.now)] || 0))[0];
}

export function recordImpression(s, adId, viewer) {
  const st = s.get(); const a = st.ads.find(x => x.id === adId); if (!a) return;
  const k = key(viewer, adId, st.now); st.adViews[k] = (st.adViews[k] || 0) + 1; a.impressions++;
}
export function recordClick(s, adId) { const a = s.get().ads.find(x => x.id === adId); if (a) { a.clicks++; s.dispatch('ad', a); } }
export const adRevenue = a => Math.round(a.impressions / 1000 * a.cpm);
