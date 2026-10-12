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

## 8. Video on text slides — a YouTube or Vimeo link first

Added 11 October; the starting point agreed the same day. Paste a YouTube or
Vimeo link into a text slide and the wall plays it by itself, beside or
instead of the slide's words.

A link and not an upload, to begin with: nothing to store, no storage costs,
no storage rules, and nothing for Undo to have to bring back but the link.
The video lives where it already lives. The catches are the provider's, and
worth knowing before a room depends on them: browsers only let a video start
by itself when it is muted, so the wall starts it silent and the host turns
the sound on; it needs internet at the venue; and the provider decides what
plays before and around it. Phones show the slide's words and a still, never
the video — nobody's mobile data should pay for what the wall is already
showing.

Uploaded pictures and video come after this, if they're wanted at all, and
belong with item 2's one-account-per-event: that is where storage, its rules
and its costs would live.

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

## 10. Keeping a poll yours: move, copy, lock, and a sample that can't be lost

Added 12 October, after someone who was meant to make their own poll added
their questions to the end of the demo poll instead. Untangling it meant
exporting the demo from the Firebase console, deleting it, and rebuilding it
by hand, because nothing in the app can move a question.

- **Move or copy questions to another poll.** Pick one or more questions and
  send them to another of your polls, with every choice, the right answer and
  the order kept. Moving would have fixed this on its own.
- **A built-in sample poll.** The demo comes from the code, not the database,
  so nobody can edit it or delete it by accident. Anyone can start from a
  copy of it.
- **Lock a poll.** It stays read-only until its owner unlocks it, so nobody
  can add, edit, reorder or delete questions in it, the owner included.
  It can still be run.

---

## Not doing

- **A handwritten font for the tour.** Considered 20 August, dropped: the
  legibility cost is real, the tour is already unmistakable, and it does not
  pay for itself.
