# VOTR design system

One scale for everything held in a hand. Both of those screens — the host's
control panel and the audience's phone — use the same type sizes, the same
spacing, the same control heights. There is no host variant and no audience
variant.

The projector (§16) is the single exception, and it is a scale rather than a
set of overrides: everything but size is borrowed from the tokens below.

This file is the contract. A value that isn't here doesn't go in the
stylesheet.

## Why this exists

The stylesheet grew a value at a time, and by August 2026 it held **24 distinct
font sizes across 47 declarations, 24 spacing values, 15 corner radii**, and 46
rules whose only job was re-stating a size for one screen or the other. Nothing
was wrong with any single number. The problem was that no number meant
anything: 0.93rem existed because 0.62 × 1.5 is 0.93, not because anyone chose
it.

The point of a scale isn't tidiness. It's that a size becomes a decision you
make once and then reuse, so two things that should look alike do.

---

## 1. Identity

**Light, flat, and mostly out of the way.** The interface is a white card on a
near-white page. Ink and one accent carry it; everything else is a shade of
paper, there to separate things rather than to decorate them.

There is no chrome. No bezel, no dark surround, no gradients, no inset
shadows, no simulated materials. One elevation exists — a card is either on
the page or it isn't.

**One accent, and it is royal blue.** Everything a person can act on is either
that colour or plain ink; nothing decorative is either. The terracotta it
replaces sat a few degrees from the red that means "wrong answer", so the one
colour meaning "you can press this" and the one meaning "you got this wrong"
were neighbours. The wordmark is redrawn to match.

**What went:** the bezel and its dark room, the cream panel, the VU-meter tick
marks and their inset shadow, the bar gradients, and Futura at the head of the
type stack. The two screenshots that prompted this are a reference for the
feel — light, generous, one strong colour used sparingly — not a thing to copy.

Revisiting the direction is a separate decision, taken separately.

## 2. Colour

### Paper

| Token | Value | Where |
| :--- | :--- | :--- |
| `--bg` | `#f4f4f5` | The page behind the card |
| `--surface` | `#ffffff` | The card, and anything raised off the page |
| `--sunken` | `#f0f0f1` | Fields, and anything you type or choose into |
| `--border` | `#e3e3e6` | Hairlines and control outlines |
| `--scrim` | `rgba(23, 23, 26, 0.45)` | Behind an overlay |

On a phone in portrait the card fills the screen, so `--bg` is redefined to
`--surface` — none of the page shows, and two whites a shade apart would only
look like a mistake.

### Ink

| Token | Value | Where |
| :--- | :--- | :--- |
| `--ink` | `#17171a` | All primary text |
| `--muted` | `#67676d` | Labels, meta, disabled, percentages |

`--muted` is two shades darker than it first shipped. As the share written
inside a tinted answer card it measured 4.42:1, and the line for text is 4.5.
Every pair in this file is checked by a script rather than by eye — see
§14.

### Accent

| Token | Value | Where |
| :--- | :--- | :--- |
| `--accent` | `#1d4ed8` | Primary buttons, the active segment, icons, the status badge, focus rings |
| `--accent-deep` | `#1a43bd` | Pressed and hover |
| `--accent-soft` | `#e9eefc` | The ground under an icon button |
| `--accent-soft-hover` | `#dbe4fa` | The same, hovered |
| `--on-accent` | `#ffffff` | Text and marks on any of the above |

Used sparingly and only for things you can act on. If two accent-coloured
things are on screen at once, one of them is wrong.

### Result colours

Never the only signal. The tick box, ✓ and ✗ carry the same meaning for anyone
who can't separate red from green.

| Token | Value | Meaning |
| :--- | :--- | :--- |
| `--vote` | `#0b7d88` | The answer this phone voted for |
| `--right` | `#17743c` | The right answer, once revealed |
| `--wrong` | `#d0342c` | **Your own** wrong answer; also the heart |
| `--vote-soft` | `#e0f0f2` | The ground behind your pick |
| `--right-soft` | `#e2f1e8` | The ground behind the right answer |
| `--wrong-soft` | `#fbe8e6` | The ground behind your wrong one |

