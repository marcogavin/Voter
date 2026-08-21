# Tests

The app ships with no dependencies and no build step. Its tests are allowed
both — that trade is deliberate, and it stops here: nothing in `test/` is
served to anybody.

```sh
cd test
npm install
npx playwright install chromium   # once
npm test
```

`npm test` prints one line per suite and exits non-zero if any of them fails.

## What runs where

**Logic** runs in jsdom against the real page scripts. `test/lib/build.sh`
copies `js/app.js`, `js/host.js`, `js/screen.js` and `js/sync.js`, swapping
only the imports that would reach the network for stubs. Everything under
test is the file that ships — a hand-kept copy is a copy that drifts, and a
suite passing against a drifted copy is worse than no suite at all.

**Layout** runs in Chromium against the whole app, mirrored into
`test/build/site/` with the same stubbed sync. Those suites measure real
boxes: nothing overflowing, nothing touching, nothing cut off, and every step
of the tour pointing at what it talks about.

Both are generated on every run and both are gitignored.

## The suites

| | |
| :--- | :--- |
| `run` | what `sync.js` writes, and what it reads back |
| `fresh` | the freshness contract, and that every word in it is declared |
| `guards` | every cached screen forgets itself when the language changes |
| `join` | giving a name, and being refused one |
| `applause` | hearts, and whose they are |
| `fallbacks` | the English in the markup matches the English in `i18n.js` |
| `startover` | what Start over clears, and what it asks first |
| `polls` | the poll picker, its dates and its counts |
| `pause` | hiding the screen stops the clock |
| `badge` | the two badges, and what each of them means |
| `scores` | the leaderboard, the clock on it, and who is in the room |
| `stopwatch` | what a phone puts on the clock when it votes |
| `signin` | what the page says while Google has the screen |
| `account` | the account line is right the moment the gate opens, not after |
| `tour` | the guided tour, start to finish |
| `news` | the version, and what it opens |
| `board` | the end of a poll, on the phone and on the host |
| `wall-unit` | the projector, screen by screen |
| `contrast` | every colour pair, in both palettes |
| `clearroom` | Clear the room: who it's offered to, what it asks, what it clears |
| `gate` | the host page ships closed |
| `overflow` | nothing escapes the card, in five languages |
| `taps` | nothing on a phone is smaller than a thumb |
| `touching` | no two grounds a hair apart |
| `wall-fit` | the projector fits four shapes of display |
| `tourfit` | every tour step points at what it talks about |

## Rules

Neither of the above touches `database.rules.json` — it's a Firebase concept,
not a browser one, and nothing in jsdom or Chromium ever evaluates it. That
file is documentation until it's republished by hand in the Firebase console
(see the root `CLAUDE.md`), and its own logic — what an audience phone can
read and when, what a device that isn't the owner can write — needs its own
kind of proof: the real rules, in a real Realtime Database, refusing a real
request.

`test/rules/` is that suite. It runs `js/sync.js` — unmodified, unstubbed —
against a real Firebase Auth + Realtime Database emulator loaded with the
actual `database.rules.json`, so a change to either one gets checked against
what Firebase itself will do with it, not what the code assumes it does.

```sh
cd test/rules
npm install                # once — firebase, firebase-admin, firebase-tools
npm test                   # needs a JDK on PATH; downloads the emulators once
```

Not part of `npm test` in `test/` — spinning up two emulators costs a few
seconds and a JVM, which the fast suite deliberately never requires. Run it
by hand whenever `database.rules.json` or `js/sync.js`'s `onEventChange`
changes, and before republishing either one to the console: this is the
suite that would have caught both real mistakes that made it to a live event
before it existed — an aggregate read with no rule of its own being refused
outright instead of filtered, and a stale rule rejecting a whole multi-path
write over one new field riding along with it.



Suites are plain node — no framework, no runner, no configuration. A suite
prints a `✓` or `✗` per assertion and ends with `all passed` or `N FAILED`,
and `run.sh` reads the last line. That is the entire contract.

Two habits worth keeping:

**Watch it fail before you trust it.** Every check here has been broken on
purpose once to confirm it catches the thing. A check nobody has seen fail is
a check nobody has tested.

**Assert on what is visible.** Twice a suite has passed by reading a hidden
element, and once by reading a heading the previous screen had left behind.
`hidden`, `offsetParent`, and a rectangle are the difference between testing
the page and testing the DOM.
