// The big screen, driven through the real js/screen.js.
//
// It is the one page in the app that must never write, and the one that has
// to agree with every phone in the room about which screen is up — so both
// of those are what this checks, along with the two things that are only
// true here: the code in the corner, and a leaderboard that stops before it
// falls off the bottom.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const page = readFileSync("../../screen.html", "utf8")
  .replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://votr.example/votr/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location;
globalThis.matchMedia = () => ({ matches: false });
dom.window.matchMedia = globalThis.matchMedia;

const sync = await import("../build/screen.js");
await tick();

const $ = (id) => document.getElementById(id);
const stage = () => $("stage");
const screen = () => stage().dataset.screen;
const text = (sel) => stage().querySelector(sel)?.textContent ?? null;

const now = Date.now();
sync.state.now = () => now;

const q = (id, opts, over = {}) => ({
  id, text: `Question ${id}`, correct: null, voters: {},
  options: opts.map(([oid, label, votes]) => ({ id: oid, label, votes })),
  ...over,
});

const EVENT = {
  lang: "en", ownerUid: "host", currentDeck: "d000", currentIndex: -1,
  revealed: false, blanked: false, askedAt: now - 10000, pausedAt: null,
  seconds: 30, likes: 7,
  players: { u1: "Marco", u2: "Ana", u3: "Bo" },
  // Everyone awake just now. A name with no entry here is somebody who left.
  seen: { u1: now, u2: now, u3: now },
  decks: [{ id: "d000", title: "Kickoff", count: 2 }],
  questions: [
    q("q0", [["a", "Yes", 2], ["b", "No", 1]]),
    q("q1", [["a", "Lisbon", 1], ["b", "Zurich", 2]],
      { correct: "b", voters: { u1: "b", u2: "b", u3: "a" } }),
  ],
};
const at = (over) => ({ ...EVENT, ...over });

console.log("nothing on screen yet");
sync.state.push(at({}));
ok("the wall is the way in", screen() === "join");
ok("with the address it was opened from", text(".big-url") === "votr.example/votr");
ok("drawn as a code", Boolean(stage().querySelector(".big-code svg")));
ok("and who is already here", $("tally").textContent === "3 in the room");
ok("the corner code stays out of its own screen", $("join").hidden);
ok("and nothing else — no poll title on the wall", $("poll") === null);

console.log("an empty room");
sync.state.push(at({ players: {} }));
ok("says so rather than saying 0", $("tally").textContent === "Nobody has joined yet");
sync.state.push(at({ players: { u1: "Marco" } }));
ok("and counts one properly", $("tally").textContent === "1 in the room");

console.log("an opinion question");
sync.state.push(at({ currentIndex: 0 }));
ok("is the question", screen() === "question");
ok("read out with its letters", text(".big-key") === "A");
ok("shares are live — there is nothing to copy",
   stage().querySelectorAll(".big-choice.is-counted").length === 2);
ok("two of the three votes went to the first", text(".big-pct") === "67%");
ok("the clock is running", !$("clock").hidden);
ok("with the seconds left on it", $("clock-time").textContent === "20s");
ok("the room is counted, against how many are in it",
   $("votes").textContent === "Votes 3/3" && !$("votes").hidden);
ok("and where it is in the poll", $("progress").textContent === "Question 1 of 2");

console.log("a tab somebody left open this morning");
const oneVote = [q("q0", [["a", "Yes", 1], ["b", "No", 0]]), EVENT.questions[1]];
sync.state.push(at({ currentIndex: 0, questions: oneVote }));
ok("counts against everyone who is awake", $("votes").textContent === "Votes 1/3");
sync.state.push(at({
  currentIndex: 0, questions: oneVote,
  seen: { u1: now, u2: now, u3: now - 2 * 60 * 60 * 1000 },
}));
ok("and an hour-old tab stops being one of them",
   $("votes").textContent === "Votes 1/2");
sync.state.push(at({ currentIndex: 0, questions: oneVote, seen: {} }));
ok("a room nobody has reported from says nothing at all", $("votes").hidden);

console.log("more votes than people still here");
sync.state.push(at({
  currentIndex: 0, seen: { u1: now, u2: now - 2 * 60 * 60 * 1000, u3: now - 2 * 60 * 60 * 1000 },
}));
ok("says everyone is in rather than 3/1",
   $("votes").textContent === "Votes 3/3" &&
     $("votes").className.includes("is-all"));
sync.state.push(at({ currentIndex: 0 }));
ok("the code moves into the corner", !$("join").hidden);
ok("and the count is up at the top with it", !$("votes").hidden);

