// Runs the real js/sync.js — not a stub, not a hand-copied prototype — against
// a real Realtime Database emulator loaded with the real database.rules.json,
// through the real Firebase JS SDK. This is the suite that would have caught
// both of the mistakes that made it to the live event before this existed:
// `.numChildren()` isn't a real rules method, and a listener at a path with no
// read of its own doesn't get a filtered view of what's underneath — it's
// refused outright, for everyone, owner included.
//
// Not part of `npm test`: it needs a JVM and a moment to spin up two
// emulators, which the fast suite deliberately never requires. Run it with
// `npm test` from this directory (see run.sh) whenever database.rules.json
// or js/sync.js's onEventChange changes — which, after today, should be
// "always, before it goes anywhere near the console".
//
// js/sync.js keeps its connection in module-level state, which is exactly
// right for one browser tab and wrong for simulating several clients in one
// process — a second __inject() would pull the rug out from under the first
// one's already-open listeners. So the owner's full write-then-read round
// trip goes through the real sync.js, same as host.js uses it; the audience
// and a second signed-in (non-owner) account are checked with their own
// direct SDK connections instead, reading the exact paths sync.js's
// onEventChange listens at, which is what actually proves the rules agree
// with what sync.js writes.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithCustomToken } from "firebase/auth";
import * as database from "firebase/database";
import { getDatabase, connectDatabaseEmulator, ref, onValue } from "firebase/database";
import { initializeApp as initAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getDatabase as getAdminDatabase } from "firebase-admin/database";
import * as sync from "../build/sync.js";

const PROJECT = process.env.GCLOUD_PROJECT || "votr-rules-test";
const DB_PORT = Number(process.env.FIREBASE_DATABASE_EMULATOR_HOST?.split(":")[1] || 9110);
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9111";
const EVENT_PATH = "events/live";
// firebase-tools loads database.rules.json onto the project's *default RTDB
// instance*, which for a real project is always named "<project>-default-
// rtdb" — never the bare project id. A client that connects with `ns=` the
// bare project id lands on a different, ruleless namespace: every read and
// write then silently passes with nothing enforced, and every check below
// that expects a denial just fails — which looks exactly like a rules bug,
// not a wiring one. This suite found that the hard way once already, so it
// checks its own wiring first (below) instead of trusting the constant.
const DB_NS = `${PROJECT}-default-rtdb`;

let failures = 0;
const ok = (label, cond) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (!cond) failures++; };
const tick = (ms = 900) => new Promise((r) => setTimeout(r, ms));

const adminApp = initAdminApp({ projectId: PROJECT, databaseURL: `http://127.0.0.1:${DB_PORT}/?ns=${DB_NS}` });
const adminDb = getAdminDatabase(adminApp);

function makeClient(name) {
  const app = initializeApp({
    apiKey: "fake", projectId: PROJECT, databaseURL: `http://127.0.0.1:${DB_PORT}/?ns=${DB_NS}`,
  }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, "127.0.0.1", DB_PORT);
  return { app, auth, db };
}

// Fail loudly and immediately if the namespace above isn't actually serving
// database.rules.json — rather than 900ms and a wall of confusing ✗s later.
{
  const loaded = await fetch(`http://127.0.0.1:${DB_PORT}/.settings/rules.json?ns=${DB_NS}&access_token=owner`)
    .then((r) => r.json());
  if (!JSON.stringify(loaded).includes("ownerUid")) {
    console.error(`\nThe emulator's "${DB_NS}" namespace is not serving database.rules.json.`);
    console.error(`Got: ${JSON.stringify(loaded)}`);
    console.error(`Every check below would silently pass against open rules — fixing this comes first.`);
    process.exit(1);
  }
}

