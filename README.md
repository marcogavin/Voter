# VOTR

Live audience voting for events. The repository is named `Voter`; the app is
VOTR.

Two screens, no build step, no server to run:

| Page | Who opens it | What it does |
| :--- | :--- | :--- |
| `host.html` | you | write the questions, then put them on screen one at a time |
| `index.html` | the audience | one tap to vote, results appear live |

The host page has two modes, because writing questions and presenting them are
different jobs:

- **Setup** — add, edit, reorder and delete questions before the event. Options
  go in one per line, and a tick list underneath lets you mark one as the right
  answer. Leave it on **No right answer** for opinion questions. Votes already
  cast survive an edit unless you change the options themselves, since a vote
  belongs to a specific option.
- **Run** — one question on screen, live results, and the controls to move
  through the set. Every attendee's phone follows whatever you have up.

Setup also holds the **Language** picker. It applies to the host screen *and*
every attendee's phone, because the room should read one language rather than
each person hunting for a setting. Available in English, Portuguese, Spanish,
French and German.

### Right answers and the reveal step

For a question with a right answer, **Next** does two things in turn: the first
press **reveals the answer** and closes voting, the second moves on. Questions
with no right answer advance on a single press.

Colours carry the result, alongside the tick, ✓ and ✗ so the meaning survives
for anyone who can't separate red from green:

| | |
| :--- | :--- |
| **Blue tick** | the option this phone voted for |
| **Green ✓** | the right answer, once revealed |
| **Red ✗** | the wrong answers, once revealed |

Closing voting is enforced by the security rules, not just hidden in the
interface — a vote arriving after the reveal is rejected by the database.

**Reopen voting** puts the current question back in play, and stepping back with
**Prev** reopens it too. Anyone who already voted still can't vote twice; use
**Reset votes** to clear a question and start it over.

Votes sync through **Firebase Realtime Database**, so every screen updates within
about a second of anyone voting.

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
- an attendee can add their own vote **once**, and can't change it afterwards
- vote counters only move up by one at a time — nobody can set them to 900
- no votes at all once the answer has been revealed
- questions and option labels are writable **only by the device that created
  the event**

Check them with the **Rules Playground** tab before a real event.

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

**Beforehand**, in **Setup**: add each question with its options, one per line.
Reorder with the arrows, fix wording with ✎, remove with ✕.

**On the day:**

1. Open `host.html` and switch to **Run**
2. Share the audience URL — a QR code on a slide works well
3. **Start** puts the first question up; every phone follows within about a second
4. Move through with **Prev** / **Next**
5. **Hide screen** blanks every phone while keeping your place, for talking
   between questions. **Show screen** brings it back
6. **Start over** takes the question down and returns to the top of the set.
   Votes are kept — use **Reset votes** to clear a question's results

**Reset votes** clears the current question only, so you can re-run one without
disturbing the rest.

## Who can host

The host signs in with Google; the first signed-in account to save questions
owns the event. Only that account can write questions, move between them, or
reveal an answer — enforced by the rules, not just hidden in the interface.

Attendees stay anonymous and need no account. An anonymous device can vote and
watch, and can't claim an event even when nobody owns it yet.

To hand the event to a different account, delete the `ownerUid` field under
`events/live` in the console's **Data** tab. The next signed-in account to save
claims it; questions and votes are untouched.

To run a second independent event, change `EVENT_ID` in `js/firebase-config.js`.

## Limits worth knowing

Firebase's free **Spark** plan allows **100 simultaneous connections** — that's
100 phones with the page open at once, which is the number that matters here.
Storage and bandwidth are effectively unlimited for poll-sized data. Spark refuses
extra connections rather than billing you, so there's no surprise-invoice risk.
Larger audiences need the pay-as-you-go Blaze plan.

Anonymous auth identifies a browser, not a person: someone determined can vote
again from a private tab. Fine for a friendly audience, not a ballot box.

## How it's put together

```
index.html → js/app.js  ─┐
                         ├→ js/sync.js → Firebase
host.html  → js/host.js ─┘
```

`js/sync.js` is the only file that knows Firebase exists, so swapping the backend
later means changing one file.
