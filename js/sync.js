// The only file that knows Firebase exists.
//
// Everything else (app.js, host.js) talks to these functions instead of the
// database directly, so swapping backends later stays a one-file change.
//
// Stored shape:
//   /events/{EVENT_ID}
//     ownerUid:         the device allowed to author questions and drive the event
//     currentDeck:      which poll is live; Setup edits it and Run presents it
//     currentIndex:     which question of that poll is on screen, or -1 for none
//     currentQuestionKey: that same question's key ("q001"), kept alongside the
//                       index because the rules can't compute one from the
//                       other — see below
//     revealed:         true once the current question's answer is showing, which
//                       also closes voting — enforced in the rules, not just here
//     askedAt:          when the current question went up, on the server's clock,
//                       so every device counts down from the same instant
//     seconds:          how long a question stays open, or 0 for no limit
//     players/          { uid: "Marco" } — who is in the room, by their own name
//     seen/             { uid: 1755689400000 } — when that phone last showed signs
//                       of life, so "the room" can mean the people in it rather
//                       than everybody who has ever opened the page
//     decks/
//       d000: { title: "Team offsite", likes: 12, questionCount: 5, questions/
//                 q000: { text, correct: "b", options: { a: {label, votes} },
//                         voters: { uid: "a" }, times: { uid: 4200 } } }
//
// `correct` is optional: plenty of questions have no right answer.
//
// `times` is how long each person took, in milliseconds from the moment the
// question went up, and is only written while a time limit is set. It is a
// node of its own rather than a field inside `voters` so that a vote written
// before it existed is still a vote, and so that adding it needed one new
// rule rather than a change to the one that guards every vote in the room.
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
//
// `currentQuestionKey` and `decks/{id}/questionCount` exist for the rules, not
// for this file: the database.rules.json a browser could otherwise use to
// read the whole event grants a question's `text`/`options` only to whoever
// is looking at it, and its `correct` only once it's revealed or the run is
// over — "which question is current" and "how many are there" have to be
// facts the rules can check without counting or indexing, which they can't
// do. That means the questions a client gets back from onEventChange are
// whatever it's allowed to see, not necessarily every question in the deck —
// readQuestions() below doesn't need to know that; it just reads what
// arrived. See normalise() for how the current one is found by key instead of
// by array position.

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
let db = null; // the database instance itself, for building refs beyond eventRef
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

  db = dbModule.getDatabase(app);
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
/**
 * Calls back the moment a real account appears on this device, whatever put
 * it there — this tab's own sign-in, or a sign-in that happened in the tab
 * Google opened and reached us through the session store.
 *
 * The popup's promise is not reliable on a phone: iPadOS opens it as a
 * separate tab, and the message that would resolve the promise doesn't always
 * make it back. The session does, so that is what this listens to.
 */
export function onSignedIn(callback) {
  if (!authApi) return () => {};
  return authApi.onAuthStateChanged(auth, (user) => {
    if (user && !user.isAnonymous) callback(user);
  });
}

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

/** Every field the rules grant to anyone signed in, unconditionally. */
const PUBLIC_FIELDS = [
  "ownerUid", "currentDeck", "currentIndex", "currentQuestionKey",
  "revealed", "askedAt", "pausedAt", "seconds", "blanked", "lang",
];

/**
 * Calls `callback(event)` immediately with the current event, then again every
 * time anyone changes it. The event is normalised for the UI:
 *
 *   { ownerUid, currentIndex, questions: [{ id, text, options: [...], voters }] }
 *
 * `questions` is an array in running order. Returns an unsubscribe function.
 *
 * This used to be one onValue() at the event's own root. It can't be any
 * more: the rules don't grant a blanket read there, on purpose — see the
 * comment at the top of this file — and asking for a path with no read of
 * its own doesn't hand back a filtered view of what's underneath. It's
 * refused outright, for everyone, owner included. Confirmed against a real
 * Realtime Database emulator, not assumed: that assumption is exactly what
 * broke this the first time.
 *
 * So this listens at every path the rules actually grant something at,
 * separately, and assembles the pieces into the same shape normalise() has
 * always read. Two of those groups have to be torn down and rebuilt rather
 * than left running, also confirmed against the emulator: a listener that's
 * ever been refused stays refused even once the thing it depended on
 * changes, so anywhere a grant depends on another field's value, the fix is
 * to reconnect, not to wait.
 */