Red is only ever on the answer *you* chose. Painting every wrong option red
says "all of this was wrong", when the one thing worth seeing is which one
wasn't. Options nobody needs to think about stay neutral.

The soft tints exist because a result has to read as a *share* at a glance,
which a saturated bar under a row cannot do once there are four of them. The
share is the ground the answer sits on.

### Applause

Confetti, not meaning. Eight colours for the hearts on the closing screen: a
phone always uses the same one for its own taps (chosen from its device id),
and hearts arriving from other people take one at random, because the database
sends a count rather than a name. People share colours in any real room, which
is fine — nothing depends on telling them apart.

| Token | Value | | Token | Value |
| :--- | :--- | --- | :--- | :--- |
| `--heart-1` | `#d0342c` | | `--heart-5` | `#0f766e` |
| `--heart-2` | `#c2410c` | | `--heart-6` | `#1d4ed8` |
| `--heart-3` | `#a16207` | | `--heart-7` | `#6d28d9` |
| `--heart-4` | `#15803d` | | `--heart-8` | `#be185d` |

Each is dark enough on white to read as a shape at 1.5–3rem. The big heart
itself stays `--wrong` red — it's the app's own mark on that screen, not
anybody's colour.

### First place

| Token | Light | Dark | Where |
| :--- | :--- | :--- | :--- |
| `--gold` | `#a97f0a` | `#d8b23a` | The winning row's border |
| `--gold-soft` | `#fbf1d8` | `#33290c` | Its ground |
| `--gold-ink` | `#7a5c05` | `#f0d071` | Its place, its cup, its "of" |

A colour, not a metal. A gradient here would be the one piece of chrome in an
interface that has none. `--gold` is darker than gold wants to be because a
border is a shape, and a shape needs 3:1 against the paper behind it — the
first pick measured 2.47:1 and the contrast script refused it.

### On air

| Token | Value | Where |
| :--- | :--- | :--- |
| `--live` | `#e5484d` | The pulsing dot beside the Live badge |
| `--live-glow` | `rgba(229, 72, 77, 0.4)` | The pulse at its widest |
| `--live-fade` | `rgba(229, 72, 77, 0)` | The pulse at its faintest |

Broadcast red, and deliberately not `--wrong`: one says *this is on air*, the
other says *you got this wrong*. The badge is not always Live — it also reads
Connecting, Offline, Refused and every transient the host triggers — so the
light belongs to that one state, not to the badge.

Teal for "your pick" rather than another blue, so it can't be read as the
accent. All four clear 4.5:1 against white **in both directions** — each is
used as text on the card and as a ground under white marks:

| | as text on white | white on it |
| :--- | ---: | ---: |
| `--accent` | 6.70:1 | 6.70:1 |
| `--vote` | 4.88:1 | 4.88:1 |
| `--right` | 5.83:1 | 5.83:1 |
| `--wrong` | 4.99:1 | 4.99:1 |

Flat fills. The bars used a two-stop gradient per state, which is six colours
maintained to express three.

### Icons

Seventeen stroke icons live in `js/icons.js`, drawn there rather than pulled
from a library: five files and no build step is the point of this app, and an
icon font would cost more than the paths do. All 24×24, stroke not fill, so
they take `currentColor` from the text beside them.

A button holds its icon and its label in separate spans:

```html
<button class="btn">
  <span class="btn-icon" data-icon="reset"></span>
  <span class="btn-label">Reset votes</span>
</button>
```

The label lives in its own span because writing `button.textContent` would
otherwise delete the icon along with the old label. `setLabel()` in `host.js`
is the only way a control's text should be changed.

Icon-only buttons — rename, delete, sign out — sit on an `--accent-soft` disc.
A bare glyph doesn't read as something you can press.

### Elevation

| Token | Value |
| :--- | :--- |
| `--shadow-card` | `0 1px 2px rgba(20, 20, 26, 0.04), 0 4px 14px rgba(20, 20, 26, 0.06)` |

The only shadow in the system.

## 3. Type

One family, already set on `body` and inherited everywhere:

