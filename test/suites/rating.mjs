// Star ratings — a poll with numbered options and a mean, per ROADMAP.md,
// with a star count (3, 5 or 10) and a colour a host actually picks.
//
// Nothing about storage, voting, or the rules changed for this beyond the
// two fields that carry the shape: `ratingStars` is what marks a question as
// a rating at all, and `ratingColor` is purely cosmetic. The editor is the
// one place that builds one on purpose; every screen that reads it back only
// has to recognise it.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import {
  isRatingQuestion, ratingMean, ratingOptions, ratingColorVar,
  RATING_STAR_COUNTS, RATING_COLORS,
} from "../../js/scores.js";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const rating = (n, color, votes = []) => ({
  id: "q0", text: "How was it?", correct: null, voters: {},
  ratingStars: n, ratingColor: color,
  options: ratingOptions(n).map((label, i) => ({ id: String.fromCharCode(97 + i), label, votes: votes[i] ?? 0 })),
});

/* ── scores.js: the functions everything else builds on ──────────────────── */
{
  console.log("recognising a rating question");
  ok("a star count and no right answer", isRatingQuestion(rating(5, "gold")));
  ok("any of the three counts", RATING_STAR_COUNTS.every((n) => isRatingQuestion(rating(n, "gold"))));
  ok("not a rating with a right answer marked", !isRatingQuestion({ ...rating(5, "gold"), correct: "a" }));
  ok("not a rating with no star count at all", !isRatingQuestion({ correct: null, options: rating(5, "gold").options }));
  ok("not a rating with a count off the list", !isRatingQuestion({ correct: null, ratingStars: 7, options: [] }));

  console.log("the mean");
  ok("nothing rated yet is null, not zero", ratingMean(rating(5, "gold")) === null);
  ok("one top rating averages the top", ratingMean(rating(5, "gold", [0, 0, 0, 0, 1])) === 5);
  ok("an even split of 1 and 5 averages 3", ratingMean(rating(5, "gold", [1, 0, 0, 0, 1])) === 3);
  ok("weighted by how many picked each star",
     ratingMean(rating(5, "gold", [0, 1, 0, 0, 3])) === (2 + 15) / 4);
  ok("works the same at 10 stars", ratingMean(rating(10, "gold", [1, 0, 0, 0, 0, 0, 0, 0, 0, 1])) === 5.5);

  console.log("the colour");
  ok("every curated colour resolves to a real token", RATING_COLORS.every((c) => ratingColorVar(c.key) === c.var));
  ok("an unknown key falls back to the first rather than breaking", ratingColorVar("nonsense") === RATING_COLORS[0].var);
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
  const pickedColor = () => document.querySelector('input[name="rating-color"]:checked')?.value;

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
  ok("and nothing about stars yet", $("rating-fields").hidden);

  console.log("switching it to a rating");
  $("question-type").value = "rating";
  $("question-type").dispatchEvent(new dom.window.Event("change"));
  ok("the star and colour fields appear", !$("rating-fields").hidden);
  ok("hides the answers — there's nothing to write", $("options-field").hidden);
  ok("and the right answer — there isn't one", $("correct-field").hidden);
  ok("defaults to 5 stars", $("rating-stars").value === "5");
  ok("fills in five numbered options", $("options-input").value === ratingOptions(5).join("\n"));
  ok("and a colour is already picked", RATING_COLORS.some((c) => c.key === pickedColor()));

  console.log("choosing 10 stars");
  $("rating-stars").value = "10";
  $("rating-stars").dispatchEvent(new dom.window.Event("change"));
  ok("refills with ten numbered options", $("options-input").value === ratingOptions(10).join("\n"));

  console.log("picking a colour");
  const redInput = document.querySelector('input[name="rating-color"][value="red"]');
  redInput.checked = true;
  redInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  ok("shows as picked", redInput.closest(".swatch").classList.contains("is-picked"));
  ok("and the gold one no longer is", !document.querySelector('input[name="rating-color"][value="gold"]').closest(".swatch").classList.contains("is-picked"));

  console.log("saving it");
  $("question-input").value = "How was it?";
  sync.state.calls = [];
  $("editor").dispatchEvent(new dom.window.Event("submit"));
  await tick();
  const saved = called("saveQuestions")[0]?.arg;
  ok("wrote ten numbered options", saved?.[0]?.options.map((o) => o.label).join() === ratingOptions(10).join());
  ok("with no right answer", saved?.[0]?.correct === null);
  ok("the star count", saved?.[0]?.ratingStars === 10);
  ok("and the colour chosen", saved?.[0]?.ratingColor === "red");

  console.log("opening it again");
  snap({ questions: [rating(3, "blue", [0, 1, 2])] });
  document.querySelectorAll(".qbtns .iconbtn")[2].click();
  await tick();
  ok("the type picks up as rating", $("question-type").value === "rating");
  ok("its own star count", $("rating-stars").value === "3");
  ok("its own colour", pickedColor() === "blue");
  ok("still nothing to write or mark", $("options-field").hidden && $("correct-field").hidden);

  console.log("switching it back to multiple choice");
  $("question-type").value = "choice";
  $("question-type").dispatchEvent(new dom.window.Event("change"));
  ok("the answers come back to edit", !$("options-field").hidden);
  ok("leaving the numbers there as ordinary text", $("options-input").value === ratingOptions(3).join("\n"));

  console.log("saving it back as a plain question loses the rating fields");
  sync.state.calls = [];
  $("editor").dispatchEvent(new dom.window.Event("submit"));
  await tick();
  const savedBack = called("saveQuestions")[0]?.arg;
  ok("no star count survives the switch", !savedBack?.[0]?.ratingStars);

  console.log("a fresh question after all that starts clean");
  snap();
  $("add-question").click();
  await tick();
  ok("back to multiple choice", $("question-type").value === "choice");

  console.log("the run tab, mid-poll");
  snap({ currentDeck: "d000", currentIndex: 0, questions: [rating(5, "gold", [1, 0, 0, 0, 3])] });
  $("tab-run").click();
  await tick();
  ok("shows the average, not a made-up one", $("options").textContent.includes("Average 4"));
  ok("as an actual star row", $("options").querySelector(".star-summary") !== null);

  console.log("the run tab, nothing rated yet");
  snap({ currentDeck: "d000", currentIndex: 0, questions: [rating(5, "gold")] });
  ok("says so rather than showing a zero", $("options").textContent.includes("No ratings yet"));
}