export function onEventChange(callback) {
  requireConnection();

  const raw = { players: {}, seen: {} };
  const staticStops = [];

  let ownerGen = 0;
  let ownerStops = [];
  let ownerDecks = null; // the owner's full view of `decks`, or null if refused
  let ownerLegacy = null; // same, for the pre-poll top-level `questions`
  let deckMeta = {}; // { questionCount, likes } for the live deck, from the narrow reads

  let questionGen = 0;
  let questionStops = [];
  let questionsView = {}; // { [id]: { text?, options?, correct?, voters?, times? } }

  let lastOwnerKey = null; // `${ownerUid}|${currentDeck}`
  let lastQuestionKey = null; // `${currentDeck}|${currentIndex}|${count}|${revealed}`

  const path = `events/${EVENT_ID}`;
  const at = (p) => database.ref(db, `${path}/${p}`);
  const stopAll = (list) => { list.forEach((stop) => stop()); list.length = 0; };

  const emit = () => {
    const deckId = raw.currentDeck;
    const decks = {};
    if (ownerDecks) {
      Object.assign(decks, ownerDecks);
    } else if (deckId) {
      decks[deckId] = { questionCount: deckMeta.questionCount, likes: deckMeta.likes, questions: questionsView };
    }
    // normalise() tells a never-migrated event apart from a migrated one by
    // whether `decks` exists at all — an empty object here would read as
    // "migrated, with nothing in it" instead of "not migrated yet".
    const hasDecks = Object.keys(decks).length > 0;
    callback(normalise({ ...raw, decks: hasDecks ? decks : undefined, questions: ownerLegacy }));
  };

  function effectiveCount() {
    const deckId = raw.currentDeck;
    if (ownerDecks && deckId && ownerDecks[deckId]) return ownerDecks[deckId].questionCount ?? 0;
    return deckMeta.questionCount ?? 0;
  }

  /** Rebuilt whenever ownerUid or currentDeck changes — either can flip whether the owner reads are granted. */
  function rebuildOwner() {
    const key = `${raw.ownerUid}|${raw.currentDeck}`;
    if (key === lastOwnerKey) return;
    lastOwnerKey = key;
    stopAll(ownerStops);
    const gen = ++ownerGen;
    ownerDecks = null;
    ownerLegacy = null;
    deckMeta = {};
    const guarded = (assign) => (snap) => { if (gen === ownerGen) { assign(snap.val()); rebuildQuestions(); emit(); } };

    ownerStops.push(database.onValue(at("decks"), guarded((v) => { ownerDecks = v; }), guarded(() => { ownerDecks = null; })));
    ownerStops.push(database.onValue(at("questions"), guarded((v) => { ownerLegacy = v; }), guarded(() => { ownerLegacy = null; })));

    const deckId = raw.currentDeck;
    if (!deckId) { rebuildQuestions(); return emit(); }
    ownerStops.push(database.onValue(at(`decks/${deckId}/questionCount`),
      guarded((v) => { deckMeta.questionCount = v; }), guarded(() => { deckMeta.questionCount = undefined; })));
    ownerStops.push(database.onValue(at(`decks/${deckId}/likes`),
      guarded((v) => { deckMeta.likes = v; }), guarded(() => { deckMeta.likes = undefined; })));
  }

  /**
   * Rebuilt whenever currentDeck, currentIndex, the deck's questionCount, or
   * revealed changes — any of those can change which question's own paths
   * are the right ones to be listening at, or whether `correct` is granted.
   */
  function rebuildQuestions() {
    const count = effectiveCount();
    const key = `${raw.currentDeck}|${raw.currentIndex}|${count}|${raw.revealed}`;
    if (key === lastQuestionKey) return;
    lastQuestionKey = key;
    stopAll(questionStops);
    const gen = ++questionGen;
    questionsView = {};
    const deckId = raw.currentDeck;
    const index = typeof raw.currentIndex === "number" ? raw.currentIndex : -1;
    if (!deckId || index < 0) return emit();

    // Mid-run, only the one question on screen. Once the run has moved past
    // every question, every one of them is fair game — that's what the
    // standings need, and it's also what the rules grant at that point.
    const finished = count > 0 && index >= count;
    const keys = finished
      ? Array.from({ length: count }, (_, i) => questionKey(i))
      : [questionKey(index)];
    const fields = finished
      ? ["correct", "voters", "times"]
      : ["text", "options", "correct", "voters", "times", "ratingStars", "ratingColor"];

    for (const qid of keys) {
      questionsView[qid] = {};
      for (const field of fields) {
        questionStops.push(database.onValue(at(`decks/${deckId}/questions/${qid}/${field}`),
          (snap) => { if (gen === questionGen) { questionsView[qid][field] = snap.val(); emit(); } },
          () => { if (gen === questionGen) { questionsView[qid][field] = undefined; emit(); } },
        ));
      }
    }
    emit();
  }

  for (const field of PUBLIC_FIELDS) {
    staticStops.push(database.onValue(at(field), (snap) => {
      raw[field] = snap.val();
      if (field === "ownerUid" || field === "currentDeck") rebuildOwner();
      if (field === "currentIndex" || field === "revealed") rebuildQuestions();
      emit();
    }));
  }
  staticStops.push(database.onValue(at("players"), (snap) => { raw.players = snap.val() || {}; emit(); }));
  staticStops.push(database.onValue(at("seen"), (snap) => { raw.seen = snap.val() || {}; emit(); }));

  return () => { stopAll(staticStops); stopAll(ownerStops); stopAll(questionStops); };
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

  const currentIndex =
    typeof raw?.currentIndex === "number" ? raw.currentIndex : -1;
  // The rules gate a question's own content on this key, not on currentIndex —
  // see the comment at the top of this file — so the current question has to
  // be found by asking for it directly rather than by indexing into whatever
  // of the deck came back. A device that's only allowed to see this one
  // question still gets it; one only allowed to see none, correctly, doesn't.
  const currentKey = currentIndex >= 0 ? questionKey(currentIndex) : null;
  const currentRaw = currentKey ? deck?.questions?.[currentKey] : null;

  return {
    ownerUid: raw?.ownerUid ?? null,
    currentIndex,
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
    // …and when each of them was last awake. A name with no entry here is
    // from before this existed, which is the same thing as long gone.
    seen: raw?.seen || {},
    lang: typeof raw?.lang === "string" ? raw.lang : "en",

    // Only the live poll is unpacked. The rest are named and counted, which
    // is all a picker needs, and all anyone not presenting them should cost.
    currentDeck: deckId,
    decks: entries.map(([id, entry]) => ({
      id,
      title: typeof entry?.title === "string" ? entry.title : "",
      count: deckCount(entry),
      // Both are null on a poll written before they existed, which the
      // picker says nothing about rather than inventing a date for.
      createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : null,
      lastRunAt: typeof entry?.lastRunAt === "number" ? entry.lastRunAt : null,
    })),
    likes: typeof deck?.likes === "number" ? deck.likes : 0,
    // How many questions the live poll has, which "Question 3 of 8" needs and
    // an audience device otherwise has no way to know — the rules let it see
    // one question at a time, never the whole deck it could count instead.
    questionCount: deckCount(deck),
    // Whichever questions this device is currently allowed to see: for the
    // owner that's the whole deck; for everyone else, per the rules, it's the
    // current question alone, and every one already stepped past once the run
    // has ended and the standings are being worked out. Read the shared
    // comment at the top of this file before changing what depends on this
    // being a *subset* rather than the full, position-indexed list it used
    // to be.
    questions: readQuestions(deck?.questions),
    // The one question on screen right now, found by key rather than by
    // indexing into `questions` above — which, for anyone but the owner, is
    // usually not the full deck. null while nothing is up.
    currentQuestion: currentRaw ? readQuestion(currentKey, currentRaw) : null,
  };
}