```
"Avenir Next", "Avenir", system-ui, -apple-system, "Segoe UI", Roboto,
"Helvetica Neue", Arial, sans-serif
```

Avenir Next is what actually renders on the iPad and iPhone this is used on,
and it is a modern face. Futura and Century Gothic used to lead the stack; they
were the 1960s reference, and they went with it. Below Avenir each platform
gets its own interface face rather than a revival.

### The scale

Six steps, roughly a 1.2 ratio, rounded to whole pixels — half-pixel text
renders soft on a non-retina projector.

| Token | Size | Name | Used by |
| :--- | ---: | :--- | :--- |
| `--text-micro` | 11px | Micro | Status badge, character counts, question numbers |
| `--text-label` | 13px | Label | Field labels, eyebrow, list meta, footer note |
| `--text-body` | 15px | Body | Buttons, tabs, option labels, percentages, messages |
| `--text-lead` | 18px | Lead | Text inputs and textareas, the live question on a phone |
| `--text-title` | 22px | Title | The question on the host's run view |
| `--text-display` | 28px | Display | Reserved — nothing uses it yet |

Nothing outside this table. If something needs a seventh size, the answer is
almost always that it should be one of these six with a different weight.

### Why inputs are `lead` and not `body`

Reading a label and typing into a box are different jobs. Text you are
composing wants to be larger than text you are scanning, and the input is where
a host with imperfect eyesight actually needs the help. It's one rule applied
everywhere, not a host exception.

### Line height

| Context | Value |
| :--- | :--- |
| Headings (`title`, `display`) | 1.2 |
| Body text and messages | 1.45 |
| Inside controls | 1 — height comes from the control, not the text |

### Weight

| Weight | Used for |
| ---: | :--- |
| 400 | Body text, messages, input values |
| 600 | Buttons, tabs, field labels, option labels, the eyebrow |
| 700 | The question, percentages, counts — anything numeric or headline |

Hierarchy comes from weight and colour. It does not come from size alone, and
it never comes from making something uppercase.

### Case

Sentence case everywhere, with exactly two exceptions:

- **The eyebrow** — `HOST CONTROL`, `LIVE POLL`. One or two words, a real
  typographic device, part of the Braun language.
- **The status badge** — `LIVE`, `OFFLINE`. Same reason.

Both keep `letter-spacing: 0.1em`, which uppercase needs to stay legible.

Everything else — buttons, tabs, field labels, option labels — is sentence
case with no letter-spacing. Uppercase strips word shape, which is the main
thing the eye uses to read quickly, and it costs most at small sizes and for
older readers.

---

## 4. Spacing

A 4px base. Seven steps, replacing twenty-four values.

| Token | Value | Typical use |
| :--- | ---: | :--- |
| `--space-1` | 4px | Between a label and its field |
| `--space-2` | 8px | Between buttons in a row; inside a list row |
| `--space-3` | 12px | Between form fields |
| `--space-4` | 16px | Panel padding on a phone; between option rows |
| `--space-5` | 24px | Panel padding on the host; between sections |
| `--space-6` | 32px | Above and below a major divider |
| `--space-7` | 48px | Reserved |

Use `gap` on a flex or grid container. Per-element margins collapse and double
in ways that are hard to see and harder to fix.

---

## 5. Radius

Three, and a rule for which is which.

| Token | Value | Applied to |
| :--- | ---: | :--- |
| `--radius-pill` | 999px | **Anything you press**: buttons, tabs, the badge, the mark |
| `--radius-control` | 12px | **Anything you fill or read**: fields, rows, tiles, cards |
| `--radius-card` | 18px | The panel, sheets, the groups that hold other cards |

**A pill is something you press.** That is the whole rule. A stacked tile in
the run toolbar is not a pill — three lozenges in a row read as three separate
things rather than as one control bar — so tiles take the control radius even
though they are buttons.

Control and card both went up (8 → 12, 14 → 18): 8px on a 44px control reads
as a box with its corners filed off rather than as a shape.

In portrait the panel's radius goes to `0` — it is against the screen edge,
and a rounded corner there would be a corner of nothing.

---

## 6. Controls

