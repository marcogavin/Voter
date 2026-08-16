// The only file that knows Firebase exists.
//
// Everything else (app.js, host.js) talks to these functions instead of the
// database directly, so swapping backends later stays a one-file change.

import {
  firebaseConfig,
  POLL_ID,
  FIREBASE_VERSION,
  isConfigured,
} from "./firebase-config.js";

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

let database = null; // the Firebase database module namespace
let pollRef = null;
let uid = null;

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
  const auth = authModule.getAuth(app);
  database = dbModule;

  const credential = await authModule.signInAnonymously(auth);
  uid = credential.user.uid;

  pollRef = dbModule.ref(dbModule.getDatabase(app), `polls/${POLL_ID}`);
  return uid;
}

export function getUid() {
  return uid;
}

/**
 * Calls `callback(poll)` immediately with the current poll, then again every
 * time anyone anywhere changes it. `poll` is null when no poll exists yet.
 * Returns an unsubscribe function.
 */
export function onPollChange(callback) {
  requireConnection();
  return database.onValue(pollRef, (snapshot) => callback(snapshot.val()));
}

/**
 * Records one vote. The counter bump and the voter record are written as a
 * single atomic update, and the increment happens on the server — so two
 * people tapping at the same instant can't overwrite each other.
 */
export function castVote(optionId) {
  requireConnection();
  return database.update(pollRef, {
    [`options/${optionId}/votes`]: database.increment(1),
    [`voters/${uid}`]: optionId,
  });
}

/**
 * Creates or replaces the poll. The first device to create it becomes the
 * owner, and only the owner can change the question or reset the votes.
 *
 * `options` is an array of label strings.
 */
export function createPoll(question, options) {
  requireConnection();

  const optionsById = {};
  options.forEach((label, index) => {
    // 'a', 'b', 'c', ... — short, stable keys
    optionsById[String.fromCharCode(97 + index)] = { label, votes: 0 };
  });

  return database.update(pollRef, {
    ownerUid: uid,
    question,
    active: true,
    options: optionsById,
    voters: null,
  });
}

/** Sets every counter back to zero and lets everyone vote again. Owner only. */
export function resetVotes(optionIds) {
  requireConnection();

  const updates = { voters: null };
  for (const id of optionIds) {
    updates[`options/${id}/votes`] = 0;
  }
  return database.update(pollRef, updates);
}

function requireConnection() {
  if (!pollRef) {
    throw new Error("connect() must finish before using the database");
  }
}

export { POLL_ID };
