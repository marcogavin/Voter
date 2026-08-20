// Hiding the screen stops the clock.
//
// The audience used to see a frozen bar while the host's counter kept
// running down, so a question could expire behind a blank screen and come
// back already closed.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const page = readFileSync("../../host.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://example.test/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false });
dom.window.matchMedia = globalThis.matchMedia;
// The tour shows itself once per browser; these suites are not that once.
dom.window.localStorage.setItem("votr-tour-seen", "1");
globalThis.location = dom.window.location;

const sync = await import("../build/sync-host.js");
await import("../build/host.js");
await new Promise((r) => setTimeout(r, 0));

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const $ = (id) => document.getElementById(id);
const called = (name) => sync.state.calls.filter((c) => c.name === name);

const START = Date.now() - 12000; // a question that went up twelve seconds ago
const snap = (over = {}) => sync.state.push({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: 0, revealed: false,
  blanked: false, askedAt: START, pausedAt: null, seconds: 30, lang: "en",
  likes: 0, players: {},
  decks: [{ id: "d000", title: "Kickoff", count: 1, createdAt: null, lastRunAt: null }],
  questions: [{ id: "q000", text: "Q", correct: null, options: [{ id: "a", label: "A", votes: 0 }] }],
  ...over,
});

console.log("a question with time left on it");
snap();
$("tab-run").click();
// The seconds are drawn by the ticker rather than by the render, so the
// first of them lands a quarter of a second later.
await new Promise((r) => setTimeout(r, 300));
ok("the counter is counting", /1 \/ 1 · 1[78]s/.test($("counter").textContent));

console.log("hiding the screen");
$("blank").click();
await tick();
const hide = called("setBlanked").at(-1);
ok("hides it", hide.arg === true);
ok("and stamps the pause, so the clock has something to stop at",
   sync.state.paused === true);

console.log("while it is hidden");
snap({ blanked: true, pausedAt: START + 12000 });
const held = $("counter").textContent;
await new Promise((r) => setTimeout(r, 60));
ok("the counter holds where it was", $("counter").textContent === held);
ok("at the seconds that were left", /1 \/ 1 · 18s/.test(held));
snap({ blanked: true, pausedAt: START + 12000 });
ok("and nothing closes behind a blank screen", called("setRevealed").length === 0);

console.log("showing it again");
sync.state.calls = [];
$("blank").click();
await tick();
const show = called("setBlanked").at(-1);
ok("shows it", show.arg === false);
ok("and hands back the time that was left, to the second",
   Math.abs(show.resumed - (START + (Date.now() - (START + 12000)))) < 1500);

console.log("a question that was hidden with two seconds left");
snap({ blanked: true, pausedAt: START + 28000 });
ok("still has two", /1 \/ 1 · 2s/.test($("counter").textContent));

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
