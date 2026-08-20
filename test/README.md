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
| `tour` | the guided tour, start to finish |
| `news` | the version, and what it opens |
| `board` | the end of a poll, on the phone and on the host |
| `wall-unit` | the projector, screen by screen |
| `contrast` | every colour pair, in both palettes |
| `gate` | the host page ships closed |
| `overflow` | nothing escapes the card, in five languages |
| `taps` | nothing on a phone is smaller than a thumb |
| `touching` | no two grounds a hair apart |
| `wall-fit` | the projector fits four shapes of display |
| `tourfit` | every tour step points at what it talks about |

## Writing one

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
