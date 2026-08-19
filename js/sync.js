// The only file that knows Firebase exists.
//
// Everything else (app.js, host.js) talks to these functions instead of the
// database directly, so swapping backends later stays a one-file change.
//
// Stored shape:
//   /events/{EVENT_ID}
//     ownerUid:     the device allowed to author questions and drive the event
//     currentDeck:  which poll is live; Setup edits it and Run presents it
//     currentIndex: which question of that poll is on screen, or -1 for none
//     revealed:     true once the current question's answer is showing, which
//                   also closes voting — enforced in the rules, not just here
//     askedAt:      when the current question went up, on the server's clock,
//                   so every device counts down from the same instant
//     seconds:      how long a question stays open, or 0 for no limit
//     players/      { uid: "Marco" } — who is in the room, by their own name
//     decks/
//       d000: { title: "Team offsite", likes: 12, questions/
//                 q000: { text, correct: "b", options: { a: {label, votes} },
//                         voters: { uid: "a" } } }
//
// `correct` is optional: plenty of questions have no right answer.
//
// Keys at both levels are zero-padded and sort into presentation order, so key
// order is the running order and no separate sort field is needed.
//
// Only one poll is live at a time, which is why currentIndex, revealed and
// the rest stay on the event rather than moving inside a deck: they describe
// the one screen the room is looking at, not a property of a saved poll.
//
// Before polls existed the questions sat directly on the event, with no
// decks node at all. That layout is still read — see readDecks — and the first
// write that touches poll structure moves it across. Nothing has to be
// migrated by hand, and nothing breaks in the meantime.

import {
  firebaseConfig,
  EVENT_ID,
  FIREBASE_VERSION,
  DEFAULT_SECONDS,
  isConfigured,
} from "./firebase-config.js";

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

/** The poll that questions written before polls existed belong to. */
const FIRST_DECK = "d000";

/** As many polls as stay usable in one picker. */
export const DECK_MAX = 20;

export const TITLE_MAX = 60;

/** Long enough for a name, short enough for a leaderboard row. */
export const NAME_MAX = 24;

let database = null; // the Firebase database module namespace
let authApi = null; // the Firebase auth module namespace
let auth = null;
let eventRef = null;
let uid = null;
let clockOffset = 0;

// Read from every snapshot, so writes land on the poll the reader is
// actually looking at. Threading these through every call site instead would
// mean the audience passing back state it was only ever given to display.
let liveDeck = FIRST_DECK;
let questionsPath = "questions";
let unmigrated = true;
let legacyQuestions = null;

/**
 * Loads the SDK, connects, and signs this device in anonymously.
 * Anonymous sign-in gives each browser a stable id with no login screen —
 * that's what makes one-vote-per-device enforceable in the security rules.
 *
 * Resolves with the device's uid. Throws with a readable message on failure.
 */
