# VOTR design system

One scale for everything. Both screens — the host's control panel and the
audience's phone — use the same type sizes, the same spacing, the same control
heights. There is no host variant and no audience variant.

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
| `--muted` | `#6c6c72` | Labels, meta, disabled, percentages |

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
| `--wrong` | `#d0342c` | Wrong answers, once revealed; also the heart |

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

Three, plus a hairline.

| Token | Value | Applied to |
| :--- | ---: | :--- |
| `--radius-control` | 8px | Buttons, inputs, selects, list rows |
| `--radius-card` | 14px | The panel, overlay cards, the frame's inner edge |
| `--radius-pill` | 999px | The tick box, the status badge |
| — | 1px | The meter needle only. A hairline, not a corner. |

There is no fourth. The bezel had its own padding and radius; both went with
it. In portrait the card's radius goes to `0` — it is against the screen edge,
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
border round half a screen. `--text-label`, weight 700, in `--accent`, with a
`--border` rule above. Coloured because a heading here is a landmark to find,
not a line to read.

Every heading that names a section is a `.section-title` — Polls,
Questions, Settings — so three labels doing the same job look the same. A
`.field-label` names one control; it never names a section.

| Part | Device |
| :--- | :--- |
| Account | `.group` |
| Polls | `.section-title`, then the button and a `.group` |
| Create a new poll | Neither — an outline button, distinct by treatment |
| Or pick an existing poll | `.field-label` inside that `.group` |
| Questions | `.section-title` |
| Settings | `.section-title` |
| Run: Prev / counter / Next | `.group` |
| Run: hide, reset, start over | `.group` |
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

## 8. Motion

| What | Duration | Easing |
| :--- | ---: | :--- |
| Meter fill and needle | 1400ms | `cubic-bezier(.22, 1, .36, 1)` |
| Colour and background | 250ms | `ease` |
| Overlay appearing | 150ms | `ease-out` |

The meters are slow on purpose: votes arriving should look like a needle
settling, not a bar jumping. Everything else is quick enough not to be noticed.

All of it sits behind `@media (prefers-reduced-motion: no-preference)`.

---

## 9. Layout

| | |
| :--- | :--- |
| Both frames | `max-width: 640px`, height from content |
| Panel padding | `--space-4` on phones, `--space-5` above 480px |
| Portrait phones | `100dvh` and `env(safe-area-inset-*)` with `viewport-fit=cover` |

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
  --radius-control: 8px;
  --radius-card:   14px;
  --radius-pill:  999px;

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
| Eyebrow | `label` | 600 | UPPER | — |
| Status badge | `micro` | 700 | UPPER | — |
| Tab | `body` | 600 | sentence | `control-h` |
| Button | `body` | 600 | sentence | `control-h` |
| Icon button | `lead` | 400 | — | `control-h` square |
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

## 13. Adding to this

1. **Reach for an existing token first.** Two elements a pixel apart is the
   problem this file exists to stop.
2. **A new value needs a reason in writing.** Add it here with its name and
   what uses it, in the same commit as the CSS.
3. **Never a raw size in a component rule.** `font-size: 15px` is a bug even
   when 15px is right; it's `var(--text-body)`.
4. **Never a screen-specific override.** If the host needs something the
   audience doesn't, that's a different component, not a different size.
5. **Check the target.** Anything a finger touches is `--control-h` or larger.
