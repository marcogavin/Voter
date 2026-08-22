// Clear the room, through the real js/host.js.
//
// The one operational gap the security rework surfaced: once a poll has been
// open a while, "who's actually here" and "who's the database still counting"
// drift apart — stale tabs, old devices, a second account. This button asks
// once, then wipes only names and presence — never a question, a vote, or
// which poll is live.

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

const snap = (over = {}) => sync.state.push({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
  blanked: false, askedAt: 0, seconds: 0, lang: "en", likes: 0, players: {},
  decks: [{ id: "d000", title: "Marco", count: 1 }],
  questions: [{ id: "q000", text: "Q", correct: null,
    options: [{ id: "a", label: "A", votes: 0 }, { id: "b", label: "B", votes: 0 }] }],
  ...over,
});

console.log("nobody in the room yet");
snap({ players: {} });
ok("nothing to clear, so it's off", $("clear-room").disabled);

console.log("with people in the room");
snap({ players: { u1: "Ana", u2: "Bo" } });
ok("offered", !$("clear-room").disabled);
ok("says what it does", $("clear-room").querySelector(".btn-label").textContent === "Clear the room");

console.log("a signed-in visitor who isn't the owner");
snap({ ownerUid: "someone-else", players: { u1: "Ana", u2: "Bo" } });
ok("off — only the owner can clear it", $("clear-room").disabled);

console.log("asking, with people present");
snap({ players: { u1: "Ana", u2: "Bo" } });
sync.state.calls = [];
$("clear-room").click();
await tick();
ok("asks first", !$("ask-overlay").hidden);
ok("saying how many are here", /2/.test($("ask-title").textContent));
ok("and does nothing until answered", called("clearRoom").length === 0);

console.log("answering no");
$("ask-cancel").click();
await tick();
ok("nobody was cleared", called("clearRoom").length === 0);

console.log("answering yes");
$("clear-room").click();
await tick();
$("ask-form").dispatchEvent(new dom.window.Event("submit"));
await tick(); await tick();
ok("clears the room", called("clearRoom").length === 1);
ok("says it happened", $("status").textContent === "Cleared");

// Not the room's feedback — the app's own. Settings is where a host who
// bought this deployment reaches its maintainer, not where the audience
// says anything.
console.log("the way to reach the app's maintainer, in the same section");
ok("a quiet link, not a button", $("feedback").textContent === "Send feedback our way");
ok("straight to an inbox", $("feedback").getAttribute("href").startsWith("mailto:"));

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
