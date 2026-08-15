# Voter

Application that allows audience live votes, Q&A and participation during an event.

Two screens, no build step, no server to run:

| Page | Who opens it | What it does |
| :--- | :--- | :--- |
| `host.html` | you | write the question, watch results, reset between rounds |
| `index.html` | the audience | one tap to vote, results appear live |

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

- only signed-in devices (including anonymous ones) can read a poll
- an attendee can add their own vote **once**, and can't change it afterwards
- vote counters only move up by one at a time — nobody can set them to 900
- the question and the option labels are writable **only by the device that
  created the poll**

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

1. Open `host.html`, type a question and one option per line, press **Start poll**
2. Share the audience URL — a QR code on a slide works well
3. Watch the meters move; press **Reset votes** to run the same poll again

The device that starts a poll owns it. If you clear that browser's storage you
lose ownership — delete the `polls/live` node in the Firebase console to reclaim it.

To run a second independent poll, change `POLL_ID` in `js/firebase-config.js`.

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