/** One field, read once, as a given signed-in client. Not found ⇒ undefined. */
async function readOnce(client, path) {
  return new Promise((resolve) => {
    // A client that already has this path open elsewhere (the owner's own
    // onEventChange, say) can fire synchronously from local cache — before
    // onValue() has even returned `stop` to assign. `let` plus a microtask
    // gives stop() something to call either way.
    let stop = () => {};
    let done = false;
    const settle = (value) => {
      done = true;
      stop();
      resolve(value);
    };
    stop = onValue(ref(client.db, path),
      (snap) => settle(snap.val()),
      () => settle(undefined),
    );
    if (done) stop();
  });
}

// ── The owner: the real sync.js, exactly as host.js calls it ────────────────
const owner = makeClient("owner");
const ownerToken = await getAdminAuth(adminApp).createCustomToken("owner-uid-1");
await signInWithCustomToken(owner.auth, ownerToken);
sync.__inject(database, ref(owner.db, EVENT_PATH), "owner-uid-1", owner.db);

await adminDb.ref(EVENT_PATH).remove();

console.log("\n-- a fresh, unclaimed event (no ownerUid yet) — the other real incident --");
// Not through sync.js: this is exactly the moment before its first write ever
// happens, which is the state that broke Setup the second time today.
await adminDb.ref(`${EVENT_PATH}/decks/d000`).set({
  title: "Unclaimed", questionCount: 1,
  questions: { q000: { text: "Only Q", correct: null, voters: {}, options: { a: { label: "A", votes: 0 } } } },
});
ok("a signed-in device can read an unclaimed event's decks in full",
   (await readOnce(owner, `${EVENT_PATH}/decks/d000/questions/q000/text`)) === "Only Q");

console.log("\nwriting two questions and running the poll through the real sync.js");
await sync.saveQuestions([
  { text: "Q1", correct: "a", options: [{ label: "A", votes: 0 }, { label: "B", votes: 0 }], voters: {} },
  { text: "Q2 — SECRET", correct: "b", options: [{ label: "A", votes: 0 }, { label: "B", votes: 0 }], voters: {} },
]);
await sync.setCurrentDeck("d000");
await sync.setCurrentIndex(0);

let ownerLast = null;
sync.onEventChange((event) => { ownerLast = event; });
await tick(1200);

console.log("\n-- the owner's own view, through the real onEventChange() --");
ok("onEventChange() actually delivered something (a listener refused outright never calls back)", ownerLast !== null);
ok("both questions present", ownerLast?.questions.length === 2);
ok("current question is Q1", ownerLast?.currentQuestion?.text === "Q1");
ok("questionCount is 2", ownerLast?.questionCount === 2);

// ── The audience and a second signed-in account: their own connections ──────
const audience = makeClient("audience");
await signInAnonymously(audience.auth);
const viewer = makeClient("viewer");
const viewerToken = await getAdminAuth(adminApp).createCustomToken("some-other-viewer");
await signInWithCustomToken(viewer.auth, viewerToken);

console.log("\n-- mid-run, Q1 current, unrevealed: what the rules actually grant --");
ok("audience reads Q1's text", await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q000/text`) === "Q1");
ok("audience does NOT read Q2's text", await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/text`) === undefined);
ok("audience does NOT read Q1's correct (unrevealed)", await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q000/correct`) === undefined);
ok("a different signed-in account gets the same restriction as audience",
   await readOnce(viewer, `${EVENT_PATH}/decks/d000/questions/q001/text`) === undefined);
ok("a non-owner cannot read the whole deck", await readOnce(viewer, `${EVENT_PATH}/decks`) === undefined);
ok("questionCount is public", await readOnce(audience, `${EVENT_PATH}/decks/d000/questionCount`) === 2);

console.log("\n-- reveal Q1, via the real setRevealed() --");
await sync.setRevealed(true);
await tick(800);
ok("audience now reads Q1's correct", await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q000/correct`) === "a");
ok("audience still cannot read Q2's correct", await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/correct`) === undefined);

console.log("\n-- advance to Q2, via the real setCurrentIndex() --");
await sync.setCurrentIndex(1);
await tick(800);
ok("audience reads Q2's text now", await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/text`) === "Q2 — SECRET");
ok("audience no longer reads Q1's text (moved on)", await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q000/text`) === undefined);
ok("audience does not read Q2's correct yet (unrevealed)", await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/correct`) === undefined);

