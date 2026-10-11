# What's next

Agreed 20 August 2026. In this order, and roughly one session each — a fresh
session per item costs less than one long one, and `CLAUDE.md` is what makes
starting one cheap.

---

## 1. Read the code properly: efficiency, then security

Two jobs that got put in one box. Do them as two.

**The flicker first.** Screens sometimes show one thing for a frame and then
another — signed-out chrome before auth settles, a screen drawn before the
first snapshot lands. It is almost certainly the same family as the three
bugs in `CLAUDE.md` point 3, and it is findable with a slow-motion recording
and a browser.

**Then the security review.** There is one real hole today and it is worth
being plain about it: **any signed-in device can read the whole event**,
questions and correct answers included, before they are asked. That is what
lets a phone show the question it is voting on — the same blanket read gives
away the answer key. It is not fixed by making the database private, and it
is not fixed by approving who may sign in: the people who can read ahead are
the people you invited. It needs reads granted branch by branch, so the
audience sees the current question and sees `correct` only once it is
revealed. Rules *and* how `js/sync.js` listens.

Also worth a pass: `/security-review` on the diff, and the fact that names are
readable by everyone in the room (which the leaderboard requires, and which
the README already says out loud).

## 2. Real hosting, and one account per event

Bigger than "move off GitHub Pages".

Today the whole app is one event at a fixed `EVENT_ID`, and ownership is a
single `ownerUid` field. Multi-tenant means events keyed per account, rules
that scope every read and write to their owner, somewhere to name and find
your own events, and a join link that carries the event id. `js/sync.js` is
the only file that knows the shape, which is the seam this needs.

Firebase Hosting gives a domain and a cache policy you control — which would
have prevented two of this week's round trips on its own.

Treat "your data is yours" as part of this item, not a follow-up to it.

## 3. Questions generated from a document

Upload a deck or a PDF, get a set of draft questions.

The most valuable thing on this list, because it removes the actual work of
using VOTR. It needs a small backend: the model call costs money per use and
the key cannot live in a page anybody can read, so it needs an endpoint —
which is also where it gets rate-limited so one upload cannot run up a bill.

Two rules for it: the questions are **drafts** — the flow is "here are eight,
keep five, edit two" — and the uploaded file is **not kept** after they are
drafted. What you never store, you can never leak. T&Cs to match.

## 4. More kinds of question

Star ratings are cheap: a scale is a poll with numbered options and a mean.

Word clouds are a different animal, because free text means moderation. The
thing that protects you is not the filter, it is the **hold**: words reach the
projector only after the host lets them through. Build the hold first, then a
generated word list as a second line. Live lookups against a public list are a
per-word HTTP call in the hot path of a wall everybody is watching — no.

## 5. More game, and knowing how it is used

Two halves, and they are not the same size.

**The fun half, early**: places moving on the leaderboard, applause during a
poll and not only at the end, somewhere to say what you think of the app. The
machinery for all of it already exists.

**The money and the measuring, later**: donations mean a payment processor and
the obligations that come with it. Usage statistics need a written line about
what is counted before any of it is — events run and votes cast are fine;
counting people is where it stops being fine.

Monetising is last on purpose. Charging for something changes what "it broke
at an event" costs you, and item 2 has to have been quiet for a while first.

## 6. Each attendee in their own language

Added 11 October. Every phone picks its own language, and the questions,
answers and text slides arrive translated for that phone alone.

Two halves, and the first is nearly free. The app's own words are already in
five languages; letting a phone choose one instead of following the event is
a small change — though it reverses a deliberate rule (`CLAUDE.md`, point 5),
so the wall and the host keep the event's language.

The second half is translating what the host wrote, and that is a
machine-translation call — so the same backend item 3 needs, for the same
reasons: a key that can't live in a page, and a cost per use. Translate once
per question per language when it is saved, store the result, and let the
host see and correct it before it reaches a room. Votes stay on the option
ids, so a right answer is right in every language.

## 7. Basic formatting on text slides

Added 11 October. Bold, italics, and a bulleted list — and stop there, or the
text slide turns into the editor it was designed not to be. A tiny markup
(`**bold**`, `*italic*`, a line starting with `- `) rendered by the page, never
as raw HTML, so nothing typed can run as code on the wall. The auto-fit keeps
working: it measures whatever is drawn.

## 8. Pictures and video on text slides

Added 11 October. An image, or a video that plays by itself, on a slide.

Needs somewhere to keep the files — storage with its own rules and size
limits, which belongs with item 2's one-account-per-event. Browsers only let a
video play by itself when it is muted, so the wall starts it silent and the
host turns the sound on. Phones should not download a large video over
mobile data to show the same thing the wall is showing: on a phone, a still
and the caption. A YouTube or Vimeo link would avoid storing video at all.

## 9. A day / night toggle

Added 11 October. A sun-and-moon switch at the top right of each page.

The smallest item here. The night palette already exists — every colour has
a dark value, measured by the contrast suite — and today it follows the
device's own setting. The toggle overrides that: three states (follow the
device, day, night), remembered per browser, never per event, since one
person's dark room is not the next person's. Each page already has a top
right that is spoken for — the phone's name, the host's icons, the wall's
full-screen button — so it sits beside those rather than in place of them.
On the wall it is for whoever sets the room up, and fades with the mouse
like the full-screen button does.

---

## Not doing

- **A handwritten font for the tour.** Considered 20 August, dropped: the
  legibility cost is real, the tour is already unmistakable, and it does not
  pay for itself.
