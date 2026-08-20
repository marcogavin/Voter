# VOTR

Live audience voting for events. The repository is named `Voter`; the app is
VOTR.

Three screens, no build step, no server to run:

| Page | Who opens it | What it does |
| :--- | :--- | :--- |
| `host.html` | you | write the questions, then put them on screen one at a time |
| `index.html` | the audience | one tap to vote, results appear live |
| `screen.html` | the projector | the room's shared view: the question, the scores, and the way in |

The host page has two modes, because writing questions and presenting them are
different jobs:

- **Setup** — add, edit, reorder and delete questions before the event. Options
  go in one per line, and a tick list underneath lets you mark one as the right
  answer. Leave it on **No right answer** for opinion questions. Votes already
  cast survive an edit unless you change the options themselves, since a vote
  belongs to a specific option.
- **Run** — one question on screen, live results, and the controls to move
  through the poll. Every attendee's phone follows whatever you have up.

### Names

Attendees give a name before they see the first question. It sits at the top of
their own screen, they can tap it to correct a typo, and it is what will put
them on a leaderboard.

**It is not private.** Names are stored on the event and readable by every
device in the room — that is what a shared leaderboard requires. The app shows
each person only their own, but it cannot keep a name secret from someone
determined to look. Don't ask for one at a meeting where the answers are
supposed to be anonymous.

### Polls

Questions are kept in named **polls**, so a set written for one talk stays
intact when you write the next. **My polls** at the top of Setup has two
doors of the same size — **Create a new poll** and **Open an existing poll** —
and the line under them says which one you have open. Up to 20.

The **Questions** heading carries the name of whichever poll is open, so what
you are editing is never in doubt.

Opening one lists every poll with what you need to tell them apart later:
how many questions it holds, and when it last faced a room (or when you made
it, if it never has). Renaming and deleting live in that list, beside the poll
they act on.

One poll is live at a time — the one named in the picker is both the one you
edit and the one the room sees, and Run shows its name above the question. That
means switching poll switches what's on screen, so it asks first if a question
is up.

Each poll keeps its own votes. Running one doesn't disturb the results of
another, and deleting a poll deletes its votes with it.

Questions written before polls existed become your first poll automatically,
with their votes. Nothing needs moving by hand.

Setup also holds the **Language** and **Time limit** pickers. Both belong to the
event as a whole rather than to a poll or a device: the language applies to the host screen *and*
every attendee's phone, because the room should read one language rather than
each person hunting for a setting. Available in English, Portuguese, Spanish,
French and German.

### What the room sees

With nothing on screen, Run shows you the audience's own waiting screen
rather than an empty space — the presenter shouldn't be the one person in the
building who doesn't know what's on the phones.

### The big screen

`screen.html` is the room's shared view, for a projector, a TV, or the second
monitor. Open it from the screen icon in the host's top bar — it opens in its
own tab, so you can drag that one onto the projector and keep the host page in
your hand. There is a fullscreen control in its top corner that fades away when
you stop moving the mouse, and the page asks the browser to keep the display
awake.

It only ever **reads**. There is nothing to tap and no way to drive the poll
from it, so a laptop can sit plugged into the projector all day, and the
projector never turns up on the leaderboard as somebody who answered nothing.

What it shows follows the host, one screen behind nobody:

- **Nothing on screen** — a join code the size of a door, the address under it,
  and how many people are already in. This is also what it shows while you have
  the screen hidden: a blank wall is a wasted wall.
- **A question** — the question, the answers lettered A, B, C, the clock, and
  how many votes are in. The join code shrinks into the corner so latecomers
  still have something to scan.
- **The scores and the applause** — the same leaderboard and the same heart the
  phones show, at the size of the room.

**Shares are held back on a question that has a right answer** until you
reveal, or until the clock runs out. On a wall in front of everyone, a bar that
fills as the votes land is a quiz being copied. An opinion question has nothing
to copy and watching it move is most of the point, so that one counts live.

The leaderboard is drawn and then measured against the display, keeping as many
places as fit and counting the rest underneath — eight or nine on a 720p
projector, more on a bigger one. It is always **one column**: a list read across
two puts fourth place level with first and reads as two separate tables.

### Scores

