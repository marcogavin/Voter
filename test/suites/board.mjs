// The end of a poll, which is two screens now: the standings, then the heart.
//
// Both pages have to walk the same sequence, and a poll with nothing to score
// has to keep the sequence it always had.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const quiz = (over = {}) => ({
  lang: "en", ownerUid: "host", blanked: false, revealed: true, askedAt: 0,
  pausedAt: null, seconds: 0, likes: 3,
  players: { u1: "Marco", u2: "Ana", u3: "Bo" },
  questions: [
    { id: "q0", text: "One", correct: "a", voters: { u1: "a", u2: "a", u3: "b" },
      options: [{ id: "a", label: "A", votes: 2 }, { id: "b", label: "B", votes: 1 }] },
    { id: "q1", text: "Two", correct: "b", voters: { u1: "b", u2: "a" },
      options: [{ id: "a", label: "A", votes: 1 }, { id: "b", label: "B", votes: 1 }] },
  ],
  currentIndex: 2,
  ...over,
});

/* ── the audience ──────────────────────────────────────────────────────── */
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

  const rows = () => [...document.querySelectorAll(".board-row")];
  const title = () => document.getElementById("question").textContent;

  // A question with a clock on it, so the screens after it have something to
// fail to clear.
console.log("a phone mid-question");
sync.state.push(quiz({ currentIndex: 0, revealed: false, askedAt: Date.now(), seconds: 30 }));
ok("has a countdown bar", !document.getElementById("clock").hidden);

console.log("a phone at the end of a quiz");
  sync.state.push(quiz());
  ok("sees the standings, not the heart", title() === "Scores");
  ok("with everyone who answered", rows().length === 3);
  ok("the winner first", rows()[0].querySelector(".board-name").textContent === "Marco");
  ok("marked as the winner", rows()[0].className.includes("is-first"));
  ok("wearing a cup", Boolean(rows()[0].querySelector(".board-crown")));
  ok("and celebrated", rows()[0].querySelectorAll(".confetti").length > 0);
  ok("their score out of what could be scored",
     rows()[0].querySelector(".board-score").textContent === "2/2");
  ok("this phone's own row is marked", rows()[0].className.includes("is-me"));
  ok("and nobody else's is", !rows()[1].className.includes("is-me"));
  ok("second place is second", rows()[1].querySelector(".board-place").textContent === "2");
  // Nothing is being timed on a leaderboard, and a bar left over from the
  // last question reads as a clock still running.
  ok("and the countdown is gone", document.getElementById("clock").hidden);
  ok("along with where we were in the poll", document.getElementById("progress").hidden);

  console.log("one press further");
  sync.state.push(quiz({ currentIndex: 3 }));
  ok("is the heart", title() === "Like VOTR?");
  ok("with the applause it already had", document.getElementById("like-count").textContent === "3");
  ok("and no countdown here either", document.getElementById("clock").hidden);

  console.log("and back to nothing on screen");
  sync.state.push(quiz({ currentIndex: 0, revealed: false, askedAt: Date.now(), seconds: 30 }));
  sync.state.push(quiz({ currentIndex: -1 }));
  ok("the waiting screen has no clock on it either",
     document.getElementById("clock").hidden);

  console.log("a poll with no right answers");
  // One question, and index 1 is one past it — the closing screen. It used to
  // say 2 here, which is off the end of a one-question poll and lands on the
  // waiting screen; the assertion below passed anyway, because the waiting
  // screen leaves the last title on the page and the last title happened to
  // be the right answer.
  const opinions = quiz({
    currentIndex: 1,
    questions: [{ id: "q0", text: "One", correct: null, voters: { u1: "a" },
      options: [{ id: "a", label: "A", votes: 1 }] }],
  });
  sync.state.push(opinions);
  ok("skips the standings entirely", title() === "Like VOTR?");
  ok("and shows it rather than leaving it behind a hidden heading",
     !document.getElementById("question").hidden);
  ok("because a table of zeroes is not a leaderboard", !document.querySelector(".board"));
}

/* ── the host ──────────────────────────────────────────────────────────── */
{
  const page = readFileSync("../../host.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(page, { url: "https://example.test/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.matchMedia = () => ({ matches: false });
  dom.window.matchMedia = globalThis.matchMedia;
  globalThis.location = dom.window.location;

  // The tour shows itself once per browser; this suite is not that once.
  dom.window.localStorage.setItem("votr-tour-seen", "1");

  const sync = await import("../build/sync-host.js");
  await import("../build/host.js");
  await tick();

  const $ = (id) => document.getElementById(id);
  const called = (name) => sync.state.calls.filter((c) => c.name === name);
  const hostQuiz = (over = {}) => ({
    ...quiz(over), ownerUid: "host-uid", currentDeck: "d000",
    decks: [{ id: "d000", title: "K", count: 2, createdAt: null, lastRunAt: null }],
  });

  console.log("the host at the same point");
  sync.state.push(hostQuiz());
  $("tab-run").click();
  await tick();
  ok("sees the same standings", $("run-question").textContent === "Scores");
  ok("drawn from the same list", document.querySelectorAll(".board-row").length === 3);
  ok("nobody is 'you' on the host", !document.querySelector(".board-row.is-me"));
  ok("and the counter says where this is", $("counter").textContent === "Scores");

  console.log("moving on");
  sync.state.calls = [];
  $("next").click();
  await tick();
  ok("Next goes to the heart", called("setCurrentIndex").at(-1)?.arg === 3);

  sync.state.push(hostQuiz({ currentIndex: 3 }));
  ok("which is where the run ends", $("counter").textContent === "The end");
  sync.state.calls = [];
  $("next").click();
  await tick();
  ok("and Next stops there", called("setCurrentIndex").length === 0);

  console.log("a poll with no right answers");
  sync.state.push(hostQuiz({
    currentIndex: 1,
    questions: [{ id: "q0", text: "One", correct: null, voters: {},
      options: [{ id: "a", label: "A", votes: 0 }] }],
  }));
  ok("ends at the heart, one screen earlier", $("counter").textContent === "The end");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
