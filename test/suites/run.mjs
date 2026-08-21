import * as sync from "../build/sync.js";

let captured = null;
const db = {
  update: (ref, payload) => { captured = payload; return Promise.resolve(); },
  serverTimestamp: () => "<server-ts>",
  increment: (n) => ({ increment: n }),
};
sync.__inject(db, "<eventRef>", "host-uid");

let failures = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log("  ✓", name); }
  else { failures++; console.log("  ✗", name, "\n      got:", a, "\n     want:", b); }
};

const q = (text) => ({ text, options: { a: { label: "yes", votes: 3 }, b: { label: "no", votes: 1 } } });

/* 1 — an event written before surveys existed */
console.log("\nlegacy event (questions at the top level, no decks node)");
let ev = sync.__normalise({ ownerUid: "host-uid", questions: { q000: q("one"), q001: q("two") } });
eq("one survey, unnamed", ev.decks, [{ id: "d000", title: "", count: 2, createdAt: null, lastRunAt: null }]);
eq("it is the live one", ev.currentDeck, "d000");
eq("questions come through", ev.questions.map(x => x.text), ["one", "two"]);
eq("votes come through", ev.questions[0].options.map(o => o.votes), [3, 1]);
eq("still reading the old path", sync.__state().questionsPath, "questions");

await sync.castVote("q000", "a");
eq("a vote lands where the counters are", Object.keys(captured),
   ["questions/q000/options/a/votes", "questions/q000/voters/host-uid"]);

/* 2 — the first save migrates */
console.log("\nfirst save after the upgrade");
await sync.saveQuestions([{ text: "one", correct: null, options: [{ label: "yes", votes: 3 }], voters: {} }]);
eq("old node cleared", captured.questions, null);
eq("title materialised", captured["decks/d000/title"], "");
eq("saved content wins over the migrated copy",
   Object.keys(captured["decks/d000/questions"].q000.options).length, 1);
eq("votes preserved through the move", captured["decks/d000/questions"].q000.options.a.votes, 3);

/* 3 — creating a second survey while still on legacy data */
console.log("\nnew survey from legacy data");
sync.__normalise({ ownerUid: "host-uid", questions: { q000: q("one") } });
await sync.newDeck("Product quiz", ["d000"]);
eq("legacy questions rescued", !!captured["decks/d000/questions"], true);
eq("old node cleared", captured.questions, null);
eq("new survey named", captured["decks/d001/title"], "Product quiz");
eq("and made live, from the top", [captured.currentDeck, captured.currentIndex, captured.revealed],
   ["d001", -1, false]);

/* 4 — normal life, once migrated */
console.log("\nmigrated event");
ev = sync.__normalise({
  ownerUid: "host-uid", currentDeck: "d001",
  decks: { d000: { title: "Offsite", questions: { q000: q("a") } },
           d001: { title: "Quiz", questions: { q000: q("b"), q001: q("c") } } },
});
eq("both surveys listed with counts", ev.decks, [
  { id: "d000", title: "Offsite", count: 1, createdAt: null, lastRunAt: null },
  { id: "d001", title: "Quiz", count: 2, createdAt: null, lastRunAt: null }]);
eq("live one unpacked", ev.questions.length, 2);
eq("path follows the live survey", sync.__state().questionsPath, "decks/d001/questions");

await sync.castVote("q000", "b");
eq("votes go to the live survey", Object.keys(captured),
   ["decks/d001/questions/q000/options/b/votes", "decks/d001/questions/q000/voters/host-uid"]);

await sync.saveQuestions([{ text: "x", correct: null, options: [{ label: "y", votes: 0 }], voters: {} }]);
eq("no migration writes once migrated", Object.keys(captured),
   ["ownerUid", "decks/d001/questions", "decks/d001/questionCount"]);

await sync.resetVotes({ id: "q000", options: [{ id: "a" }, { id: "b" }] });
eq("reset targets the live survey, times and all", Object.keys(captured), [
  "decks/d001/questions/q000/voters",
  "decks/d001/questions/q000/times",
  "decks/d001/questions/q000/options/a/votes",
  "decks/d001/questions/q000/options/b/votes"]);

/* 5 — deleting */
console.log("\ndeleting");
await sync.deleteDeck("d001", ["d000", "d001"]);
eq("gone, and the room moved to the survivor",
   [captured["decks/d001"], captured.currentDeck, captured.currentIndex], [null, "d000", -1]);

