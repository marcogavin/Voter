// A question reaching a phone that isn't the host's.
//
// The host's browser reads the whole deck in one snapshot. Every other device
// is granted one field at a time — the index first, then the question's own
// text, answers and star count, each from its own listener, each a moment
// after the last. Three bugs lived in that gap, and every one of them looked
// like "voting doesn't work for anyone but me":
//
//   - the phone drew the question the moment the index arrived, with no
//     answers to draw, and never rebuilt the rows once they turned up
//   - with no stored count, it counted the one question it could see and
//     called that the poll — so the second question was the closing screen
//   - the refused owner-only reads threw inside their cancel callbacks
//
// The first half drives the real js/sync.js through a fake database that
// answers one path at a time, the way Firebase does. The second half pushes
// what sync.js now hands over through the real js/app.js and js/screen.js.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { screenAt } from "../../js/scores.js";

let failed = 0;
const ok = (label, cond) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (!cond) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

/* ── sync.js, one path at a time ──────────────────────────────────────── */
{
  const sync = await import("../build/sync.js");

  // A database that remembers who is listening where, and answers only when
  // the test says so — a value, or a refusal, the way the rules would.
  const listeners = new Map();
  let written = null;
  const db = {
    ref: (_db, path) => path,
    onValue: (path, cb, refused) => {
      const entry = { cb, refused };
      if (!listeners.has(path)) listeners.set(path, []);
      listeners.get(path).push(entry);
      return () => {
        const list = listeners.get(path);
        list.splice(list.indexOf(entry), 1);
      };
    },
    update: (_ref, payload) => { written = payload; return Promise.resolve(); },
    serverTimestamp: () => "<server-ts>",
  };
  sync.__inject(db, "events/live", "phone-uid", "<db>");

  const E = "events/live/";
  const open = () => [...listeners.keys()].filter((p) => listeners.get(p).length).map((p) => p.replace(E, ""));
  const answer = (path, value) =>
    (listeners.get(E + path) || []).slice().forEach((l) => l.cb({ val: () => value }));
  // Firebase hands a cancelled listener an error, not a snapshot, and catches
  // whatever the callback throws so the SDK carries on. So does this — and
  // it counts the throws, because a page that throws on every refused read
  // is a page with a console full of red that nobody looks at.
  let threw = 0;
  const refuse = (path) =>
    (listeners.get(E + path) || []).slice().forEach((l) => {
      try { l.refused(new Error("permission_denied")); } catch { threw++; }
    });

  let emitted = 0;
  let last = null;
  sync.onEventChange((event) => { emitted++; last = event; });

  console.log("a phone arriving mid-question, as the public fields land");
  for (const [field, value] of [
    ["ownerUid", "owner-uid"], ["currentDeck", "d000"], ["currentIndex", 0],
    ["currentQuestionKey", "q000"], ["revealed", false], ["askedAt", 1000],
    ["pausedAt", null], ["seconds", 30], ["blanked", false], ["lang", "en"],
  ]) answer(field, value);
  answer("players", { "phone-uid": "Ana" });
  answer("seen", {});
  ok("nothing is handed over while the owner-only reads are still out", emitted === 0);

  refuse("decks");
  refuse("questions");
  ok("a refused owner read doesn't throw", threw === 0);
  ok("and nothing is handed over while the question's own fields are still out", emitted === 0);
  ok("which are being listened for, one path each",
     ["text", "options", "correct", "voters", "times", "ratingStars", "ratingColor"]
       .every((f) => open().includes(`decks/d000/questions/q000/${f}`)));

  answer("decks/d000/questionCount", 4);
  answer("decks/d000/likes", 0);
  answer("decks/d000/questions/q000/text", "First?");
  answer("decks/d000/questions/q000/voters", null);
  answer("decks/d000/questions/q000/times", null);
  answer("decks/d000/questions/q000/ratingStars", null);
  answer("decks/d000/questions/q000/ratingColor", null);
  refuse("decks/d000/questions/q000/correct");
  ok("still nothing, with the answers yet to come", emitted === 0);

  answer("decks/d000/questions/q000/options", { a: { label: "A", votes: 0 }, b: { label: "B", votes: 0 } });
  ok("the question arrives once, whole", emitted === 1);
  ok("with its text", last.currentQuestion?.text === "First?");
  ok("and its answers", last.currentQuestion?.options.map((o) => o.id).join() === "a,b");
  ok("and the poll's real length", last.questionCount === 4);
  ok("so the phone is on the question", screenAt(last) === "question");

  console.log("the host reveals the answer");
  const before = open().filter((p) => p.includes("/q000/"));
  emitted = 0;
  answer("revealed", true);
  ok("nothing is handed over until the right answer has been asked for again", emitted === 0);
  ok("the text and answers are not asked for again",
     before.filter((p) => !p.endsWith("/correct")).every((p) => open().includes(p)));
  answer("decks/d000/questions/q000/correct", "b");
  ok("then it arrives, revealed, with the right answer", emitted === 1 && last.revealed && last.currentQuestion.correct === "b");

  console.log("the host moves to the second question");
  emitted = 0;
  answer("currentIndex", 1);
  answer("currentQuestionKey", "q001");
  answer("revealed", false);
  ok("nothing is handed over until it has arrived", emitted === 0);
  ok("q000 is no longer listened for", !open().some((p) => p.includes("/q000/")));
  answer("decks/d000/questions/q001/text", "Second?");
  answer("decks/d000/questions/q001/options", { a: { label: "Yes", votes: 0 } });
  for (const f of ["voters", "times", "ratingStars", "ratingColor"]) answer(`decks/d000/questions/q001/${f}`, null);
  refuse("decks/d000/questions/q001/correct");
  ok("then the second question is up", emitted === 1 && last.currentQuestion?.text === "Second?");
  ok("as question 2 of 4, not the closing screen", screenAt(last) === "question" && last.questionCount === 4);

  console.log("a poll saved before its questions were counted");
  answer("decks/d000/questionCount", null);
  ok("counts as none rather than as the one question this phone can see", last.questionCount === 0);
  ok("so it never lands on the closing screen after one question", screenAt(last) !== "ending");

  console.log("the same poll, run by the host");
  sync.__normalise({ ownerUid: "host", currentDeck: "d000",
    decks: { d000: { title: "Old", questions: {
      q000: { text: "a", options: { a: { label: "A", votes: 0 } } },
      q001: { text: "b", options: { a: { label: "A", votes: 0 } } },
    } } } });
  await sync.setCurrentIndex(0, { starting: true });
  ok("stepping through it stamps the count", written["decks/d000/questionCount"] === 2);
  ok("in the same write as the step, so no phone sees one without the other",
     written.currentIndex === 0 && written.currentQuestionKey === "q000");

  sync.__normalise({ ownerUid: "host", questions: { q000: { text: "a", options: {} } } });
  await sync.setCurrentIndex(0);
  ok("but never on a poll that hasn't moved into decks yet",
     !Object.keys(written).some((k) => k.endsWith("questionCount")));
}

