// Slides: words on the screen between two questions, with nothing to answer.
//
// Driven through the real js/sync.js (what is saved, and what is read back),
// the real js/host.js (writing one, and running it), the real js/app.js (a
// phone on a slide) and the real js/screen.js (the wall on a slide). How a
// slide is fitted to the wall is a matter of real layout, and is measured in
// a real browser by slidefit.mjs instead.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const shown = (el) => Boolean(el) && !el.hidden && !el.closest("[hidden]");

const choiceQ = (id, text, number = null) => ({
  id, kind: "question", text, body: "", number, correct: "a", voters: {}, times: {},
  ratingStars: null, ratingColor: null,
  options: [{ id: "a", label: "Yes", votes: 0 }, { id: "b", label: "No", votes: 0 }],
});
const slideQ = (id, text, body) => ({
  id, kind: "slide", text, body, number: null, correct: null, voters: {}, times: {},
  ratingStars: null, ratingColor: null, options: [],
});

/* ── sync.js: what a slide is in the database ────────────────────────── */
{
  const sync = await import("../build/sync.js");
  let captured = null;
  sync.__inject({
    update: (_ref, payload) => { captured = payload; return Promise.resolve(); },
    serverTimestamp: () => "<ts>",
  }, "<ref>", "host-uid");
  sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000", decks: { d000: { title: "A" } } });

  console.log("saving a poll with a slide in it");
  await sync.saveQuestions([
    { text: "First?", correct: "a", options: [{ label: "Yes" }, { label: "No" }], voters: {} },
    { kind: "slide", text: "Coffee break", body: "Back at 11:00", options: [] },
    { kind: "slide", text: "", body: "Just text", options: [] },
    { text: "Second?", correct: null, options: [{ label: "A" }, { label: "B" }], voters: {} },
  ]);
  const stored = captured["decks/d000/questions"];
  ok("a slide is stored as a slide", stored.q001.kind === "slide");
  ok("with its heading and text", stored.q001.text === "Coffee break" && stored.q001.body === "Back at 11:00");
  ok("and nothing to answer", !("options" in stored.q001) && !("correct" in stored.q001));
  ok("a slide with no heading stores no empty one", !("text" in stored.q002) && stored.q002.body === "Just text");
  ok("questions are numbered without the slides", stored.q000.number === 1 && stored.q003.number === 2);
  ok("and the poll says how many questions it has", captured["decks/d000/numbered"] === 2);
  ok("while every step still counts as a step", captured["decks/d000/questionCount"] === 4);

  console.log("saving a poll with no slides");
  sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000", decks: { d000: { title: "A" } } });
  await sync.saveQuestions([{ text: "Only?", correct: null, options: [{ label: "A" }, { label: "B" }], voters: {} }]);
  ok("writes no numbers at all — nothing older rules would refuse",
     !("number" in captured["decks/d000/questions"].q000) && !("decks/d000/numbered" in captured));

  console.log("removing a poll's last slide");
  sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000", decks: { d000: { title: "A", numbered: 1,
    questions: { q000: { text: "Q", options: { a: { label: "A", votes: 0 } }, number: 1 }, q001: { kind: "slide", text: "S" } } } } });
  await sync.saveQuestions([{ text: "Q", correct: null, options: [{ label: "A" }], voters: {} }]);
  ok("clears the question count it no longer needs", captured["decks/d000/numbered"] === null);

  console.log("reading one back");
  const ev = sync.__normalise({ ownerUid: "host-uid", currentDeck: "d000", currentIndex: 1,
    decks: { d000: { title: "A", numbered: 1, questionCount: 2, questions: {
      q000: { text: "Q", options: { a: { label: "A", votes: 0 } }, number: 1 },
      q001: { kind: "slide", body: "Just text" } } } } });
  ok("it is the current step", ev.currentQuestion?.id === "q001");
  ok("read as a slide", ev.currentQuestion.kind === "slide");
  ok("text alone is enough for it to count as arrived", ev.currentQuestion.body === "Just text");
  ok("and the poll's count of questions comes through", ev.numbered === 1);
  ok("an ordinary question reads as a question", ev.questions[0].kind === "question" && ev.questions[0].number === 1);
}