await sync.deleteDeck("d000", ["d000", "d001"]);
eq("deleting a non-live survey leaves the room alone",
   [captured["decks/d000"], captured.currentDeck], [null, undefined]);

let threw = null;
try { sync.deleteDeck("d001", ["d001"]); } catch (e) { threw = e.message; }
eq("the last survey can't be deleted", threw, "An event has to keep at least one poll.");

/* 6 — id allocation */
console.log("\nsurvey ids");
sync.__normalise({ decks: { d000: {}, d001: {} } });
await sync.newDeck("t", ["d000", "d001"]);
eq("next in sequence", Object.keys(captured).find(k => k.endsWith("/title")), "decks/d002/title");
await sync.newDeck("t", ["d000", "d005"]);
eq("past a gap, never reissuing", Object.keys(captured).find(k => k.endsWith("/title")), "decks/d006/title");

/* 7 — edge cases */
console.log("\nedges");
ev = sync.__normalise(null);
eq("empty database still has one survey", ev.decks, [{ id: "d000", title: "", count: 0, createdAt: null, lastRunAt: null }]);
eq("and no questions", ev.questions, []);

ev = sync.__normalise({ currentDeck: "d999", decks: { d000: { title: "Only" } } });
eq("a currentDeck pointing at nothing falls back", ev.currentDeck, "d000");

ev = sync.__normalise({ decks: { d010: { title: "j" }, d002: { title: "b" }, d001: { title: "a" } } });
eq("surveys sort by key, not insertion", ev.decks.map(d => d.id), ["d001", "d002", "d010"]);


/* 8 — the closing screen's applause */
console.log("\nlikes");
ev = sync.__normalise({ ownerUid: "host-uid", currentDeck: "d001",
  decks: { d000: { title: "A" }, d001: { title: "B", likes: 7 } } });
eq("read from the live survey", ev.likes, 7);
await sync.likePoll();
eq("increments the live survey only", captured, { "decks/d001/likes": { increment: 1 } });

ev = sync.__normalise({ decks: { d000: { title: "A" } } });
eq("absent means none yet", ev.likes, 0);

ev = sync.__normalise({ ownerUid: "u", questions: { q000: q("one") } });
eq("legacy events have none either", ev.likes, 0);


/* 9 — who is in the room */
console.log("\nnames");
ev = sync.__normalise({ ownerUid: "host-uid", players: { "host-uid": "Marco", u2: "Ana" },
  decks: { d000: { title: "A" } } });
eq("everyone is readable", ev.players, { "host-uid": "Marco", u2: "Ana" });
eq("this device finds its own", ev.players["host-uid"], "Marco");

await sync.saveName("Marco G");
eq("a name is written under its own uid only", captured, { "players/host-uid": "Marco G" });

ev = sync.__normalise({ decks: { d000: { title: "A" } } });
eq("nobody has joined yet", ev.players, {});
ev = sync.__normalise({ ownerUid: "u", questions: { q000: q("one") } });
eq("a legacy event has no players either", ev.players, {});

/* 10 — the clock on a vote */
console.log("\ntiming a vote");
sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000",
  decks: { d000: { title: "Quiz", questions: { q000: q("one") } } } });

await sync.castVote("q000", "a", 4200);
eq("the time rides along with the vote, in one write", Object.keys(captured), [
  "decks/d000/questions/q000/options/a/votes",
  "decks/d000/questions/q000/voters/host-uid",
  "decks/d000/questions/q000/times/host-uid"]);
eq("rounded to a whole millisecond", captured["decks/d000/questions/q000/times/host-uid"], 4200);

await sync.castVote("q000", "a", 4200.7);
eq("even when the clock hands over a fraction",
   captured["decks/d000/questions/q000/times/host-uid"], 4201);

await sync.castVote("q000", "a", null);
eq("an untimed poll writes no time", Object.keys(captured), [
  "decks/d000/questions/q000/options/a/votes",
  "decks/d000/questions/q000/voters/host-uid"]);

// The repository is the documentation; the console is what enforces. Until
// the rules are republished the whole atomic write is refused — and a room
// that can't vote is a worse outcome than one that isn't being timed.
console.log("\nrules that don't know about times yet");
const tries = [];
db.update = (ref, payload) => {
  tries.push(Object.keys(payload));
  captured = payload;
  return tries.length === 1
    ? Promise.reject(new Error("PERMISSION_DENIED"))
    : Promise.resolve();
};
await sync.castVote("q000", "b", 900);
eq("it is tried with the time first", tries[0].length, 3);
eq("then again without it", tries[1], [
  "decks/d000/questions/q000/options/b/votes",
  "decks/d000/questions/q000/voters/host-uid"]);