/* ── app.js: the rows are built for what has arrived ─────────────────── */
{
  const page = readFileSync("../../index.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(page, { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: false });
  dom.window.matchMedia = globalThis.matchMedia;

  const sync = await import("../build/sync-audience.js");
  await import("../build/app.js");
  await tick();

  const $ = (id) => document.getElementById(id);
  const visible = (el) => Boolean(el) && !el.hidden && !el.closest("[hidden]");
  const choices = () => [...document.querySelectorAll(".choice")].filter(visible);
  const stars = () => [...document.querySelectorAll(".star-btn")].filter(visible);

  const base = {
    lang: "en", ownerUid: "host", blanked: false, revealed: false, askedAt: Date.now(),
    pausedAt: null, seconds: 30, likes: 0, players: { u1: "Ana" }, seen: {},
    questionCount: 3, questions: [],
  };
  const q = (over = {}) => ({ id: "q000", text: "First?", correct: null, voters: {}, times: {},
    ratingStars: null, ratingColor: null, options: [], ...over });
  const push = (over) => sync.state.push({ ...base, ...over });

  console.log("a phone on the waiting screen, as the host puts a question up");
  push({ currentIndex: -1, currentQuestion: null });
  ok("is waiting", $("options").dataset.screen === "waiting");
  push({ currentIndex: 0, currentQuestion: null });
  ok("keeps waiting while the question is on its way", $("options").dataset.screen === "waiting");
  ok("with no clock for a question it can't see", $("clock").hidden);

  push({ currentIndex: 0, currentQuestion: q({ options: [
    { id: "a", label: "A", votes: 0 }, { id: "b", label: "B", votes: 0 },
  ] }) });
  ok("then shows it", $("question").textContent === "First?");
  ok("with both answers to tap", choices().length === 2);
  ok("and the clock", !$("clock").hidden);

  console.log("the same question, once its shape has changed under it");
  push({ currentIndex: 0, currentQuestion: q({ options: [
    { id: "a", label: "A", votes: 0 }, { id: "b", label: "B", votes: 0 }, { id: "c", label: "C", votes: 0 },
  ] }) });
  ok("a third answer gets a row", choices().length === 3);
  ok("in order", choices().map((c) => c.dataset.id).join() === "a,b,c");

  push({ currentIndex: 0, currentQuestion: q({ ratingStars: 3, ratingColor: "gold", options: [
    { id: "a", label: "1", votes: 0 }, { id: "b", label: "2", votes: 0 }, { id: "c", label: "3", votes: 0 },
  ] }) });
  ok("a star count turning up makes it a row of stars", stars().length === 3 && choices().length === 0);

  console.log("the host moves on");
  push({ currentIndex: 1, currentQuestion: null });
  ok("the last question stays up while the next is on its way",
     $("question").textContent === "First?" && stars().length === 3);
  ok("nothing is tappable on it", stars().every((s) => s.disabled) || $("status").hidden);

  push({ currentIndex: 1, currentQuestion: q({ id: "q001", text: "Second?", options: [
    { id: "a", label: "Yes", votes: 0 }, { id: "b", label: "No", votes: 0 },
  ] }) });
  ok("then the next one is up", $("question").textContent === "Second?");
  ok("with its own answers", choices().length === 2 && stars().length === 0);
  ok("as question 2 of 3", $("progress").textContent === "Question 2 of 3");
}

/* ── screen.js: the wall holds what it has ───────────────────────────── */
{
  const page = readFileSync("../../screen.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(page, { url: "https://votr.example/votr/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.matchMedia = () => ({ matches: false });
  dom.window.matchMedia = globalThis.matchMedia;

  const sync = await import("../build/screen.js");
  await tick();

  const stage = () => document.getElementById("stage");
  const base = {
    lang: "en", ownerUid: "host", blanked: false, revealed: false, askedAt: Date.now(),
    pausedAt: null, seconds: 30, likes: 0, players: { u1: "Ana" }, seen: { u1: Date.now() },
    questionCount: 2, questions: [],
  };
  const push = (over) => sync.state.push({ ...base, ...over });
  const question = { id: "q000", text: "First?", correct: null, voters: {}, times: {},
    ratingStars: null, ratingColor: null,
    options: [{ id: "a", label: "A", votes: 0 }, { id: "b", label: "B", votes: 0 }] };

  console.log("the wall, as a question is put up");
  push({ currentIndex: -1, currentQuestion: null });
  ok("shows the way in", stage().dataset.screen === "join");
  let crashed = false;
  try { push({ currentIndex: 0, currentQuestion: null }); } catch { crashed = true; }
  ok("survives the index arriving before the question", !crashed);
  ok("and keeps the way in up meanwhile", stage().dataset.screen === "join");
  push({ currentIndex: 0, currentQuestion: question });
  ok("then shows the question", stage().dataset.screen === "question"
     && stage().querySelector(".big-question").textContent === "First?");

  push({ currentIndex: 1, currentQuestion: null });
  ok("and holds it while the next is on its way", stage().querySelector(".big-question").textContent === "First?");
  ok("rather than flashing the join code", stage().dataset.screen === "question");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
