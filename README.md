# Easydrivess Suite — simulation

A clickable simulation of the full Easydrivess platform for Sabharwal Easydrivess: **Rider**, **Driver**, **Manager** and **WhatsApp** phones, plus the **Hotel desk** and **Operations console** on the web. One simulated engine runs everything, so an action in one app shows in all the others. No backend; all data is demo data.

## Run

```powershell
node serve.mjs 5190
```

Open http://localhost:5190. Tests: `npm test` (engine, Node 24).

## Presenter bar
- **Live**: four phones side by side, Hotel desk and Ops console below.
- **Rider / Driver / Manager / WhatsApp / Hotel / Operations**: one app full size.
- **Screens**: every phone screen, numbered.
- Clock: play/pause and 1× / 4× / 16× (1× = 15× real time).
- **Scenarios**: jump straight to a demo moment. **Reset demo** restarts at 9:00 AM.
- Under the Driver phone: **Autopilot** (driver accepts and verifies by itself) and **Follow rider** (the Driver phone shows whoever is serving the Rider phone).

## 10-minute demo
1. **Rider → Airport → Choose car → Book** (4 taps). The fare sentence explains car year, condition and the airport rate.
2. Watch the Driver phone receive it (turn Autopilot off to swipe and type the OTP yourself). The rider sees ETA, plate, OTP and the car's condition score.
3. **Manager → Book rides → Choose people → Select all → See smart plan → Pay** (4 taps after opening). 7 colleagues go in 3 cars, with the saving shown.
4. **WhatsApp → Say hi → City → location → destination → class** (4 taps after hi). The booking appears in Ops tagged WhatsApp, and the driver card arrives in the chat.
5. **Hotel → Book pickup → Book** for a guest, then **Flight update** to see the pickup move.
6. **Ops**: change a rate in Pricing and Apply; onboard the waiting car (accept the photo pre-check, finish the manual checks, verify police papers, approve); publish an ad and watch it appear in the Rider app; Approve all payouts; handle an SOS (Scenarios → SOS on a live trip).
7. **Scenarios → Shine Check needs a retake** to show the driver's 4-photo check and a one-photo retake.

## Where things live
- `js/engine/`: pricing and condition score, batching, dispatch and rides, wallet and payouts, ads, safety, WhatsApp chat flow, seed data.
- `js/apps/`: one file per app. `js/ui/kit.js`: design-system components.
- Plan and design: `../docs/2026-11-25-easydrivess-suite-design.md`.
