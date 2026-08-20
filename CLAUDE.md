# Working on VOTR

Live audience voting. Three pages, no build step, no framework, no npm in the
app itself. Read this before changing anything; it is the short version of
things that have already cost a round trip at least once.

## Run the tests first

```sh
cd test && npm install && npx playwright install chromium && npm test
```

Twenty-four suites, about 380 assertions. They run against the files that
ship, not against copies. If they are not green before you start, find out
why before you write anything.

## The shape

```
index.html  → js/app.js     the audience: one tap to vote
host.html   → js/host.js    write questions, then run them
screen.html → js/screen.js  the projector: what the room looks at
                ↘ js/sync.js → Firebase
```

`js/sync.js` is the **only** file that knows Firebase exists. Everything else
asks it. Keep it that way — it is what makes the tests possible and what makes
a backend change a one-file change.

`js/scores.js` decides which screen an index lands on (`screenAt`). All three
pages read it, so none of them owns the rule and none of them can disagree.

## Five things that have bitten before

1. **The rules file is documentation; the console is what enforces.**
   `database.rules.json` in the repo does nothing until it is republished by
   hand in the Firebase console. A write to a field the console has not seen
   is refused — and because a vote is one atomic write, an unpublished rule
   can refuse the *whole* vote. Anything new that rides along with a vote
   must be written separately, or retried without it.

2. **A change nobody declared is a change nobody can see.** Pages and scripts
   are cached separately; each page checks that the script and stylesheet it
   was served can do what it expects, by name. Ship a visible change without
   adding a word to `VOTR_BUILD` and `NEEDS`, and a stale browser shows the
   old app with no way to notice. The `fresh` suite checks the contract is
   consistent; it cannot check that you remembered.

3. **A screen that says what it wants inherits what it doesn't.** Three
   separate bugs have been exactly this: a countdown bar left on the
   leaderboard, a badge holding the last action, a status line holding the
   last message. Every screen should state its whole state, not the part that
   changed. See `resting()` in `js/app.js`.

4. **Assert on what is visible.** Two tests have passed by reading a hidden
   element, and one by reading a heading the previous screen had left behind.
   `hidden`, `offsetParent` and a rectangle are the difference between testing
   the page and testing the DOM.

5. **Five languages, always.** `js/i18n.js` holds every string in en, pt, es,
   fr and de, in the same order. The language belongs to the event, not to a
   device — the host picks it and every phone follows. The changelog in
   `js/changes.js` is the one deliberate exception, and says so.

## Shipping something

In the same commit as any change somebody can see:

- a line in **`js/changes.js`**, written the way a person would say it, and a
  version bump at the top
- a word in **`VOTR_BUILD`** and **`NEEDS`** if the markup changed
- a **suite**, or an assertion in an existing one — and break it on purpose
  once to watch it catch the thing

## Design

`DESIGN.md` is the contract: sizes, spacing, radii and control heights come
from tokens and from nowhere else. A literal in a component rule is a bug even
when the number is right. Contrast is measured by a script, not judged.

## What we are doing next

`ROADMAP.md`. Work through it in order; each item is a session of its own.