### Height

| Token | Value | Applied to |
| :--- | ---: | :--- |
| `--control-h` | 44px | Every button, tab, input, select and icon button |
| `--control-h-lg` | 52px | The audience's vote rows |

44px is Apple's minimum touch target and it is not negotiable — the app is
operated on phones and an iPad. **Set it explicitly.** The old buttons had no
height at all; their height was whatever their padding and font produced, which
is why a button and an icon button next to each other never matched.

For buttons it is a **floor**, not a fixed number: `min-height`, so a label
that outgrows a narrow phone makes its own button taller instead of pushing
out of the card. German is the test — it needs half as many words again as
English for the same button. A short label still measures exactly 44px, so
anything lined up beside an icon button still lines up.

`min-height` is not enough on a `<select>`: a native one is laid out from the
browser's own menulist metrics, and Safari ignores the property entirely, so
the picker sat shorter than the round buttons beside it. Selects take
`appearance: none` and a real `height`, with the chevron drawn back as a
background image — the price of a control that is the same size everywhere.

Padding controls the horizontal only:

| | Padding |
| :--- | :--- |
| Text button | `0 var(--space-4)` |
| Icon button | none — square at `--control-h` |
| Input, select | `0 var(--space-3)` |

The audience vote row is `--control-h-lg` because it is the entire product on
that screen and should feel like it.

### Variants

| Variant | Background | Border | Text | For |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | `--accent` | `--accent` | `--on-accent` | The one action that moves things on. One per screen. |
| **Default** | `--sunken` | transparent | `--ink` | Everything else |
| **Quiet** | transparent | transparent | `--ink` | Icon buttons; `--sunken` on hover |
| **Outline** | transparent | `--accent` | `--accent` | Making a new thing, where a filled button would read as one more control |

A default button's border is transparent rather than absent, so the primary can
take one without changing the height by a hair.

**Setup and Run are a segmented control**, not underlined tabs: with two modes,
the one you are not in should look like somewhere you can go rather than like a
heading. Active is `--accent` filled; inactive is `--surface`.

Exactly one primary button is visible at a time. On the host's run view that's
**Next** — which means **Hide screen**, **Reset votes** and **Start over** are
all default, and the destructive pair sits in its own row below the others.

### States

| State | Treatment |
| :--- | :--- |
| Hover | Background one step lighter. Wrapped in `@media (hover: hover)` — iPad Safari latches `:hover` after a tap. |
| Focus | `outline: 2px solid var(--accent); outline-offset: 2px`. Never removed. |
| Disabled | `opacity: .45; cursor: default`. No colour change. |
| Pressed | No separate style; the state change is the feedback. |

---

## 7. Borders and dividers

A border is a line competing with the content it separates. The stylesheet had
seventeen.

**Group with tone and space first.** A card gets a background one step off the
panel; it does not also get an outline.

Two devices, for two different kinds of thing.

**`.group`** — a hairline box round a compact cluster of controls that do one
job. Containment is what says *these belong together and the next thing
doesn't*, which a gap alone stops saying once several gaps are the same size.

**`.section-title`** — for the long, flowing parts, where a box would be a
border round half a screen. `--text-body`, weight 700, in `--accent`, with a
`--border` rule above. Coloured because a heading here is a landmark to find,
not a line to read.

It was `--text-label` until a heading ended up smaller than the button
underneath it, which is the wrong way round however loud its colour is. **A
heading is never smaller than the text it introduces.**

Every heading that names a section is a `.section-title` — Polls,
Questions, Settings — so three labels doing the same job look the same. A
`.field-label` names one control; it never names a section.

| Part | Device |
| :--- | :--- |
| App bar (mark, QR, sign in/out) | Neither — one row, no box |
| Signed in as… | A quiet line under the tabs, Setup only |
| My polls | `.section-title` |
| Create a new poll / Open an existing poll | Two outline buttons of one size |
| The poll picker | `.overlay--sheet`, one row per poll |
| Which poll is open | Heads **Questions**, name in ink, rest muted |
| Questions | `.section-title` |
| Settings | `.section-title` |
| Run: what the room sees | `.preview` — a framed copy, labelled as a copy |
| Run: count, then Prev / Next | Sticky to the bottom, one rule above it |
| Run: hide, reset, start over | `.toolbar` — equal cells, icon over label |
| Writing a question | `.overlay--sheet` — it takes the screen |
| Footer | A rule of its own |

