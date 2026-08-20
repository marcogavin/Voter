// The two badges, which used to say the same thing whatever was happening.
//
// The audience's says Live only while a vote would count. The host's says
// what its connection is doing, and lends itself to a confirmation for a
// moment rather than keeping the last one on screen for good.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

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

  const badge = () => document.getElementById("status");
  const question = (voters = {}) => ({
    id: "q0", text: "Q", correct: "b", voters,
    options: [{ id: "a", label: "A", votes: 1 }, { id: "b", label: "B", votes: 2 }],
  });
  const snap = (over = {}) => sync.state.push({
    lang: "en", players: { u1: "Marco" }, questions: [question()], currentIndex: 0,
    revealed: false, blanked: false, askedAt: Date.now(), seconds: 30, likes: 0,
    deckTitle: "", ownerUid: "host", pausedAt: null, ...over,
  });

  console.log("the audience badge");
  snap();
  ok("says Live while a question is open", !badge().hidden && badge().textContent === "Live");

  snap({ questions: [question({ u1: "a" })] });
  ok("and stops once this phone has voted", badge().hidden);

  snap({ revealed: true });
  ok("stays quiet once the answer is out", badge().hidden);

  snap({ currentIndex: -1 });
  ok("and while the room is waiting", badge().hidden);

  snap({ blanked: true });
  ok("and while the host has the screen hidden", badge().hidden);

  snap({ askedAt: Date.now() - 60000 });
  ok("and once the time has run out", badge().hidden);

  snap();
  ok("but comes back for the next question", !badge().hidden);
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

  const badge = () => document.getElementById("status");
  const snap = (over = {}) => sync.state.push({
    ownerUid: "host-uid", currentDeck: "d000", currentIndex: 0, revealed: false,
    blanked: false, askedAt: Date.now(), pausedAt: null, seconds: 0, lang: "en",
    likes: 0, players: {},
    decks: [{ id: "d000", title: "K", count: 1, createdAt: null, lastRunAt: null }],
    questions: [{ id: "q000", text: "Q", correct: null, options: [{ id: "a", label: "A", votes: 0 }] }],
    ...over,
  });

  console.log("the host badge");
  snap();
  ok("says what the connection is doing", badge().textContent === "Live");
  ok("as a state, not an event", badge().dataset.state === "live");

  document.getElementById("tab-run").click();
  document.getElementById("blank").click();
  await tick();
  ok("a confirmation borrows it", badge().textContent === "Hidden");
  ok("marked as something that happened", badge().dataset.state === "done");

  await new Promise((r) => setTimeout(r, 2000));
  ok("and gives it back", badge().textContent === "Live");
  ok("to the connection again", badge().dataset.state === "live");

  console.log("the hide button, while the screen is hidden");
  snap({ blanked: true });
  const blank = document.getElementById("blank");
  ok("reads as engaged", blank.className.includes("btn--on"));
  ok("says so to a screen reader too", blank.getAttribute("aria-pressed") === "true");
  ok("and is not dressed as the primary action", !blank.className.includes("btn--primary"));
  snap({ blanked: false });
  ok("back to normal when the screen is back", !blank.className.includes("btn--on"));
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