eq("so the vote still lands", tries.length, 2);

db.update = (ref, payload) => { captured = payload; return Promise.resolve(); };

/* 11 — keeping the times through an edit */
console.log("\nediting a question that has been answered");
sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000",
  decks: { d000: { title: "Quiz", questions: { q000: q("one") } } } });
await sync.saveQuestions([{
  text: "one, fixed", correct: "a", options: [{ label: "yes", votes: 3 }],
  voters: { u1: "a" }, times: { u1: 4200 },
}]);
eq("the answers survive", captured["decks/d000/questions"].q000.voters, { u1: "a" });
eq("and so does how long they took",
   captured["decks/d000/questions"].q000.times, { u1: 4200 });

await sync.resetAllVotes([{ id: "q000", options: [{ id: "a" }] }]);
eq("starting over clears the stopwatch too",
   captured["decks/d000/questions/q000/times"], null);

/* 12 — saying you are still here */
console.log("\nreporting for the room count");
sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000",
  decks: { d000: { title: "Quiz", questions: { q000: q("one") } } } });

await sync.touch();
eq("one field, under this device's own uid", Object.keys(captured), ["seen/host-uid"]);
eq("stamped by the server, not by the phone", captured["seen/host-uid"], "<server-ts>");

await sync.castVote("q000", "a", 1200);
eq("a vote carries no heartbeat with it — a refused one must not cost the vote",
   Object.keys(captured).some((k) => k.startsWith("seen/")), false);

await sync.saveName("Marco");
eq("nor does a name", Object.keys(captured), ["players/host-uid"]);

// A heartbeat that the rules haven't been taught yet is a place in a count,
// not a vote. It must never surface as a failure.
db.update = () => Promise.reject(new Error("PERMISSION_DENIED"));
let surfaced = false;
await sync.touch().catch(() => { surfaced = true; });
eq("a refused heartbeat is swallowed", surfaced, false);
db.update = (ref, payload) => { captured = payload; return Promise.resolve(); };

const withSeen = sync.__normalise({ ownerUid: "host-uid", players: { u1: "Ana" },
  seen: { u1: 1755689400000 }, decks: { d000: { title: "A" } } });
eq("and it is read back for everyone", withSeen.seen, { u1: 1755689400000 });
eq("an event with none reads as an empty room",
   sync.__normalise({ decks: { d000: {} } }).seen, {});

/* 13 — what the rules need, so a device isn't trusted to read ahead */
console.log("\nthe current question, by key rather than by place in line");
db.update = (ref, payload) => { captured = payload; return Promise.resolve(); };

await sync.setCurrentIndex(2);
eq("the key rides with the index", captured.currentQuestionKey, "q002");
await sync.setCurrentIndex(-1);
eq("and clears with it", captured.currentQuestionKey, null);

sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000",
  decks: { d000: { title: "Quiz", questions: {
    q000: q("one"), q001: q("two"), q002: q("three") } } } });
await sync.saveQuestions([
  { text: "a", correct: null, options: [{ label: "x", votes: 0 }] },
  { text: "b", correct: null, options: [{ label: "x", votes: 0 }] },
  { text: "c", correct: null, options: [{ label: "x", votes: 0 }] },
]);
eq("and the deck's total is saved alongside it, for the same reason",
   captured["decks/d000/questionCount"], 3);

// This is what a device actually gets back once the rules only grant it the
// question it's looking at: everything else in the deck is simply absent,
// not merely empty. `readQuestions` on that partial map still has to find
// the *right* one — indexing into it by array position, the way this worked
// before, would reach for position 2 of a one-item array and find nothing.
ev = sync.__normalise({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: 2,
  decks: { d000: {
    title: "Quiz", questionCount: 5,
    questions: { q002: q("the one being asked") },
  } },
});
eq("the current question is still found, by its key",
   ev.currentQuestion?.text, "the one being asked");
eq("even though the array a device was handed holds only that one",
   ev.questions.length, 1);
eq("the total comes from the deck's own count, not from counting what arrived",
   ev.questionCount, 5);

ev = sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1,
  decks: { d000: { title: "Quiz", questionCount: 0, questions: {} } } });
eq("nothing on screen means no current question", ev.currentQuestion, null);

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