The box is a hairline on white rather than a fill, so the fields inside keep
their own sunken ground instead of dissolving into it.

`#view-setup` and `#view-run` are flex columns with one `--space-4` gap, so the
parts don't carry their own margins and the rhythm is set in one place.

The tab strip has no rule: the segmented control is already bordered, and a
rule under a bordered control is a line beside a line.

Question rows are `--surface` with a `--border` outline, which is what separates
them from the card they sit on. Fields are `--sunken` with no outline at all —
the fill is what says "type here".

---

### Rows of controls

Two rules, both learned from the same screen looking like an accident:

**A row of things that do the same kind of job is a grid of equal cells**, not
a flex row that hands each one whatever its label needs. Four buttons of four
widths, one of them orphaned onto a second line, reads as something that
happened rather than something that was decided. `grid-auto-flow: column` with
`grid-auto-columns: 1fr` is the whole fix.

**A label that doesn't fit gets shorter, not smaller.** Under an icon in a
70px cell there is room for two short words. The sentence the button really
means goes on `aria-label` and `title`, where it is still said — and still
read out — without being drawn.

---

### Celebrating

Three things, in this order, and none of them under `prefers-reduced-motion`:

1. **The rows arrive from the bottom up**, 90ms apart, so the eye finishes at
   the top of the table — which is where the winner is.
2. **The winner's row bounces once** as it lands, 620ms in.
3. **Confetti** from that row: eighteen squares in the applause palette, the
   same mechanics as a flying heart. Squares because a shape nobody can name
   reads as celebration; anything recognisable reads as another icon.

Everyone who ties for first gets all three. Sharing a win is still winning.

### Two numbers on a row

Where a clock was running, a row carries what you got right *and* how long you
took, and they are deliberately not the same weight: the score is `lead` and
ink, the time is `label` and muted, to its right. They read left to right in
the order they decide the place, and an eye that only wants the winner never
has to take the second one in.

Both are `font-variant-numeric: tabular-nums`. That is what makes a column of
numbers line up instead of wander, and it is the reason the times can be read
down the page as a ranking rather than one at a time.

---

## 8. Motion

| What | Duration | Easing |
| :--- | ---: | :--- |
| A share filling its card | 1000ms | `cubic-bezier(.22, 1, .36, 1)` |
| A screen arriving | 320ms | `cubic-bezier(.22, 1, .36, 1)` |
| The sheet coming up | 280ms | `cubic-bezier(.22, 1, .36, 1)` |
| Colour and background | 250ms | `ease` |
| A card being pressed | 120ms | `ease` |
| The clock draining | 250ms | `linear` |

Shares are slow on purpose: votes arriving should look like something
settling, not a number jumping. The clock is linear because it is measuring
time and anything else would be a lie about it. Everything else is quick
enough not to be noticed.

Every one of them is switched off under `prefers-reduced-motion: reduce`,
including the animations that bring a screen in — a room where someone has
asked for less movement gets none.

---

## 9. Layout

| | |
| :--- | :--- |
| Both frames | `max-width: 640px`, opening to `min(94vw, 900px)` above 760px |
| Panel padding | `--space-4` on phones, `--space-5` above 480px, `--space-6` above 760px |
| Portrait phones | `100dvh` and `env(safe-area-inset-*)` with `viewport-fit=cover` |

### How wide the card gets, and why it stops

**The card grows with the window until a line of text stops being readable,
then it stops.** 640px is the phone measure. Past a tablet it opens to 900,
which is about 75 characters at body size — the width where the eye starts
losing its place on the way back to the left margin. On a 5K display it is
still 900, centred, and the rest is margin.

That is the whole principle, and it cuts both ways: a 640px column marooned in
the middle of an iPad is meanly narrow, and a 1400px-wide question is
unreadable. Neither is "using the screen".