/**
 * How many questions a deck has. The stored count, once it exists — it's the
 * only thing a device that can't read every question still has to go on —
 * falling back to actually counting for a deck saved before this existed, or
 * for the owner, who can always count for real.
 */
function deckCount(entry) {
  return typeof entry?.questionCount === "number"
    ? entry.questionCount
    : Object.keys(entry?.questions || {}).length;
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
    .map(([id, question]) => readQuestion(id, question));
}

/**
 * One question, shaped for the UI. Split out from readQuestions() so the
 * current one can be read straight off its key — see normalise() — without
 * going through the whole deck, which for an audience device is usually the
 * only one the rules have let through anyway.
 */
function readQuestion(id, raw) {
  return {
    id,
    text: raw.text || "",
    correct: raw.correct ?? null,
    voters: raw.voters || {},
    times: raw.times || {},
    ratingStars: raw.ratingStars ?? null,
    ratingColor: raw.ratingColor ?? null,
    options: Object.entries(raw.options || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([optionId, option]) => ({
        id: optionId,
        label: option.label || "",
        votes: option.votes || 0,
      })),
  };
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
      // Re-saving to fix a typo keeps the answers; it has to keep how long
      // they took as well, or the leaderboard changes under the room.
      ...(question.times && Object.keys(question.times).length
        ? { times: question.times }
        : {}),
      // A rating's whole shape — the star count, the colour — rides with it
      // rather than living anywhere else, so editing one poll never touches
      // another's.
      ...(question.ratingStars
        ? { ratingStars: question.ratingStars, ratingColor: question.ratingColor }
        : {}),
    };
  });

  return database.update(eventRef, {
    ownerUid: uid,
    // Spread first: on the migrating save this path is written twice, and the
    // questions being saved now are the ones that should survive.
    ...migration(),
    [`decks/${liveDeck}/questions`]: Object.keys(stored).length ? stored : null,
    // What the rules let a non-owner device know instead of the deck it can't
    // read — see the comment at the top of this file.
    [`decks/${liveDeck}/questionCount`]: questions.length,
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
    currentQuestionKey: null,
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
    // What the rules key a question's visibility on — see the comment at the
    // top of this file. Deterministic from the index, so there's nothing to
    // pass in and nothing that can drift from it.
    currentQuestionKey: index >= 0 ? questionKey(index) : null,
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
 * Says this device is still here.
 *
 * Written on its own, never folded into a vote or a name: those are the
 * writes that must not fail, and a rules file that hasn't been republished
 * yet would refuse the whole update if this rode along with them. A refused
 * heartbeat costs a place in the count; a refused vote costs the vote.
 */
export function touch() {
  if (!eventRef) return Promise.resolve();
  return database
    .update(eventRef, { [`seen/${uid}`]: database.serverTimestamp() })
    .catch((error) => {
      console.error("Couldn't report being here:", error);
    });
}

/**
 * Removes everyone from the room — every name, every "still here" stamp —
 * without touching a question, a vote, or a poll. Owner-only, and a wipe or
 * nothing: the rules only allow this write when it's setting the whole node
 * to null, which is what stops it turning into a way to rewrite someone
 * else's name.
 */
export function clearRoom() {
  requireConnection();
  return database.update(eventRef, {
    ownerUid: uid,
    players: null,
    seen: null,
  });
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
 *
 * `ms` is how long this person took, from the moment the question went up.
 * Pass null when nothing is being timed.
 *
 * The time rides along in the same atomic update, which means the rules have
 * to know about `times` before any of it lands. They may not: the repository
 * is the documentation and the console is what enforces it, and there is
 * always a window between deploying this and republishing them. So a refusal
 * is retried once without the time — a room that can vote but isn't being
 * timed is a working poll; a room that can't vote is not.
 */
export async function castVote(questionId, optionId, ms = null) {
  requireConnection();

  const vote = {
    [`${questionsPath}/${questionId}/options/${optionId}/votes`]:
      database.increment(1),
    [`${questionsPath}/${questionId}/voters/${uid}`]: optionId,
  };

  if (ms === null) return database.update(eventRef, vote);

  try {
    await database.update(eventRef, {
      ...vote,
      [`${questionsPath}/${questionId}/times/${uid}`]: Math.round(ms),
    });
  } catch (error) {
    console.error("Timing this vote was refused; voting without it.", error);
    await database.update(eventRef, vote);
  }
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
    updates[`${questionsPath}/${question.id}/times`] = null;
    for (const option of question.options) {
      updates[`${questionsPath}/${question.id}/options/${option.id}/votes`] = 0;
    }
  }
  return database.update(eventRef, updates);
}

/** Clears one question's results and lets everyone vote on it again. */
export function resetVotes(question) {
  requireConnection();

  const updates = {
    [`${questionsPath}/${question.id}/voters`]: null,
    [`${questionsPath}/${question.id}/times`]: null,
  };
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