A poll with at least one right answer in it ends on a **leaderboard**: who
answered, how many they got right, best first. The winner's row is gold, wears
a cup and gets a burst of confetti; your own row is marked so you don't have to
hunt for your name.

It is worked out from what is already stored — who answered what, which answer
was right, and the name each device gave — so it is right for polls that were
run before this existed, and it can't disagree with the votes it is counting.

**Right answers decide it; the clock separates people level on them.** Where a
time limit is set, every vote records how long it took and the board shows the
total beside the score:

```
🏆  1  Marco    2/2   12.9s
    2  Ana      2/2   14.3s
    3  Dee      2/2   45.5s
    4  Bo       1/2   13.8s     ← fast, but a right answer short
```

Only questions with a right answer count towards either number: an opinion
question isn't something anyone can be quick at. **A question you sat out costs
the full time limit**, so skipping is never a way to post a faster time — and
neither is a vote that arrived without a time, which costs the same.

With no time limit set there is no clock at all: the board is right answers
alone, people level on them share a place, and the next place skips — two on 5
are both second, and the next is fourth.

Somebody who never answered isn't listed. Being in the room isn't a score.

**A poll with no right answers has no leaderboard** — it would be a table of
zeroes — so an opinion poll goes from its last question straight to the heart.

The time is measured against the server's clock rather than each phone's, so a
device whose clock is wrong doesn't win. It is still a number a phone reports,
which is the same trust the vote itself gets: right for a friendly quiz, not a
stopwatch anyone should bet on.

### The end of a poll

Past the last question every phone shows **Like VOTR?** and a heart. It takes
as many taps as anyone wants to give it — there's nothing to win, so there's
nothing to protect against — and the count is kept with the poll.

A tap sends a heart up on **every** screen in the room, including the host's,
so the applause is shared rather than private. Your own hearts always fly in
the same colour; hearts from other people take one of eight at random, since
the database sends a count and not a name. Anyone who has asked for reduced
motion gets the count without the animation.

### Joining late

Anyone can join at any point, including halfway through. They give a name, land
on whatever is on screen, and vote on it if voting is still open — which is why
the projector keeps a join code in the corner while a question is up.

They are scored like everybody else, over every question that had a right
answer. The ones they weren't there for count as unanswered: no points, and the
full time limit each. A latecomer can't win, and can't be beaten by somebody
who joins at the last question and answers one thing quickly.

### The clock

A question accepts votes for a set number of seconds, then closes itself. You
can always close sooner — revealing the answer or moving on does it — but a
question can't be left open while the room moves on without you.

The length is the **Time limit** picker in Setup: ten seconds up to two minutes,
or **No time limit**, which leaves a question open until you close it. It
changes live, including on the question already up, and every phone follows.

The countdown appears on every phone and beside the counter on the host screen,
and turns red for the last five seconds. It's timed from the server's clock
rather than each phone's, so everyone counts the same seconds from the same
instant however wrong their own clock is.

**Reopen voting** restarts the clock rather than resuming a spent one.

A quiz question and an opinion question want different clocks; the limit is one
setting for the whole event, so change it between the two rather than expecting
each question to remember its own.

The starting value for an event that has never had one set lives in
`DEFAULT_SECONDS` in [`js/firebase-config.js`](js/firebase-config.js), alongside
`SECONDS_CHOICES` — the list the picker offers.

### Right answers and the reveal step

For a question with a right answer, **Next** does two things in turn: the first
press **reveals the answer** and closes voting, the second moves on. Questions
with no right answer advance on a single press.

Each answer is a card, and its share of the vote is the ground it sits on.
Colour carries the result alongside a mark, so it survives for anyone who
can't separate red from green:

| | |
| :--- | :--- |
| **Teal ✓** | the answer this phone voted for |
| **Green ✓** | the right answer, once revealed |
| **Red ✗** | **your own** wrong answer |

Options nobody picked stay neutral. Marking every wrong answer red says "all
of this was wrong" — the one thing worth seeing is which one wasn't.

Closing voting is enforced by the security rules, not just hidden in the
interface — a vote arriving after the reveal is rejected by the database.

**Reopen voting** puts the current question back in play, and stepping back with
**Prev** reopens it too. Anyone who already voted still can't vote twice; use
**Reset this question's votes** to clear it and start it over.

