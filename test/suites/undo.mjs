// Taking a deletion back, through the real js/host.js and the real js/sync.js.
//
// Deleting a question used to be instant and final, with nothing asked and
// nothing to press afterwards. A poll asked first, but never said the answer
// was for good. Now both offer Undo for a few seconds, and a poll's question
// says plainly what happens after that.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const shown = (el) => Boolean(el) && !el.hidden && !el.closest("[hidden]");

/* ── sync.js: what deleting a poll hands back, and putting it back ─────── */
{
  const sync = await import("../build/sync.js");
  const writes = [];
  sync.__inject({
    update: (_ref, payload) => { writes.push(payload); return Promise.resolve(); },
    serverTimestamp: () => "<ts>",
  }, "<ref>", "host-uid");

  const deck = {
    title: "Offsite", questionCount: 1, likes: 7,
    questions: { q000: { text: "Q", correct: "a", voters: { u1: "a" }, times: { u1: 900 },
      options: { a: { label: "A", votes: 1 }, b: { label: "B", votes: 0 } } } },
  };
  sync.__normalise({ ownerUid: "host-uid", currentDeck: "d001", decks: { d000: { title: "Other" }, d001: deck } });

  console.log("deleting a poll");
  const removed = await sync.deleteDeck("d001", ["d000", "d001"]);
  ok("removes it", writes.at(-1)["decks/d001"] === null);
  ok("hands back everything that was in it", JSON.stringify(removed) === JSON.stringify(deck));
  ok("its votes and times included", removed.questions.q000.voters.u1 === "a" && removed.questions.q000.times.u1 === 900);

  console.log("putting it back");
  let id = await sync.restoreDeck("d001", removed, { live: true, existingIds: ["d000"] });
  ok("under its own id", id === "d001" && JSON.stringify(writes.at(-1)["decks/d001"]) === JSON.stringify(deck));
  ok("and live again, from the top, since it was live", writes.at(-1).currentDeck === "d001" && writes.at(-1).currentIndex === -1);

  id = await sync.restoreDeck("d001", removed, { live: false, existingIds: ["d000", "d001"] });
  ok("under a new id if one made since has taken it, overwriting nothing", id === "d002" && !("decks/d001" in writes.at(-1)));
  ok("and left alone if it wasn't live", !("currentDeck" in writes.at(-1)));

  console.log("a device that never had it");
  sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000", decks: { d000: { title: "A", questions: {}, partial: true } } });
  ok("has nothing to hand back", (await sync.deleteDeck("d009", ["d000", "d009"])) === null);
}