**If there is ever more to show on a big screen, the answer is a second column,
not a longer line.** The projector already works this way — six answers go
two-up, five stay in one column, and the leaderboard never splits at all
because a list read across two columns puts fourth place level with first.

**Neither frame is locked to 16:9, and that's settled.** The stylesheet carried
a `16 / 9` on the base `.frame` that both pages overrode, so it had never
applied to anything; removing it made the code say what was already true.

It is not coming back. The audience reads this on a phone held in portrait —
that is the shape the view is designed for, and a 16:9 letterbox on a tall
narrow screen wastes the room the answers need. Height comes from content on
both pages.

Any column in a grid that holds text needs `min-width: 0`, and any text that
can be pasted needs `overflow-wrap: anywhere`. A `1fr` column will not shrink
below its content otherwise, and one long unbroken string pushes the panel off
screen.

---

### Dark

The same interface with the paper turned down — a palette, not a second
design, which is the whole return on tokenising it in the first place. It
follows the phone (`prefers-color-scheme`) rather than offering a switch: a
room reads this in whatever their phone is already set to, and a toggle is one
more thing to find in the dark.

**Dark separates by ground, not by outline.** A hairline on near-black draws a
box around a thing; a step of lightness *is* the thing sitting on something.
Every card that carries a border in light drops it in dark and lifts instead —
which is the one rule that stops a dark screen looking like a wireframe.

| Token | Light | Dark |
| :--- | :--- | :--- |
| `--bg` | `#f4f2ef` | `#08080b` |
| `--paper` | `#f5f3f0` | `#121218` |
| `--card` | `#ffffff` | `#1e1e26` |
| `--surface` | `#ffffff` | `#22222c` |
| `--sunken` | `#ebe9e5` | `#24242e` |
| `--flat` | `#d3e0fb` | `#2f3a63` |
| `--border` | `#e3e3e6` | `#2c2c35` |
| `--ink` | `#17171a` | `#f2f2f4` |
| `--muted` | `#67676d` | `#a0a0aa` |
| `--accent` | `#1d4ed8` | `#7aa2ff` |
| `--vote` | `#0b7d88` | `#4fd1de` |
| `--right` | `#17743c` | `#58d68d` |
| `--wrong` | `#d0342c` | `#ff7b72` |

The accent and the result colours all lift: a royal blue that reads on white
disappears on black. Both palettes are checked by the same script, and the
dark one clears every pair by a wider margin than the light one.

The wordmark is the single exception — it is an image drawn in ink chosen for
white paper, so it is inverted with a filter. Nothing else in the stylesheet
holds a colour outside a token.

---

## 10. The tokens

Copy this block. It replaces every literal size, gap and radius in the
stylesheet.

```css
:root {
  /* ── Type ───────────────────────────────────────────── */
  --text-micro:   0.6875rem;  /* 11px */
  --text-label:   0.8125rem;  /* 13px */
  --text-body:    0.9375rem;  /* 15px */
  --text-lead:    1.125rem;   /* 18px */
  --text-title:   1.375rem;   /* 22px */
  --text-display: 1.75rem;    /* 28px */

  --leading-tight: 1.2;
  --leading-body:  1.45;
  --leading-flat:  1;

  /* ── Space ──────────────────────────────────────────── */
  --space-1:  0.25rem;   /*  4px */
  --space-2:  0.5rem;    /*  8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.5rem;    /* 24px */
  --space-6:  2rem;      /* 32px */
  --space-7:  3rem;      /* 48px */

  /* ── Shape ──────────────────────────────────────────── */
  --radius-control:  12px;
  --radius-card:     18px;
  --radius-pill:    999px;

  /* ── Controls ───────────────────────────────────────── */
  --control-h:    2.75rem;  /* 44px — the touch minimum */
  --control-h-lg: 3.25rem;  /* 52px — audience vote rows */

  /* Colour tokens: see section 2. */
}
```

There is no second block. `body.host` redefines nothing.

---

## 11. Element map

The implementation contract — every element, and the tokens it takes.

