// What a phone puts on the clock when it votes.
//
// The leaderboard can only be as honest as this number. It is measured against
// the server's clock rather than the phone's, it is clamped at both ends so a
// device an hour out of step can't post the fastest time in the room, and it
// is only sent at all when the host has set a limit.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const page = readFileSync("../../index.html", "utf8")
  .replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://example.test/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false });
dom.window.matchMedia = globalThis.matchMedia;

const sync = await import("../build/sync-audience.js");
await import("../build/app.js");
await tick();

const now = Date.now();
const snap = (over = {}) => sync.state.push({
  lang: "en", players: { u1: "Marco" }, ownerUid: "host", currentIndex: 0,
  revealed: false, blanked: false, askedAt: now - 12000, pausedAt: null,
  seconds: 30, likes: 0, deckTitle: "",
  questions: [{
    id: "q0", text: "Q", correct: "b", voters: {},
    options: [{ id: "a", label: "A", votes: 0 }, { id: "b", label: "B", votes: 0 }],
  }],
  ...over,
});

const vote = async (over) => {
  sync.state.votes = [];
  snap(over);
  document.querySelector('.choice[data-id="b"]').click();
  await tick();
  return sync.state.votes.at(-1);
};

console.log("a question that went up twelve seconds ago");
let sent = await vote();
ok("the vote carries how long it took", Math.abs(sent.ms - 12000) < 500);
ok("on the question that was up", sent.qid === "q0" && sent.oid === "b");

console.log("no time limit");
sent = await vote({ seconds: 0 });
ok("nothing is timed, so nothing is sent", sent.ms === null);

console.log("a phone whose clock is ahead of the server's");
sent = await vote({ askedAt: now + 20000 });
ok("posts zero rather than a negative time", sent.ms === 0);

console.log("after the time has run out");
sync.state.votes = [];
snap({ askedAt: now - 600000 });
document.querySelector('.choice[data-id="b"]').click();
await tick();
ok("there is no vote left to time", sync.state.votes.length === 0);
// The upper clamp can't be reached through the interface because of that —
// it is there for a snapshot that arrives mid-tap, and the rules cap it again
// at an hour whatever a phone claims.

console.log("answered the moment it went up");
sent = await vote({ askedAt: now });
ok("is allowed to be nearly nothing", sent.ms < 200);

/* ── Being here ────────────────────────────────────────────────────────── */

console.log("a phone with the page open");
ok("has already said so once", (sync.state.touched ?? 0) > 0);

const before = sync.state.touched;
sync.state.votes = [];
snap();
document.querySelector('.choice[data-id="a"]').click();
await tick();
ok("and says so again when it votes", sync.state.touched > before);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