/* ── the audience: real stars to tap, not a list to read ──────────────────── */
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
    questions: [rating(5, "red", [1, 0, 0, 0, 3])],
    ...over,
  });

  console.log("before voting");
  snap();
  await tick();
  const stars = () => [...document.querySelectorAll(".star-btn")];
  ok("one tappable star per option", stars().length === 5);
  ok("named for what tapping it does", stars()[2].getAttribute("aria-label") === "Rate 3 stars");
  ok("none of them filled yet", stars().every((s) => !s.classList.contains("is-filled")));
  ok("no average shown until there's something to show", document.getElementById("rating-mean").textContent === "");

  console.log("tapping the 5th star");
  stars()[4].click();
  await tick();
  ok("casts a real vote for that option", sync.state.votes.at(-1)?.oid === "e");

  console.log("after voting — the room's own snapshot, vote and tally together");
  snap({ questions: [{ ...rating(5, "red", [1, 0, 0, 0, 4]), voters: { u1: "e" } }] });
  await tick();
  ok("all five stars filled, your own pick", stars().every((s) => s.classList.contains("is-filled")));
  ok("and locked — one vote is the whole vote", stars().every((s) => s.disabled));
  ok("shows the average now results are in", document.getElementById("rating-mean").textContent.includes("Average 4"));
}

/* ── the big screen: the same summary, at its own size ────────────────────── */
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
    seconds: 0, likes: 0, questions: [rating(5, "green", [2, 0, 0, 0, 2])],
  });
  await tick();
  ok("the wall shows the same average", document.querySelector(".big-stage").textContent.includes("Average 3"));
  ok("as the same star row", document.querySelector(".big-stage .star-summary") !== null);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