| Element | Size | Weight | Case | Height |
| :--- | :--- | :--- | :--- | :--- |
| Section title | `body` | 700 | sentence | — |
| Status badge | `micro` | 700 | UPPER | — |
| Engaged control (`.btn--on`) | `body` | 600 | sentence | min `control-h` |
| Tab | `body` | 600 | sentence | `control-h` |
| Button | `body` | 600 | sentence | min `control-h` |
| Icon button | `lead` | 400 | — | `control-h` square |
| Icon button in a list | `lead` | 400 | — | 36px square |
| Poll row in the picker | `body` | 600 | sentence | min `control-h` |
| Poll name (run view) | `label` | 600 | sentence | — |
| Field label | `label` | 600 | sentence | — |
| Input, textarea, select | `lead` | 400 | sentence | `control-h` |
| Character count | `micro` | 400 | — | — |
| Question list row | `body` | 600 | sentence | — |
| Question list meta | `label` | 400 | sentence | — |
| Question — host run view | `title` | 700 | sentence | — |
| Question — audience | `lead` | 700 | sentence | — |
| Option label | `body` | 600 | sentence | — |
| Percentage | `body` | 700 | — | — |
| Vote row (audience) | — | — | — | `control-h-lg` |
| Panel message | `body` | 400 | sentence | — |
| Footer note | `label` | 400 | sentence | — |
| Overlay title | `lead` | 700 | sentence | — |
| Closing-screen count | `title` | 700 | — | — |
| Join field | `lead` | 600 | sentence | `control-h-lg` |
| Your own name | `label` | 400, name at 700 | sentence | `control-h` |

Percentages and counts take `font-variant-numeric: tabular-nums` so digits
don't shift as they change.

---

## 12. What this replaced

| | Before | After |
| :--- | ---: | ---: |
| Font sizes | 24 | 6 |
| Spacing values | 24 | 7 |
| Corner radii | 15 | 3 |
| Screen-specific **size** overrides | 46 | 0 |
| Screen-specific **layout** rules | — | 6 |
| Duplicate selectors | 6 | 0 |
| Controls meeting the 44px target | 0 | all |
| Gradients | 4 | 0 |
| Box shadows | 3 heavy, 2 of them inset | 1 |
| Colour literals outside the token block | 15 | 0 |

The six remaining page-scoped rules are arrangement, not sizing: the audience
panel centres its content, its header stacks so the wordmark can be the banner,
and a phone in portrait fills the screen. Where a part is genuinely different
rather than differently sized it gets its own class — `.meter--vote` against
`.meter--static`, `.logo--banner` against `.logo` — so the page class is never
what makes something a different size.

### What each screen actually gains and loses

Unifying on the smaller values is not a straight reduction for the host,
because the audience base was far too small to begin with.

**The host** keeps its button text at 15px — unchanged — and its tabs grow from
14px to 15px inside targets that go from 23px to 44px. Inputs come down from
20px to 18px, the run-view question from ~30px to 22px, and messages from 17px
to 15px. Net: bigger targets, same buttons, slightly smaller reading text.

**The audience** gains across the board. Buttons go from **10px to 15px**,
option labels from 14px to 15px, and the question settles at 18px. The vote
rows become 52px targets.

---

## 13. Installed, not visited

The app ships an icon set, a web manifest and a `theme-color`, so adding it to
a home screen gives a real icon and opens it without browser chrome. It is
half a kilobyte of markup and it is the difference between a tool and a link
someone bookmarked.

| File | What it is |
| :--- | :--- |
| `img/icon.svg` | The mark on a white ground, rounded — tab and any size |
| `img/icon-180.png` | `apple-touch-icon`, what iOS puts on a home screen |
| `img/icon-192/512.png` | The manifest's icons |
| `img/icon-maskable-512.png` | Padded, edge to edge, for platforms that crop |
| `site.webmanifest` | Name, colours, `display: standalone`, portrait |

The icon is the wordmark's own O — the same paths as `img/votr-logo.svg`,
generated from it rather than redrawn, so the two can never drift apart.

---

### A state and an event are not the same badge