console.log("\n-- a vote for Q2, cast for real through castVote(), read back --");
ownerLast = null; // repopulated by the still-open owner listener above
await sync.castVote("q001", "a", 1200);
await tick(800);
ok("the vote landed in the owner's own view",
   ownerLast?.currentQuestion?.options?.find((o) => o.id === "a")?.votes === 1);
ok("the audience can read the running tally for the option it can already see",
   await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/options/a/votes`) === 1);

console.log("\n-- finish the run (advance past the last question) --");
await sync.setCurrentIndex(2);
await tick(800);
ok("audience can now read both questions' correct answers (standings need this)",
   (await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q000/correct`)) === "a" &&
   (await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/correct`)) === "b");

console.log("\n-- Clear the room: the players/seen write rules, live --");
const audienceUid = audience.auth.currentUser.uid;
await database.set(database.ref(audience.db, `${EVENT_PATH}/players/${audienceUid}`), "Ana");
await tick(400);
ok("a joined attendee shows up for the owner",
   (await readOnce(owner, `${EVENT_PATH}/players/${audienceUid}`)) === "Ana");

let viewerWipeDenied = false;
try {
  await database.set(database.ref(viewer.db, `${EVENT_PATH}/players`), null);
} catch { viewerWipeDenied = true; }
ok("a non-owner cannot clear the room", viewerWipeDenied);

let viewerOverwriteDenied = false;
try {
  await database.set(database.ref(viewer.db, `${EVENT_PATH}/players`), { hacked: "yes" });
} catch { viewerOverwriteDenied = true; }
ok("or overwrite it with junk instead", viewerOverwriteDenied);

await sync.clearRoom();
await tick(500);
// snap.val() is null for a path that doesn't exist — readOnce only resolves
// undefined on a denial, so a wiped-but-readable node reads back null.
ok("the owner's own Clear the room wipes it", (await readOnce(owner, `${EVENT_PATH}/players/${audienceUid}`)) === null);
ok("without touching the poll underway", (await readOnce(owner, `${EVENT_PATH}/currentIndex`)) === 2);

console.log("\n-- Ratings: ratingStars/ratingColor, read and write, live --");
await sync.saveQuestions([
  { text: "Q1", correct: "a", options: [{ label: "A", votes: 0 }, { label: "B", votes: 0 }], voters: {} },
  { text: "How was it?", correct: null, ratingStars: 5, ratingColor: "purple", voters: {},
    options: ["1", "2", "3", "4", "5"].map((label) => ({ label, votes: 0 })) },
]);
ownerLast = null;
await sync.setCurrentIndex(1);
await tick(1000);
ok("the owner's own view carries the star count", ownerLast?.currentQuestion?.ratingStars === 5);
ok("and the colour", ownerLast?.currentQuestion?.ratingColor === "purple");

ok("the audience can read the current rating's star count",
   (await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/ratingStars`)) === 5);
ok("and its colour",
   (await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/ratingColor`)) === "purple");

console.log("\n-- moving on: the same gate text and options already have --");
await sync.setCurrentIndex(0);
await tick(800);
ok("the audience no longer reads a rating's shape once it's not current",
   (await readOnce(audience, `${EVENT_PATH}/decks/d000/questions/q001/ratingStars`)) === undefined);

console.log("\n-- what the rules refuse to store at all, whoever asks --");
let badCountDenied = false;
try {
  await database.update(database.ref(owner.db, `${EVENT_PATH}/decks/d000/questions/q001`), { ratingStars: 7 });
} catch { badCountDenied = true; }
ok("a star count off the list is refused, even from the owner", badCountDenied);

let badColorDenied = false;
try {
  await database.update(database.ref(owner.db, `${EVENT_PATH}/decks/d000/questions/q001`), { ratingColor: "orange" });
} catch { badColorDenied = true; }
ok("a colour outside the curated list is refused, even from the owner", badColorDenied);

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
