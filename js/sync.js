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
//     questions/
//       q000: { text, correct: "b", options: { a: {label} },
//               voters: { uid: "a" } }
//
// `correct` is optional: plenty of questions have no right answer.
//
// There are no vote counters. `voters` is the record, and counts are tallied
// from it when the data comes in. That's what lets someone change their mind:
// a new choice overwrites their entry, with no counter to decrement and no
// rule needed to permit subtraction. Counts can't drift from the votes that
// produced them, because they *are* the votes.
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
let eventRef = null;
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

  eventRef = dbModule.ref(dbModule.getDatabase(app), `events/${EVENT_ID}`);
  return uid;
}

export function getUid() {
  return uid;
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
    .map(([id, question]) => {
      const voters = question.voters || {};

      const tally = {};
      for (const choice of Object.values(voters)) {
        tally[choice] = (tally[choice] || 0) + 1;
      }

      return {
        id,
        text: question.text || "",
        correct: question.correct ?? null,
        voters,
        options: Object.entries(question.options || {})
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([optionId, option]) => ({
            id: optionId,
            label: option.label || "",
            votes: tally[optionId] || 0,
          })),
      };
    });

  return {
    ownerUid: raw?.ownerUid ?? null,
    currentIndex: typeof raw?.currentIndex === "number" ? raw.currentIndex : -1,
    revealed: raw?.revealed === true,
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
      options[String.fromCharCode(97 + optionIndex)] = { label: option.label };
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
  });
}

/**
 * Shows or hides the current question's answer. Revealing also closes voting;
 * the rules reject votes while this is true, so it's a real close rather than
 * the buttons merely being hidden.
 */
export function setRevealed(revealed) {
  requireConnection();
  return database.update(eventRef, { ownerUid: uid, revealed });
}

/**
 * Records this device's choice, replacing any earlier one. Each device writes
 * only its own entry, so simultaneous voters can't overwrite each other and
 * changing your mind needs no arithmetic.
 */
export function castVote(questionId, optionId) {
  requireConnection();
  return database.update(eventRef, {
    [`questions/${questionId}/voters/${uid}`]: optionId,
  });
}

/** Clears one question's results and lets everyone vote on it again. */
export function resetVotes(question) {
  requireConnection();
  return database.update(eventRef, {
    [`questions/${question.id}/voters`]: null,
  });
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
