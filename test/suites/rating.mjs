// Star ratings — a poll with numbered options and a mean, per ROADMAP.md.
//
// Nothing about storage, voting, or the rules changed for this: a rating is
// a normal question whose options happen to be the five stars in order, with
// no right answer. The editor is the one place that has to build it that way
// on purpose; every screen that reads it back only has to recognise it.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { isRatingQuestion, ratingMean, RATING_STARS } from "../../js/scores.js";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const rating = (votes) => ({
  id: "q0", text: "How was it?", correct: null, voters: {},
  options: RATING_STARS.map((label, i) => ({ id: String.fromCharCode(97 + i), label, votes: votes[i] ?? 0 })),
});

/* ── scores.js: the two functions everything else builds on ─────────────── */
{
  console.log("recognising a rating question");
  ok("five stars in order, no right answer", isRatingQuestion(rating([])));
  ok("not a rating with a right answer marked", !isRatingQuestion({ ...rating([]), correct: "a" }));
  ok("not a rating with the wrong number of options", !isRatingQuestion({ options: rating([]).options.slice(0, 4) }));
  ok("not a rating just because it has five options",
     !isRatingQuestion({ options: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n), votes: 0 })) }));
  ok("not a rating with the stars out of order",
     !isRatingQuestion({ options: [...rating([]).options].reverse() }));

  console.log("the mean");
  ok("nothing rated yet is null, not zero", ratingMean(rating([])) === null);
  ok("one 5-star rating averages 5", ratingMean(rating([0, 0, 0, 0, 1])) === 5);
  ok("a even split of 1 and 5 averages 3", ratingMean(rating([1, 0, 0, 0, 1])) === 3);
  ok("weighted by how many picked each star",
     ratingMean(rating([0, 1, 0, 0, 3])) === (2 + 15) / 4);
}

/* ── the editor: the one place that builds one on purpose ────────────────── */
{
  const page = readFileSync("../../host.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(page, { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: false });
  dom.window.matchMedia = globalThis.matchMedia;
  globalThis.location = dom.window.location;
  dom.window.localStorage.setItem("votr-tour-seen", "1");

  const sync = await import("../build/sync-host.js");
  await import("../build/host.js");
  await tick();

  const $ = (id) => document.getElementById(id);
  const called = (name) => sync.state.calls.filter((c) => c.name === name);

  const snap = (over = {}) => sync.state.push({
    ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
    blanked: false, askedAt: 0, seconds: 0, lang: "en", likes: 0, players: {},
    decks: [{ id: "d000", title: "K", count: 0, createdAt: null, lastRunAt: null }],
    questions: [],
    ...over,
  });

  console.log("a new question, starting as multiple choice");
  snap();
  $("add-question").click();
  await tick();
  ok("defaults to multiple choice", $("question-type").value === "choice");
  ok("with its own answers to write", !$("options-field").hidden);
  ok("and a right answer to mark", !$("correct-field").hidden);

  console.log("switching it to a rating");
  $("question-type").value = "rating";
  $("question-type").dispatchEvent(new dom.window.Event("change"));
  ok("fills in the five stars", $("options-input").value === RATING_STARS.join("\n"));
  ok("hides the answers — there's nothing to write", $("options-field").hidden);
  ok("and the right answer — there isn't one", $("correct-field").hidden);

  console.log("saving it");
  $("question-input").value = "How was it?";
  sync.state.calls = [];
  $("editor").dispatchEvent(new dom.window.Event("submit"));
  await tick();
  const saved = called("saveQuestions")[0]?.arg;
  ok("wrote the five stars as its options", saved?.[0]?.options.map((o) => o.label).join() === RATING_STARS.join());
  ok("with no right answer", saved?.[0]?.correct === null);

  console.log("opening it again");
  snap({ questions: [rating([0, 0, 1, 0, 2])] });
  document.querySelectorAll(".qbtns .iconbtn")[2].click();
  await tick();
  ok("the type picks up as rating", $("question-type").value === "rating");
  ok("still nothing to write or mark", $("options-field").hidden && $("correct-field").hidden);

  console.log("switching it back to multiple choice");
  $("question-type").value = "choice";
  $("question-type").dispatchEvent(new dom.window.Event("change"));
  ok("the answers come back to edit", !$("options-field").hidden);
  ok("leaving the stars there as ordinary text", $("options-input").value === RATING_STARS.join("\n"));

  console.log("the run tab, mid-poll");
  snap({ currentDeck: "d000", currentIndex: 0, questions: [rating([1, 0, 0, 0, 3])] });
  $("tab-run").click();
  await tick();
  ok("shows the average, not a made-up one", $("options").textContent.includes("Average 4"));

  console.log("the run tab, nothing rated yet");
  snap({ currentDeck: "d000", currentIndex: 0, questions: [rating([])] });
  ok("says so rather than showing a zero", $("options").textContent.includes("No ratings yet"));
}

/* ── the audience: stars are just its answers ─────────────────────────────── */
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

  const snap = (over = {}) => sync.state.push({
    lang: "en", players: { u1: "Marco" }, ownerUid: "host", currentIndex: 0,
    revealed: false, blanked: false, askedAt: Date.now(), pausedAt: null,
    seconds: 0, likes: 0, deckTitle: "",
    questions: [rating([1, 0, 0, 0, 3])],
    ...over,
  });

  console.log("before voting");
  snap();
  await tick();
  ok("the stars are the answers on offer", [...document.querySelectorAll(".choice-label")]
    .map((el) => el.textContent).join() === RATING_STARS.join());
  ok("no average shown until there's something to show", document.getElementById("rating-mean").textContent === "");

  console.log("after voting");
  document.querySelector('.choice[data-id="e"]').click();
  await tick();
  // The vote landing, as it comes back from the room's own snapshot — voted()
  // and the tally both move together, the way a real round trip would.
  snap({ questions: [{ ...rating([1, 0, 0, 0, 4]), voters: { u1: "e" } }] });
  await tick();
  ok("shows the average now results are in", document.getElementById("rating-mean").textContent.includes("Average 4"));
}

/* ── the big screen: same average, same reason ────────────────────────────── */
{
  const page = readFileSync("../../screen.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(page, { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: false });
  dom.window.matchMedia = globalThis.matchMedia;

  const sync = await import("../build/screen.js");
  await tick();

  sync.state.push({
    lang: "en", players: { u1: "Marco" }, seen: { u1: Date.now() }, ownerUid: "host",
    currentIndex: 0, revealed: false, blanked: false, askedAt: Date.now(), pausedAt: null,
    seconds: 0, likes: 0, questions: [rating([2, 0, 0, 0, 2])],
  });
  await tick();
  ok("the wall shows the average too", document.getElementById("big-rating-mean")?.textContent.includes("Average 3"));
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
