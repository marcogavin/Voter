// The only file that knows Firebase exists.
//
// Everything else (app.js, host.js) talks to these functions instead of the
// database directly, so swapping backends later stays a one-file change.
//
// Stored shape:
//   /events/{EVENT_ID}
//     ownerUid:     the device allowed to author questions and drive the event
//     currentIndex: which question is on screen, or -1 for none
//     revealed:     true once the current question's answer is showing, which
//                   also closes voting — enforced in the rules, not just here
//     askedAt:      when the current question went up, on the server's clock,
//                   so every device counts down from the same instant
//     questions/
//       q000: { text, correct: "b", options: { a: {label, votes} },
//               voters: { uid: "a" } }
//
// `correct` is optional: plenty of questions have no right answer.
//
// Question keys are zero-padded and sort into presentation order, so the key
// order is the running order and no separate sort field is needed.

import {
  firebaseConfig,
  EVENT_ID,
  FIREBASE_VERSION,
  isConfigured,
} from "./firebase-config.js";

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

let database = null; // the Firebase database module namespace
let authApi = null; // the Firebase auth module namespace
let auth = null;
let eventRef = null;
let uid = null;
let clockOffset = 0;

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
  const questions = Object.entries(raw?.questions || {})
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

  return {
    ownerUid: raw?.ownerUid ?? null,
    currentIndex: typeof raw?.currentIndex === "number" ? raw.currentIndex : -1,
    revealed: raw?.revealed === true,
    askedAt: typeof raw?.askedAt === "number" ? raw.askedAt : null,
    blanked: raw?.blanked === true,
    lang: typeof raw?.lang === "string" ? raw.lang : "en",
    questions,
  };
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
    questions: Object.keys(stored).length ? stored : null,
  });
}

/**
 * Puts a question on screen for everyone. Pass -1 to show none.
 * Always lands with the answer hidden and voting open, so stepping back to a
 * question reopens it rather than showing its answer again.
 */
export function setCurrentIndex(index) {
  requireConnection();
  return database.update(eventRef, {
    ownerUid: uid,
    currentIndex: index,
    revealed: false,
    // stamped by the server, so the countdown starts from one shared instant
    askedAt: database.serverTimestamp(),
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
    ...(revealed ? {} : { askedAt: database.serverTimestamp() }),
  });
}

/**
 * Hides the question from the audience without losing your place — unlike
 * setCurrentIndex(-1), which returns to the top of the set. For talking
 * between questions with nothing stale on everyone's phone.
 */
export function setBlanked(blanked) {
  requireConnection();
  return database.update(eventRef, { ownerUid: uid, blanked });
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
 * Records one vote. The counter bump and the voter record are written as a
 * single atomic update, and the increment happens on the server — so two
 * people tapping at the same instant can't overwrite each other.
 */
export function castVote(questionId, optionId) {
  requireConnection();
  return database.update(eventRef, {
    [`questions/${questionId}/options/${optionId}/votes`]: database.increment(1),
    [`questions/${questionId}/voters/${uid}`]: optionId,
  });
}

/** Clears every question's results, for running the whole set again. */
export function resetAllVotes(questions) {
  requireConnection();

  const updates = {};
  for (const question of questions) {
    updates[`questions/${question.id}/voters`] = null;
    for (const option of question.options) {
      updates[`questions/${question.id}/options/${option.id}/votes`] = 0;
    }
  }
  return database.update(eventRef, updates);
}

/** Clears one question's results and lets everyone vote on it again. */
export function resetVotes(question) {
  requireConnection();

  const updates = { [`questions/${question.id}/voters`]: null };
  for (const option of question.options) {
    updates[`questions/${question.id}/options/${option.id}/votes`] = 0;
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