export async function connect() {
  if (!isConfigured()) {
    throw new Error(
      "Firebase isn't set up yet — paste your config into js/firebase-config.js",
    );
  }

  if (uid) return uid; // already connected

  const [appModule, authModule, dbModule] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-database.js`),
  ]);

  const app = appModule.initializeApp(firebaseConfig);
  database = dbModule;
  authApi = authModule;
  auth = authModule.getAuth(app);

  // Firebase prefers IndexedDB for the session, which Safari can refuse
  // outright — it throws "Database is closing", the sign-in is discarded, and
  // the failure looks like a rejected login rather than a storage problem.
  // localStorage holds a host session perfectly well and sidesteps it.
  try {
    await authModule.setPersistence(auth, authModule.browserLocalPersistence);
  } catch (error) {
    console.error("Falling back to the default session storage:", error);
  }

  // Finish a Google sign-in that sent us away and back. Phones often block
  // the popup, so the redirect route has to work.
  try {
    await authModule.getRedirectResult(auth);
  } catch (error) {
    console.error(error);
  }

  // An existing session — anonymous or Google — is restored asynchronously,
  // so wait for the first answer before deciding whether to create one.
  let user = await new Promise((resolve) => {
    const stop = authModule.onAuthStateChanged(auth, (u) => {
      stop();
      resolve(u);
    });
  });

  if (!user) {
    // Sign-in can hang rather than fail — a slow connection, or a phone
    // browser restricting the storage Firebase keeps its session in. Without
    // a deadline the page waits on "Connecting" forever with no way out.
    const credential = await Promise.race([
      authModule.signInAnonymously(auth),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Couldn't reach the server. Check your connection.")),
          15000,
        ),
      ),
    ]);
    user = credential.user;
  }

  uid = user.uid;

  const db = dbModule.getDatabase(app);
  eventRef = dbModule.ref(db, `events/${EVENT_ID}`);

  // Phone clocks are wrong by seconds or minutes. Firebase reports how far
  // this one is from its own, so every device counts the same thirty seconds
  // from the same instant rather than from its own idea of now.
  dbModule.onValue(dbModule.ref(db, ".info/serverTimeOffset"), (snapshot) => {
    clockOffset = snapshot.val() || 0;
  });

  return uid;
}

export function getUid() {
  return uid;
}

/** Now, corrected to the server's clock rather than this device's. */
export function serverNow() {
  return Date.now() + clockOffset;
}

/** True while this device is only an anonymous visitor, not a signed-in host. */
export function isAnonymous() {
  return auth?.currentUser?.isAnonymous !== false;
}

export function accountName() {
  return auth?.currentUser?.email ?? auth?.currentUser?.displayName ?? null;
}

/**
 * Signs the host in with Google. Ownership then belongs to the account rather
 * than to one browser, so the same person can present from any device.
 *
 * Reloads on success: the device's uid changes, and everything already drawn
 * was drawn for the old one.
 */
export async function signInWithGoogle() {
  const provider = new authApi.GoogleAuthProvider();

  // Google skips its account chooser when the browser already holds exactly
  // one session, so signing out and back in silently returned the same
  // account. Asking for the chooser every time makes switching possible, and
  // makes it visible which account is about to take the event.
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await authApi.signInWithPopup(auth, provider);
    location.reload();
  } catch (error) {
    // The sign-in itself may have worked and only the session write failed.
    // Google has already authenticated the account at that point, so treat a
    // real signed-in user as success whatever the error claims.
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      location.reload();
      return;
    }

    // Popups are blocked by default in most phone browsers; the redirect
    // route survives that, and returns through getRedirectResult above.
    if (
      error.code === "auth/popup-blocked" ||
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request" ||
      error.code === "auth/operation-not-supported-in-this-environment"
    ) {
      await authApi.signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signOutHost() {
  await authApi.signOut(auth);
  location.reload();
}

/**
 * Calls `callback(event)` immediately with the current event, then again every
 * time anyone changes it. The event is normalised for the UI:
 *
 *   { ownerUid, currentIndex, questions: [{ id, text, options: [...], voters }] }
 *
 * `questions` is an array in running order. Returns an unsubscribe function.
 */
export function onEventChange(callback) {
  requireConnection();
  return database.onValue(eventRef, (snapshot) =>
    callback(normalise(snapshot.val())),
  );
}

function normalise(raw) {
  const entries = readDecks(raw);

  // A currentDeck naming a poll that's been deleted would otherwise leave
  // the room staring at nothing with no way back.
  const [deckId, deck] =
    entries.find(([id]) => id === raw?.currentDeck) ?? entries[0];

  liveDeck = deckId;
  unmigrated = !raw?.decks;
  legacyQuestions = raw?.questions ?? null;
  // Where the live poll's questions are *right now*, which during the window
  // between deploying this and the host's first save is still the old place.
  // Votes have to go where the counters actually are.
  questionsPath = unmigrated ? "questions" : `decks/${deckId}/questions`;

  return {
    ownerUid: raw?.ownerUid ?? null,
    currentIndex: typeof raw?.currentIndex === "number" ? raw.currentIndex : -1,
    revealed: raw?.revealed === true,
    askedAt: typeof raw?.askedAt === "number" ? raw.askedAt : null,
    // Set while the screen is hidden, and what the clock counts up to instead
    // of "now" — hiding the question stops the clock rather than letting it
    // run out behind a blank screen.
    pausedAt: typeof raw?.pausedAt === "number" ? raw.pausedAt : null,
    // An event saved before the clock existed has no setting of its own, and
    // should behave the way it did rather than suddenly run untimed.
    seconds: typeof raw?.seconds === "number" ? raw.seconds : DEFAULT_SECONDS,
    blanked: raw?.blanked === true,
    // Everyone in the room, by the name they gave. Readable by every device,
    // which is what a shared leaderboard needs.
    players: raw?.players || {},
    lang: typeof raw?.lang === "string" ? raw.lang : "en",

    // Only the live poll is unpacked. The rest are named and counted, which
    // is all a picker needs, and all anyone not presenting them should cost.
    currentDeck: deckId,
    decks: entries.map(([id, entry]) => ({
      id,
      title: typeof entry?.title === "string" ? entry.title : "",
      count: Object.keys(entry?.questions || {}).length,
      // Both are null on a poll written before they existed, which the
      // picker says nothing about rather than inventing a date for.
      createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : null,
      lastRunAt: typeof entry?.lastRunAt === "number" ? entry.lastRunAt : null,
    })),
    likes: typeof deck?.likes === "number" ? deck.likes : 0,
    questions: readQuestions(deck?.questions),
  };
}

/**
 * Every poll, oldest first. There is always at least one: an event with no
 * decks node is presented as a single poll holding whatever questions sit
 * at the old top-level path, so the picker never has nothing to point at.
 */
function readDecks(raw) {
  const entries = Object.entries(raw?.decks || {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return entries.length
    ? entries
    : [[FIRST_DECK, { title: "", questions: raw?.questions || {} }]];
}

function readQuestions(stored) {
  return Object.entries(stored || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, question]) => ({
      id,
      text: question.text || "",
      correct: question.correct ?? null,
      voters: question.voters || {},
      options: Object.entries(question.options || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([optionId, option]) => ({
          id: optionId,
          label: option.label || "",
          votes: option.votes || 0,
        })),
    }));
}

/**
 * The writes that move pre-poll questions into the first poll, to be
 * folded into whichever update first touches poll structure. Doing it in
 * that same update makes it atomic: either the questions arrive in their new
 * home and leave the old one, or nothing moves at all.
 *
 * Empty once there's a decks node, which is what makes it run exactly once.
 */
function migration() {
  if (!unmigrated) return {};

  const writes = { [`decks/${FIRST_DECK}/title`]: "" };
  if (legacyQuestions) {
    writes[`decks/${FIRST_DECK}/questions`] = legacyQuestions;
    writes.questions = null;
  }
  return writes;
}

/**
 * Replaces the whole question set. Authoring is owner-only and happens before
 * an event, so rewriting the node wholesale keeps adds, edits, deletes and
 * reordering to a single code path.
 *
 * Existing votes ride along inside each question, so re-saving to fix a typo
 * doesn't wipe results that have already come in.
 */
export function saveQuestions(questions) {
  requireConnection();

  const stored = {};
  questions.forEach((question, index) => {
    const options = {};
    question.options.forEach((option, optionIndex) => {
      // 'a', 'b', 'c', ... — short, stable within a question
      options[String.fromCharCode(97 + optionIndex)] = {
        label: option.label,
        votes: option.votes || 0,
      };
    });

    stored[questionKey(index)] = {
      text: question.text,
      options,
      ...(question.correct ? { correct: question.correct } : {}),
      ...(question.voters && Object.keys(question.voters).length
        ? { voters: question.voters }
        : {}),
    };
  });

  return database.update(eventRef, {
    ownerUid: uid,
    // Spread first: on the migrating save this path is written twice, and the
    // questions being saved now are the ones that should survive.
    ...migration(),
    [`decks/${liveDeck}/questions`]: Object.keys(stored).length ? stored : null,
  });
}

/**
 * Creates a poll and switches to it. Returns its id.
 *
 * Switching is deliberate rather than a side effect: a new poll is empty, so
 * leaving the old one live would mean adding questions to something the room
 * isn't looking at.
 */
export function newDeck(title, existingIds) {
  requireConnection();

  const id = nextDeckKey(existingIds);
  return database
    .update(eventRef, {
      ownerUid: uid,
      ...migration(),
      [`decks/${id}/title`]: title,
      [`decks/${id}/createdAt`]: database.serverTimestamp(),
      ...liveState(id),
    })
    .then(() => id);
}

export function renameDeck(id, title) {
  requireConnection();
  return database.update(eventRef, {
    ownerUid: uid,
    ...migration(),
    [`decks/${id}/title`]: title,
  });
}

/**
 * Removes a poll and everything in it. Falls back to a survivor when the one
 * being removed is live, so the room is never pointed at a poll that's gone.
 */
export function deleteDeck(id, allIds) {
  requireConnection();

  const fallback = allIds.find((other) => other !== id);
  if (!fallback) {
    throw new Error("An event has to keep at least one poll.");
  }

  return database.update(eventRef, {
    ownerUid: uid,
    ...migration(),
    [`decks/${id}`]: null,
    ...(id === liveDeck ? liveState(fallback) : {}),
  });
}

/** Puts a different poll on screen, from the top with nothing showing. */
export function setCurrentDeck(id) {
  requireConnection();
  return database.update(eventRef, {
    ownerUid: uid,
    ...migration(),
    ...liveState(id),
  });
}

/**
 * Switching poll can't leave the old one's position behind: index 4 means
 * something entirely different in a poll that has three questions.
 */
function liveState(deckId) {
  return {
    currentDeck: deckId,
    currentIndex: -1,
    revealed: false,
    blanked: false,
    askedAt: database.serverTimestamp(),
    pausedAt: null,
  };
}

/** One past the highest key in use, so a deleted poll's id isn't reissued. */
function nextDeckKey(existingIds) {
  const highest = existingIds.reduce(
    (top, id) => Math.max(top, Number(id.slice(1)) || 0),
    -1,
  );
  return "d" + String(highest + 1).padStart(3, "0");
}

/**
 * Puts a question on screen for everyone. Pass -1 to show none.
 * Always lands with the answer hidden and voting open, so stepping back to a
 * question reopens it rather than showing its answer again.
 */
export function setCurrentIndex(index, { starting = false } = {}) {
  requireConnection();
  return database.update(eventRef, {
    ownerUid: uid,
    currentIndex: index,
    revealed: false,
    // stamped by the server, so the countdown starts from one shared instant
    askedAt: database.serverTimestamp(),
    // a fresh question is never mid-pause, whatever the last one was doing
    pausedAt: null,
    // "Last run" is when a poll was last put in front of a room, so it is
    // stamped when a run begins rather than on every question in it.
    ...(starting
      ? { [`decks/${liveDeck}/lastRunAt`]: database.serverTimestamp() }
      : {}),
  });
}

/**
 * Shows or hides the current question's answer. Revealing also closes voting;
 * the rules reject votes while this is true, so it's a real close rather than
 * the buttons merely being hidden.
 */
export function setRevealed(revealed) {
  requireConnection();
  return database.update(eventRef, {
    ownerUid: uid,
    revealed,
    // reopening restarts the clock; there'd be no time left otherwise
    ...(revealed
      ? {}
      : { askedAt: database.serverTimestamp(), pausedAt: null }),
  });
}

/**
 * Hides the question from the audience without losing your place — unlike
 * setCurrentIndex(-1), which returns to the top of the set. For talking
 * between questions with nothing stale on everyone's phone.
 */
/**
 * Hides or shows the question, and stops or restarts the clock with it.
 *
 * Hiding stamps `pausedAt`; showing clears it and hands back the seconds that
 * were left, by moving the question's start forward by however long it was
 * hidden. A presenter who takes a question from the floor gets the clock back
 * where they left it rather than finding it spent.
 */
export function setBlanked(blanked, resumedAskedAt = null) {
  requireConnection();
  return database.update(eventRef, {
    ownerUid: uid,
    blanked,
    pausedAt: blanked ? database.serverTimestamp() : null,
    ...(resumedAskedAt === null ? {} : { askedAt: resumedAskedAt }),
  });
}

/**
 * Sets the interface language for everyone. It belongs to the event rather
 * than to each device so the room reads the same thing without each person
 * having to find a setting.
 */
export function saveLanguage(lang) {
  requireConnection();
  return database.update(eventRef, { ownerUid: uid, lang });
}

/**
 * Sets how long each question stays open, or 0 for no limit. Like the
 * language, it belongs to the event: the countdown every phone draws has to
 * be the same one the host's page is about to act on.
 *
 * Restamps askedAt, so a change lands on the question already up rather than
 * only on the next one — shortening the clock mid-question would otherwise
 * close it retroactively.
 */
export function saveSeconds(seconds) {
  requireConnection();
  return database.update(eventRef, {
    ownerUid: uid,
    seconds,
    askedAt: database.serverTimestamp(),
    pausedAt: null,
  });
}

/**
 * Records this device's name for the event. Writable only by the device it
 * belongs to, and re-writable — people mistype their own name on a phone, and
 * being stuck with it until the event ends would be worse than the risk.
 */
export function saveName(name) {
  requireConnection();
  return database.update(eventRef, { [`players/${uid}`]: name });
}

/**
 * Adds one to the live poll's applause. Unlike a vote there is no limit and
 * nothing to be gained by cheating, so the rules only check that it goes up by
 * one at a time — which is enough to stop anyone setting it to a million.
 */
export function likePoll() {
  requireConnection();
  return database.update(eventRef, {
    [`decks/${liveDeck}/likes`]: database.increment(1),
  });
}

/**
 * Records one vote. The counter bump and the voter record are written as a
 * single atomic update, and the increment happens on the server — so two
 * people tapping at the same instant can't overwrite each other.
 */
export function castVote(questionId, optionId) {
  requireConnection();
  return database.update(eventRef, {
    [`${questionsPath}/${questionId}/options/${optionId}/votes`]:
      database.increment(1),
    [`${questionsPath}/${questionId}/voters/${uid}`]: optionId,
  });
}

/**
 * Clears every question's results *and* the applause, for running the whole
 * poll again. The hearts belong to the run that earned them: a room arriving
 * to find the last room's 103 already on the board isn't being asked
 * anything.
 */
export function resetAllVotes(questions) {
  requireConnection();

  const updates = { [`decks/${liveDeck}/likes`]: 0 };
  for (const question of questions) {
    updates[`${questionsPath}/${question.id}/voters`] = null;
    for (const option of question.options) {
      updates[`${questionsPath}/${question.id}/options/${option.id}/votes`] = 0;
    }
  }
  return database.update(eventRef, updates);
}

/** Clears one question's results and lets everyone vote on it again. */
export function resetVotes(question) {
  requireConnection();

  const updates = { [`${questionsPath}/${question.id}/voters`]: null };
  for (const option of question.options) {
    updates[`${questionsPath}/${question.id}/options/${option.id}/votes`] = 0;
  }
  return database.update(eventRef, updates);
}

function questionKey(index) {
  return "q" + String(index).padStart(3, "0");
}

function requireConnection() {
  if (!eventRef) {
    throw new Error("connect() must finish before using the database");
  }
}

export { EVENT_ID };
