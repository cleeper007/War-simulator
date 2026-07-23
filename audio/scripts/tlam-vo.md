# TLAM strike — voice-over script

Radio comms for a cruise-missile run in the strike scope. One recorded set is
reused for **every** TLAM shot, so nothing spoken here names a callsign, a
launch platform, or a target — those stay in the on-screen text lines, which
already substitute `{cs}` / `{base}` / `{tgt}`.

## How long it should be

A single TLAM run in `MapView.animateStrike('cruise', …)` is:

| beat | t (s) | where it comes from |
|---|---|---|
| launch clip starts | 0.00 | `video/tlam-launch.mp4`, 4.18 s, plays in full before the flight |
| flight starts | 4.18 | `FLIGHT_DUR.cruise = 6500` ms |
| "away — vertical launch" | 4.31 | `CRUISE_EVENTS` `at: 0.02` |
| "sea-skimming / midcourse" | 6.46 | `at: 0.35` |
| problem line (30 % of runs) | 8.73 | `at: 0.70`, `chance: 0.3` |
| "TERMINAL" | 10.62 | `at: 0.99` |
| impact + BDA + `impact.wav` | 10.68 | `impact()` → `finishBatch()` |
| hit clip over the scope | 10.7 – ~14.7 | `MapView.playStrikeHit()` |
| card retires | 15.88 | `fsClose(entry, 5200)` |

**So: ~12.5 s of live run, ~16 s of card.** Record it as **five short clips
totalling ~10 s** — not one long take. The gaps between cues are 2.2 s, 2.3 s,
1.9 s and 0.06 s, so no single clip can be long:

- VO-1 launch — **≤ 3.2 s** (has the whole 4.18 s launch clip to itself)
- VO-2 midcourse — **≤ 2.2 s**
- VO-3 problem — **≤ 1.8 s** (tight; the terminal call is right behind it)
- VO-4 terminal — **≤ 0.9 s**
- VO-5 BDA — **≤ 3.0 s** (fires 1.3 s after impact, must end before the card closes)

Anything longer and a line is still talking when the next one keys up. `play()`
resets `currentTime = 0` on a shared `Audio` element, so a clip that overruns
gets cut off mid-word rather than queued.

## The script

One voice throughout: strike controller on a ship's net. Flat, bored, fast.
Nobody in this loop is excited — the missiles fly themselves.

### VO-1 — LAUNCH (cue t = 0.4 s, under the launch clip)

> "Birds away. Vertical launch, salvo is in the air."

Alt take (record both, pick at random so repeat volleys don't loop):
> "Salvo away — all birds clear the tubes, boost phase nominal."

### VO-2 — MIDCOURSE (cue t = 6.46 s)

> "Sea-skimming, terrain following. Tracking on inertial."

Alt take:
> "Midcourse waypoints good — birds are in the weeds."

### VO-3 — PROBLEM (cue t = 8.73 s, only on the 30 % of runs that roll it)

Three takes, one per existing `CRUISE_EVENTS` problem line:

> a. "Weather over the target — terminal seeker degrading."
> b. "One bird lost to a booster fault. Remainder pressing."
> c. "Targeting package is stale — running last-good coordinates."

### VO-4 — TERMINAL (cue t = 10.55 s, lands on the impact flash)

> "Terminal."

Alt take:
> "Terminal phase — stand by."

### VO-5 — BDA (cue t = 12.0 s, after `impact.wav` clears, over the hit clip)

Hit:
> "Good hit, good hit. Secondaries on the aimpoint."

Alt hit take:
> "Impact on the aimpoint — target is burning."

Miss:
> "Splash long. No effect on target."

Alt miss take:
> "Weapons impacted clear of the aimpoint. Target is intact."

## Recording specs

Match the existing clips in `audio/`: **mono WAV, 44.1 kHz, 16-bit**. Peak
around −6 dBFS — `launch.wav` (0.6 s) and `impact.wav` (0.9 s) play *underneath*
VO-1 and VO-5, and voice has to sit on top of them without either one
disappearing.

Radio treatment: band-pass 300–3400 Hz, hard-ish comms compression, a touch of
clipping distortion, and a short squelch tail (~80 ms) on the end of each clip.
No room reverb.

## Wiring (not built yet)

Each line becomes a key in `FILES` in [audio.js](../../js/audio.js) — e.g.
`vo.tlamLaunch`, `vo.tlamMid`, `vo.tlamProblem.a`, `vo.tlamTerminal`,
`vo.tlamHit`, `vo.tlamMiss`. Cues hang off the beats that already exist: the
`CRUISE_EVENTS` entries gain an `audio` key (same grammar the raid and CSAR
scripts already use in [specops.js](../../js/specops.js) and
[csar.js](../../js/csar.js)), and BDA is cued from `finishBatch()` in
[game.js](../../js/game.js), which is the one place that already knows hit
from miss.

One caveat to design around: `play()` shares a single `Audio` element per key,
so the same VO key cannot overlap itself. TLAM batches resolve one card at a
time, so that only bites if a future change runs two scopes at once.