The status badge carries the connection: Live, Connecting, Offline. A
confirmation — Saved, Hidden, Reset — **visits** it for 1.8 seconds with a ✓
on a tinted ground, then it goes back to the connection.

The old version wrote confirmations into the badge and left them there, so
"Hidden" sat on screen long after the screen came back. If a thing that
happened and a thing that is still true share one place, the place has to say
which of the two you are looking at, and give the state back.

**A pressed toggle is not the primary action.** `.btn--on` is outlined and
tinted in the accent, never filled: filled is what the one primary action on
a screen looks like, and Hide screen sitting next to Next in the same clothes
read as "press me next".

---

## 14. Nothing touches

A box a hairline away from another box reads as a mistake, and it is the
single most common way a careful screen comes out looking careless. A script
walks every screen in both palettes and flags two things:

- two grounded siblings less than 6px apart
- a bordered box sitting less than 6px inside another bordered box, on a side
  where the parent actually draws an edge

It found the segmented control: each tab sat exactly 1px inside the strip's
own border, at every width, in both palettes. The strip is now a track with a
pill inside it — which is also what it should have looked like.

Run it before shipping a layout change. A false positive is usually a
background doing its job; a real one is always visible once you know to look.

---

## 15. Contrast is checked, not judged

Every pair of colours that ends up as text on a ground is measured by a script
in both palettes — twenty pairs each, forty in all. Text needs 4.5:1; a border
or a dot, being a shape rather than a word, needs 3:1.

It has already earned its keep twice: it caught `--muted` at 4.42:1 inside a
tinted answer card, and it is the reason the dark palette's accent is a
lighter blue than the light one's rather than the same value on a dark ground.

A new colour is not added to this file until it has been through it.

---

## 16. The big screen

`screen.html` is the one page in this app that isn't held in a hand, and it is
the one place the rules above bend. They bend in exactly one direction.

**Everything except size is borrowed.** Colour, radius, borders, the answer
card, the leaderboard row, the confetti, the heart — all of it is the same
component the phones draw, with the same tokens. Nothing on the wall is a
second design of something that already exists.

**Size is the exception, and it is scaled rather than re-chosen.** The type
scale in §3 is built for arm's length: `--text-title` at 22px is right on a
phone and invisible twelve metres away. So this page carries five values of its
own, all of them `clamp(floor, Nvmin, ceiling)`:

| Token | What it sizes |
| :--- | :--- |
| `--big-title` | the question, the headings, "Scan to join" |
| `--big-row` | an answer, a name on the board, a percentage |
| `--big-note` | the strip along the bottom, the poll's name |
| `--big-pad` | the margin around the whole wall |
| `--big-gap` | between anything and the thing under it |

`vmin` and not `vw`: the smaller side of the display is what limits how much
fits, and it makes a 1280×720 projector, a 4:3 boardroom screen and a 4K wall
the same design at three sizes. The floor keeps it legible in a laptop window;
the ceiling stops a 4K display turning the question into three words.

**Nothing can be scrolled to.** The body clips, and nobody in the room has a
mouse — so anything that doesn't fit isn't there. Two rules follow from that:
the leaderboard stops at eight names and counts the rest, and a script measures
every screen at four display shapes, in the language with the longest words, in
both palettes, and fails if a single box falls outside the wall.

**One control, and it apologises for existing.** A screen with nothing to press
has a fullscreen button because someone has to plug the laptop in. It fades out
2.5 seconds after the mouse stops, and it isn't there at all in a browser that
can't do it.

---

## 17. Adding to this

1. **Reach for an existing token first.** Two elements a pixel apart is the
   problem this file exists to stop.
2. **A new value needs a reason in writing.** Add it here with its name and
   what uses it, in the same commit as the CSS.
3. **Never a raw size in a component rule.** `font-size: 15px` is a bug even
   when 15px is right; it's `var(--text-body)`.
4. **Never a screen-specific override.** If the host needs something the
   audience doesn't, that's a different component, not a different size. The
   wall is not a loophole in this: it has its own scale, declared in one place
   and derived from the display, and it borrows every other decision.
5. **Check the target.** Anything a finger touches is `--control-h` or larger.
