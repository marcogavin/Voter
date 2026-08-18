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

**The 1960s Braun direction stays.** The bezel, the cream panel, the inset
shadows, the meters with their needles and ticked tracks, the terracotta — all
of it is deliberate and stays as it is. Nothing in this document changes a
colour or removes the frame.

What changes is only the system underneath: sizes, spacing, and the shape of
the controls. The look is the same look, drawn consistently.

Revisiting the direction is a separate decision, taken separately.

---

## 2. Colour

Unchanged. Documented here so the set is visible in one place.

### Surfaces

| Token | Value | Where |
| :--- | :--- | :--- |
| `--room` | `#201e1b` | The dark ground behind the frame |
| `--room-edge` | `#0f0e0c` | Outer edge of that ground's gradient |
| `--bezel-hi` | `#d9d6ce` | Bezel highlight; also the ground for controls |
| `--bezel-lo` | `#aeaba3` | Bezel shadow; the unfilled meter track |
| `--panel` | `#ece9e2` | The cream panel everything sits on |
| `--panel-shadow` | `rgba(0,0,0,.28)` | The panel's inset shadow |
| `--hairline` | `#cfccc3` | Every divider and control border |

### Ink

| Token | Value | Where |
| :--- | :--- | :--- |
| `--ink` | `#2b2924` | All primary text |
| `--muted` | `#8a8579` | Labels, meta, disabled, percentages |

### Accent

| Token | Value | Where |
| :--- | :--- | :--- |
| `--accent` | `#c1481f` | Primary buttons, active tab, status badge, focus ring |
| `--accent-glow` | `rgba(193,72,31,.35)` | Focus halo |

### Result colours

Never the only signal. The tick box, ✓ and ✗ carry the same meaning for anyone
who can't separate red from green.

| Token | Value | Meaning |
| :--- | :--- | :--- |
| `--vote` / `--vote-deep` | `#2f6690` / `#244f6f` | The option this phone voted for |
| `--right` / `--right-deep` | `#3d7a4e` / `#2e6040` | The right answer, once revealed |
| `--wrong` / `--wrong-deep` | `#a3312a` / `#82241f` | Wrong answers, once revealed |

Each pair is a gradient: `--*-deep` on the left of a bar, `--*` on the right.

---

## 3. Type

One family, already set on `body` and inherited everywhere:

```
"Futura", "Century Gothic", "Avenir Next", "Avenir", sans-serif
```

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

The frame is outside the scales on purpose — it's a physical object, not a
control or a piece of type — but its dimensions are still named:

| Token | Value | Portrait phone |
| :--- | ---: | ---: |
| `--frame-pad` | 14px | 9px |
| `--frame-radius` | 20px | 22px |

The bezel thins in portrait to give the content its width back. Redefining the
two tokens on the page is the whole of that change.

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
| **Primary** | `--accent` | `--accent` | `--panel` | The one action that moves things on. One per screen. |
| **Default** | `--bezel-hi` | `--hairline` | `--ink` | Everything else |
| **Quiet** | transparent | `--hairline` | `--ink` | Icon buttons |

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

Keep a `--hairline` divider in only three places:

1. Above the footer
2. Between the question list and the event settings
3. Under the tab strip

Controls keep their 1px border — that is what makes them read as controls.

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

Neither frame is locked to 16:9. The stylesheet carried a `16 / 9` on the base
`.frame` that both pages then overrode, so it had never applied to anything;
implementing this system removed it. Restoring it for the audience view on a
wide screen — the projector case from the original brief — is a live question,
not a decision this document has taken.

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

  /* ── The faceplate ──────────────────────────────────── */
  --frame-pad:    14px;
  --frame-radius: 20px;

  /* Colour tokens are unchanged; see section 2. */
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
| Survey name (run view) | `label` | 600 | sentence | — |
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

Percentages and counts take `font-variant-numeric: tabular-nums` so digits
don't shift as they change.

---

## 12. What this replaces

| | Before | After |
| :--- | ---: | ---: |
| Font sizes | 24 | 6 |
| Spacing values | 24 | 7 |
| Corner radii | 15 | 3 |
| Screen-specific **size** overrides | 46 | 0 |
| Screen-specific **layout** rules | — | 6 |
| Duplicate selectors | 6 | 0 |
| Controls meeting the 44px target | 0 | all |

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