/* ── host.js: writing a slide, and running one ───────────────────────── */
{
  const page = readFileSync("../../host.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(page, { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: false });
  dom.window.matchMedia = globalThis.matchMedia;
  dom.window.localStorage.setItem("votr-tour-seen", "1");
  globalThis.location = dom.window.location;

  const sync = await import("../build/sync-host.js");
  await import("../build/host.js");
  await tick();
  const $ = (id) => document.getElementById(id);
  const called = (name) => sync.state.calls.filter((c) => c.name === name);
  const snap = (over = {}) => sync.state.push({
    ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
    blanked: false, askedAt: Date.now(), seconds: 30, lang: "en", likes: 0, players: {}, seen: {},
    decks: [{ id: "d000", title: "Offsite", count: 3 }],
    questions: [choiceQ("q000", "First?"), slideQ("q001", "Coffee break", "Back at 11:00"), choiceQ("q002", "Second?")],
    ...over,
  });
  const pick = (value) => {
    $("question-type").value = value;
    $("question-type").dispatchEvent(new dom.window.Event("change"));
  };

  console.log("the editor, set to Slide");
  snap();
  $("add-question").click();
  await tick();
  pick("slide");
  ok("offers a text box", shown($("body-field")));
  ok("and no answers to write", !shown($("options-field")));
  ok("or a right answer to mark", !shown($("correct-field")));
  ok("the first box is the heading", $("editor-label").textContent === "Heading");
  ok("and it may be left empty", !$("question-input").required);
  ok("the button says what it adds", $("save").textContent.includes("Add slide"));

  console.log("adding one with nothing in it");
  sync.state.calls = [];
  $("editor").dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  await tick();
  ok("is refused, and says why", shown($("form-error")) && /heading/i.test($("form-error").textContent));
  ok("without saving anything", called("saveQuestions").length === 0);

  console.log("adding one with text but no heading");
  $("body-input").value = "  Thanks for coming  ";
  $("editor").dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
  await tick();
  const saved = called("saveQuestions").at(-1)?.arg ?? [];
  const added = saved.at(-1);
  ok("is saved at the end of the poll", saved.length === 4);
  ok("as a slide", added?.kind === "slide");
  ok("with its text, trimmed", added?.body === "Thanks for coming" && added?.text === "");

  console.log("back to a question");
  $("add-question").click();
  await tick();
  ok("the editor opens as a question again", $("question-type").value === "choice" && shown($("options-field")) && !shown($("body-field")));
  $("cancel").click();

  console.log("in the list");
  const rows = [...document.querySelectorAll(".qitem")];
  ok("a slide says it is one", rows[1].querySelector(".qmeta").textContent === "Slide");
  ok("named by its heading", rows[1].querySelector(".qtext").textContent === "Coffee break");

  console.log("editing it");
  rows[1].querySelector('[data-act="edit"]').click();
  await tick();
  ok("opens as a slide, with its words", $("question-type").value === "slide"
     && $("question-input").value === "Coffee break" && $("body-input").value === "Back at 11:00");
  $("cancel").click();

  console.log("running it");
  snap({ currentIndex: 1 });
  await tick();
  $("tab-run").click();
  await tick();
  ok("the host sees what the room sees", $("options").querySelector(".slide-title")?.textContent === "Coffee break");
  ok("is told there's nothing to vote on", /nothing to vote on/.test($("hint").textContent));
  ok("Next moves on rather than revealing", $("next").textContent.includes("Next"));
  ok("there are no votes to reset", $("reset").disabled);
  sync.state.calls = [];
  $("next").click();
  await tick();
  ok("and pressing it goes to the next step", called("setCurrentIndex").at(-1)?.arg === 2);
  ok("without revealing anything", called("setRevealed").length === 0);
}

/* ── app.js: a phone on a slide ──────────────────────────────────────── */
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
  const base = {
    lang: "en", ownerUid: "host", blanked: false, revealed: false, askedAt: Date.now(),
    pausedAt: null, seconds: 30, likes: 0, players: { u1: "Ana" }, seen: {},
    questions: [choiceQ("q000", "First?", 1), slideQ("q001", "Coffee break", "Back at 11:00"), choiceQ("q002", "Second?", 2)],
  };

  console.log("a phone on a question, then a slide");
  sync.state.push({ ...base, currentIndex: 0 });
  ok("the question has its clock", shown($("clock")));
  sync.state.push({ ...base, currentIndex: 1 });
  ok("the slide's heading is on screen", shown(document.querySelector(".slide-title"))
     && document.querySelector(".slide-title").textContent === "Coffee break");
  ok("and its text", document.querySelector(".slide-body")?.textContent === "Back at 11:00");
  ok("with nothing to tap", document.querySelectorAll(".choice, .star-btn").length === 0);
  ok("no clock left over from the question", !shown($("clock")));
  ok("no place in the poll", !shown($("progress")));
  ok("and no Live badge — there's nothing to vote on", !shown($("status")));

  console.log("then the next question");
  sync.state.push({ ...base, currentIndex: 2 });
  ok("is question 2 of 2, not 3 of 3", $("progress").textContent === "Question 2 of 2");
  ok("with its answers to tap", document.querySelectorAll(".choice").length === 2);
  ok("and the slide is gone", !document.querySelector(".slide"));
}

/* ── screen.js: the wall on a slide ──────────────────────────────────── */
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
  const $ = (id) => document.getElementById(id);
  const base = {
    lang: "en", ownerUid: "host", blanked: false, revealed: false, askedAt: Date.now(),
    pausedAt: null, seconds: 30, likes: 0, players: { u1: "Ana" }, seen: { u1: Date.now() },
    questions: [choiceQ("q000", "First?", 1), slideQ("q001", "Coffee break", "Back at 11:00"), choiceQ("q002", "Second?", 2)],
  };

  console.log("the wall on a question, then a slide");
  sync.state.push({ ...base, currentIndex: 0 });
  ok("the question has its corner code", shown($("join")));
  sync.state.push({ ...base, currentIndex: 1 });
  ok("the slide is the screen", $("stage").dataset.screen === "slide");
  ok("its heading", document.querySelector(".big-slide-title")?.textContent === "Coffee break");
  ok("and its text", document.querySelector(".big-slide-body")?.textContent === "Back at 11:00");
  ok("and nothing else — no code, no count, no strip",
     !shown($("join")) && !shown($("votes")) && !shown($("foot")));

  console.log("editing the slide while it's up");
  sync.state.push({ ...base, currentIndex: 1,
    questions: [base.questions[0], slideQ("q001", "Coffee break", "Back at 11:15"), base.questions[2]] });
  ok("shows the new text", document.querySelector(".big-slide-body")?.textContent === "Back at 11:15");

  console.log("then the next question");
  sync.state.push({ ...base, currentIndex: 2 });
  ok("is question 2 of 2", $("progress").textContent === "Question 2 of 2");
  ok("with the code back in the corner", shown($("join")));
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