Votes sync through **Firebase Realtime Database**, so every screen updates within
about a second of anyone voting.

### The badges

On a phone, **LIVE** means *your vote would count right now* — a question is
up, the clock is running and you haven't answered yet. It goes as soon as any
of that stops being true, so an empty corner means there is nothing to do.
Anything wrong with the connection outranks it and says so.

On the host, the badge is the connection, and a confirmation — Saved, Hidden,
Reset — borrows it for a second and a half with a ✓ before handing it back.
It used to keep the last one on screen indefinitely, which made a thing that
happened look like a thing that was still true.

### Add it to a home screen

Both pages ship an icon, a manifest and a theme colour, so **Add to Home
Screen** gives a real icon and opens without browser chrome — the audience
page as a voting app, the host page as a remote. There is no reload button in
that mode, which is what the freshness check inside each page is for.

The interface follows the phone's **light or dark** setting. There's no switch:
a room reads this in whatever their phone is already set to. Light is white
cards on warm paper; dark separates the same cards by lifting them off the
panel rather than by drawing a line around each one.

## Setup

Done once, all of it from a browser (an iPad works fine).

### 1. Create the Firebase project

1. Go to [firebase.google.com](https://firebase.google.com) and create a free project
2. In the left sidebar: **Build → Realtime Database → Create Database**
3. When asked, choose **Locked mode**. The rules in this repo replace the defaults
   — do *not* pick test mode, which leaves the database open to anyone who finds
   the URL
4. **Build → Authentication → Get started → Anonymous → Enable.** This silently
   gives each device an id, with no login screen, so one-vote-per-device can
   actually be enforced

### 2. Paste your config

**Project settings** (gear icon) → **Your apps** → add a **Web app** if there
isn't one → copy the `firebaseConfig` object → paste the values into
[`js/firebase-config.js`](js/firebase-config.js).

That config is not a password. It identifies the project; it does not grant access
to it. Every Firebase web app ships it publicly — access is controlled by the rules
in the next step.

### 3. Publish the security rules

In the console: **Realtime Database → Rules**, paste the contents of
[`database.rules.json`](database.rules.json), and publish.

They enforce:

- only signed-in devices (including anonymous ones) can read an event
- a device can write **its own** name and nobody else's
- an attendee can add their own vote **once**, and can't change it afterwards
- and the same for how long they took: written once, never edited
- vote counters only move up by one at a time — nobody can set them to 900
- no votes at all once the answer has been revealed
- polls, questions and option labels are writable **only by the account that
  owns the event**

Check them with the **Rules Playground** tab before a real event.

**Republish them whenever this file changes.** The copy in the repository is
documentation; the console is what actually enforces anything. A vote is one
atomic write, so a rule the console hasn't seen yet can refuse the whole thing
— which is why the app retries a timed vote without its time rather than
letting the vote fail. Until the rules below are published, the poll runs
exactly as it did, just with no clock on the leaderboard.

### 4. Turn on GitHub Pages

**Repo Settings → Pages → Deploy from branch → `main`.**

This is required, not optional: the app loads Firebase as an ES module, which
browsers refuse to do over `file://`. It also gives you the URL attendees open on
their phones.

Your pages will be at:

```
https://<username>.github.io/Voter/          ← audience
https://<username>.github.io/Voter/host.html ← you
```

## Running an event

**Beforehand**, in **Setup**: open or create the poll, then **Add question** —
the form takes the screen while you write and gives it back after. Reorder
with the arrows, fix wording with ✎, remove with ✕.

**On the day:**

1. Open `host.html`, check the poll named under **My polls**, and switch to
   **Run**
2. Share the audience URL — the **QR code** button puts it on screen, with
   **Copy image** for a slide and **Copy link** for a message. If there's a
   projector, open the **big screen** (the screen icon beside it) in its own
   tab and put that on the wall: it shows the same code the size of a door
   until the first question goes up
3. **Start** puts the first question up; every phone follows within about a second
4. Move through with **Prev** / **Next**. Past the last question comes the
   leaderboard, and then the heart
5. **Hide screen** blanks every phone while keeping your place, for talking
   between questions — and **stops the clock**. Take a question from the
   floor, then **Show screen** and the room gets back the seconds it had
6. **Start over** clears every answer in the poll and returns to the top, with
   nothing on screen — so the room doesn't get question 1 before you're ready.
   One press of **Start** begins the run

**Start over** clears the hearts along with the votes, and the question it
asks says so — a room arriving to find the last room's applause already on the
board isn't being asked anything. It asks only when there is something to
lose: a poll nobody has answered yet just goes back to the top. **Reset this question's
votes** clears the one on screen and nothing else, for re-running a single
question without disturbing the rest.

## What attendees can see

The host page shows nothing but the sign-in prompt until a Google account signs
in. That's tidiness, not secrecy — and the difference matters.

The big screen is the exception, deliberately: it is meant to be looked at by
everyone, it signs in anonymously like an attendee's phone, and it can't write
anything at all.

**The questions are readable by anyone in the room.** The rules let any
signed-in device, including an anonymous attendee, read the whole event. That
is what lets a phone show the question it is voting on, and it means a
determined attendee who opens `host.html` could read the questions — and which
answer is marked right — before they are asked.

For a friendly quiz that's fine. For one with a prize, it isn't. Closing it
would mean dropping the blanket read at the event and granting reads
branch-by-branch, so `correct` stays hidden until the answer is revealed — a
real change to both the rules and how `sync.js` listens, not a setting.

## Who can host

The host signs in with Google; the first signed-in account to save questions
owns the event. Only that account can write questions, move between them, or
reveal an answer — enforced by the rules, not just hidden in the interface.

Attendees stay anonymous and need no account. An anonymous device can vote and
watch, and can't claim an event even when nobody owns it yet.

To hand the event to a different account, delete the `ownerUid` field under
`events/live` in the console's **Data** tab. The next signed-in account to save
claims it; questions and votes are untouched.

For a second set of questions, add a poll rather than a second event. Change
`EVENT_ID` in `js/firebase-config.js` only to run two rooms *at the same time* —
separate audiences, separate URLs, voting simultaneously.

## If a control stops responding

Pages and scripts are cached separately, so a browser can serve a freshly
deployed page against a script it already had — the new controls appear and
quietly do nothing. Both pages check for this a moment after loading, fetch
past the cache once and reload themselves. If that doesn't help, a red bar
appears saying so rather than leaving you guessing; GitHub Pages caches assets
for ten minutes, so it clears on its own.

When adding a feature that changes the markup, add its name to `VOTR_BUILD` in
`js/host.js`, `js/app.js` or `js/screen.js` and to `NEEDS` in the matching
page. That's what makes an old script detectable.

## Limits worth knowing

Firebase's free **Spark** plan allows **100 simultaneous connections** — that's
100 phones with the page open at once, which is the number that matters here.
Storage and bandwidth are effectively unlimited for poll-sized data. Spark refuses
extra connections rather than billing you, so there's no surprise-invoice risk.
Larger audiences need the pay-as-you-go Blaze plan.

Anonymous auth identifies a browser, not a person: someone determined can vote
again from a private tab. Fine for a friendly audience, not a ballot box.

## Design

Sizes, spacing, control heights and the rules behind them live in
[`DESIGN.md`](DESIGN.md). One scale covers the phone screens — there is no host
variant and no audience variant. The big screen is the one page with a scale of
its own, and only because a size meant for arm's length can't survive being
twelve metres away.

The card grows with the window up to 900px — around 75 characters, where a line
stops being comfortable to read — and then stops, so a wide display gets margin
rather than a wider sentence. Where there is genuinely more to show, the answer
is a second column: the projector puts six answers two-up and keeps five in one,
and never splits the leaderboard at all. A value that isn't in that file doesn't go in
the stylesheet.

## How it's put together

```
index.html  → js/app.js    ─┐
host.html   → js/host.js   ─┼→ js/sync.js → Firebase
screen.html → js/screen.js ─┘
```

`js/sync.js` is the only file that knows Firebase exists, so swapping the backend
later means changing one file.

Which screen an index lands on — question, scores, applause — is decided in
`js/scores.js` and read by all three pages, so the wall, the phones and the
host step through a poll together and none of them owns the rule.