/* ── host.js: the bar, and what pressing it does ───────────────────────── */
{
  const page = readFileSync("../../host.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(page, { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: false });
  dom.window.matchMedia = globalThis.matchMedia;
  dom.window.localStorage.setItem("votr-tour-seen", "1");
  globalThis.location = dom.window.location;

  // The bar's own thirty seconds, and the tick that counts them down, held so
  // the test decides when time passes.
  const realTimeout = globalThis.setTimeout;
  const realInterval = globalThis.setInterval;
  let undoExpiry = null;
  let undoTick = null;
  globalThis.setTimeout = (fn, ms, ...rest) => {
    if (ms === 30000) { undoExpiry = fn; return 0; }
    return realTimeout(fn, ms, ...rest);
  };
  globalThis.setInterval = (fn, ms, ...rest) => {
    if (ms === 200) { undoTick = fn; return 0; }
    return realInterval(fn, ms, ...rest);
  };
  const realNow = Date.now;
  const later = (ms) => { const now = realNow() + ms; Date.now = () => now; undoTick?.(); Date.now = realNow; };

  const sync = await import("../build/sync-host.js");
  await import("../build/host.js");
  await tick();
  const $ = (id) => document.getElementById(id);
  const called = (name) => sync.state.calls.filter((c) => c.name === name);

  const q = (id, text, votes = 0) => ({
    id, kind: "question", text, body: "", correct: null, voters: votes ? { u1: "a" } : {}, times: {},
    options: [{ id: "a", label: "A", votes }, { id: "b", label: "B", votes: 0 }],
  });
  const slide = { id: "q001", kind: "slide", text: "Break", body: "", correct: null, voters: {}, options: [] };
  const QUESTIONS = [q("q000", "First?"), slide, q("q002", "Third?", 3)];
  const DECKS = [
    { id: "d000", title: "Kickoff", count: 3 },
    { id: "d001", title: "Ice breaker", count: 2 },
  ];
  const snap = (over = {}) => sync.state.push({
    ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
    blanked: false, askedAt: 0, seconds: 30, lang: "en", likes: 0, players: {}, seen: {},
    decks: DECKS, questions: QUESTIONS, ...over,
  });
  const del = async (index) => {
    document.querySelectorAll(".qitem")[index].querySelector('[data-act="del"]').click();
    await tick(); await tick();
  };

  console.log("before anything is deleted");
  snap();
  ok("there is no bar", !shown($("undo")));

  console.log("deleting a question");
  sync.state.calls = [];
  await del(2);
  const saved = called("saveQuestions").at(-1)?.arg ?? [];
  ok("happens at once — nothing asked", !shown($("ask-overlay")) && saved.length === 2);
  ok("and offers it back", shown($("undo")) && $("undo-text").textContent === "Question deleted");
  ok("with a button that says so", $("undo-btn").textContent.trim() === "Undo" && !$("undo-btn").disabled);
  ok("for thirty seconds, and it says so", shown($("undo-time")) && $("undo-time").textContent === "30s");
  later(12000);
  ok("counting down as they pass", $("undo-time").textContent === "18s");
  later(29500);
  ok("down to the last one", $("undo-time").textContent === "1s");

  console.log("pressing Undo");
  // The deletion has landed; meanwhile a vote arrives on the first question.
  snap({ questions: [q("q000", "First?", 5), slide] });
  sync.state.calls = [];
  $("undo-btn").click();
  await tick(); await tick();
  const back = called("saveQuestions").at(-1)?.arg ?? [];
  ok("puts it back where it was", back.map((x) => x.text).join("|") === "First?|Break|Third?");
  ok("with its votes", back[2]?.options[0].votes === 3 && back[2]?.voters.u1 === "a");
  ok("without undoing the vote that came in since", back[0]?.options[0].votes === 5);
  ok("and the bar goes", !shown($("undo")));

  console.log("deleting a text slide");
  snap();
  await del(1);
  ok("says it was a text slide", $("undo-text").textContent === "Text slide deleted");

  console.log("letting the thirty seconds run out");
  undoExpiry?.();
  await tick();
  ok("the bar goes by itself", !shown($("undo")));

  console.log("deleting what's on screen's neighbour, mid-run");
  snap({ currentIndex: 2 });
  sync.state.calls = [];
  await del(0);
  ok("what's on screen moves up with it", called("setCurrentIndex").at(-1)?.arg === 1);
  snap({ currentIndex: 1, questions: [slide, q("q002", "Third?", 3)] });
  sync.state.calls = [];
  $("undo-btn").click();
  await tick(); await tick();
  ok("and back down once it's undone, so the same question is still up", called("setCurrentIndex").at(-1)?.arg === 2);

  console.log("deleting a poll");
  snap();
  $("deck-open").click();
  await tick();
  [...document.querySelectorAll(".pollitem")][1].querySelector('[data-act="delete"]').click();
  await tick();
  ok("asks first", shown($("ask-overlay")));
  ok("saying there's a moment to undo it", /few seconds to undo/.test($("ask-title").textContent));
  ok("and that after that it's gone for good", /gone for good/.test($("ask-title").textContent));
  sync.state.calls = [];
  sync.state.removedDeck = { title: "Ice breaker", questionCount: 2, questions: { q000: { text: "Hi" } } };
  $("ask-form").dispatchEvent(new dom.window.Event("submit"));
  await tick(); await tick(); await tick();
  ok("deletes it", called("deleteDeck").at(-1)?.arg === "d001");
  ok("then offers it back by name", shown($("undo")) && $("undo-text").textContent === "“Ice breaker” deleted");
  $("undo-btn").click();
  await tick(); await tick();
  const restored = called("restoreDeck").at(-1);
  ok("Undo puts the whole poll back", restored?.arg === "d001" && restored?.data.questions.q000.text === "Hi");
  ok("not made live, since it wasn't", restored?.options.live === false);

  console.log("an account that isn't the owner");
  snap();
  await del(0);
  snap({ ownerUid: "someone-else" });
  ok("can't press Undo on the owner's behalf", $("undo-btn").disabled);

  globalThis.setTimeout = realTimeout;
  globalThis.setInterval = realInterval;
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