console.log("a question with a right answer");
sync.state.push(at({ currentIndex: 1 }));
ok("holds its shares back", stage().querySelectorAll(".big-choice.is-counted").length === 0);
ok("showing no percentage at all", text(".big-pct") === "");
ok("but still says how many have answered", $("votes").textContent === "Votes 3/3");

console.log("revealed");
sync.state.push(at({ currentIndex: 1, revealed: true }));
ok("the shares land", stage().querySelectorAll(".big-choice.is-counted").length === 2);
ok("the right answer is marked", Boolean(stage().querySelector(".big-choice.is-right")));
ok("and it is the right one",
   stage().querySelector(".big-choice.is-right").dataset.id === "b");
ok("the clock is gone with the voting", $("clock").hidden);

console.log("time up, without a reveal");
sync.state.now = () => now + 40000;
sync.state.push(at({ currentIndex: 1 }));
ok("the shares land anyway", stage().querySelectorAll(".big-choice.is-counted").length === 2);
ok("and the clock goes", $("clock").hidden);

console.log("the host hides the screen");
sync.state.now = () => now + 60000;
sync.state.push(at({ currentIndex: 0, blanked: true, pausedAt: now + 5000 }));
ok("the wall shows the way in, not a blank rectangle", screen() === "join");
sync.state.push(at({ currentIndex: 0, pausedAt: null, askedAt: now + 55000 }));
ok("and the clock comes back where it was", $("clock-time").textContent === "25s");

console.log("the host edits the question that is already up");
sync.state.now = () => now;
sync.state.push(at({ currentIndex: 0 }));
sync.state.push(at({ currentIndex: 0, questions: [
  { ...EVENT.questions[0], text: "Question q0, but fixed",
    options: [{ id: "a", label: "Definitely", votes: 3 }, { id: "b", label: "No", votes: 1 }] },
  EVENT.questions[1],
] }));
ok("the wall reads what the host wrote", text(".big-question") === "Question q0, but fixed");
ok("answers and all", text(".big-label") === "Definitely");
sync.state.push(at({ currentIndex: 0, questions: [
  { ...EVENT.questions[0], options: [{ id: "a", label: "Only one now", votes: 3 }] },
  EVENT.questions[1],
] }));
ok("an answer removed is a row removed",
   stage().querySelectorAll(".big-choice").length === 1);

console.log("the end");
sync.state.push(at({ currentIndex: 2, revealed: true }));
ok("is the standings", screen() === "scores");
ok("everyone who answered", stage().querySelectorAll(".board-row").length === 3);
ok("winners first", text(".board-name") === "Ana");
ok("marked as winners", stage().querySelector(".board-row").className.includes("is-first"));
ok("nobody is 'you' on a wall", !stage().querySelector(".board-row.is-me"));
ok("and no corner code inviting people to a finished poll", $("join").hidden);
ok("nor a count of votes on a poll that is over", $("votes").hidden);

sync.state.push(at({ currentIndex: 3, revealed: true }));
ok("one press further is the applause", screen() === "ending");
ok("with the count so far", $("big-count").textContent === "7");
sync.state.push(at({ currentIndex: 3, revealed: true, likes: 11 }));
ok("four more taps, four more hearts",
   stage().querySelectorAll(".heart-fly").length === 4);
ok("and the count keeps up", $("big-count").textContent === "11");

console.log("a full room at the end");
const many = {};
for (let i = 0; i < 20; i++) many["p" + i] = "Player " + i;
sync.state.push(at({
  currentIndex: 1, revealed: true, players: many,
  questions: [q("q0", [["a", "A", 20], ["b", "B", 0]], {
    correct: "a", voters: Object.fromEntries(Object.keys(many).map((u) => [u, "a"])),
  })],
}));
// How many actually show is measured against the display — see wall-fit,
// which drives a real browser. Here there is no layout to measure, so what
// this pins is the ceiling and the arithmetic under it.
ok("never more names than a wall would hold",
   stage().querySelectorAll(".board-row").length === 14);
ok("and the rest are counted, not dropped", text(".board-more") === "+6 more");
ok("in one column, whatever the number",
   stage().querySelectorAll(".board").length === 1 &&
     stage().querySelectorAll(".board-row").length ===
       stage().querySelector(".board").children.length - 1);

console.log("a poll with no right answers");
sync.state.push(at({ currentIndex: 1, questions: [EVENT.questions[0]] }));
ok("skips the standings, like every other screen does", screen() === "ending");

console.log("the language belongs to the event");
sync.state.push(at({ lang: "de", currentIndex: -1 }));
ok("the wall follows it", text(".big-title") === "Scanne den Code und mach mit");
ok("footer and all", $("tally").textContent === "3 im Raum");

console.log("what it never does");
ok("no vote, no name, no applause — it only reads", sync.state.calls.length === 0);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
