// The poll picker, through the real js/host.js.
//
// It replaced a <select> with two icons hanging off it, so what matters is
// that everything the select could do still happens — switch, rename, delete
// — and that each row says enough to tell one poll from another.

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
const rows = () => [...document.querySelectorAll(".pollitem")];
const DAY = 86400000;
const closeSheet = () => { $("poll-close").click(); };

const snap = (over = {}) => sync.state.push({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
  blanked: false, askedAt: 0, seconds: 0, lang: "en", likes: 0, players: {},
  decks: [
    { id: "d000", title: "Kickoff 2026", count: 3, createdAt: Date.now() - 30 * DAY, lastRunAt: Date.now() - 2 * DAY },
    { id: "d001", title: "Product Q&A", count: 5, createdAt: Date.now() - 3 * DAY, lastRunAt: null },
    { id: "d002", title: "Ice breaker", count: 2, createdAt: null, lastRunAt: null },
  ],
  questions: [{ id: "q000", text: "Q", correct: null, options: [{ id: "a", label: "A", votes: 0 }] }],
  ...over,
});

console.log("the questions section says whose questions they are");
snap();
ok("by name, with the name carrying the weight",
   $("deck-open-name").querySelector("b").textContent === "Kickoff 2026");
ok("and when the poll last faced a room",
   $("deck-open-name").textContent === "Kickoff 2026 · last run 2 days ago");
ok("the count is left to the list underneath",
   !$("deck-open-name").textContent.includes("3 questions"));
ok("and the picker isn't in the way until asked for", $("poll-sheet").hidden);

console.log("opening the picker");
$("deck-open").click();
await tick();
ok("shows every poll", rows().length === 3);
ok("marks the one that's open", rows()[0].className.includes("is-open"));
ok("and only that one", !rows()[1].className.includes("is-open"));
ok("a poll that has run says when",
   rows()[0].querySelector(".pollmeta").textContent === "3 questions · last run 2 days ago");
ok("one that hasn't says when it was made",
   rows()[1].querySelector(".pollmeta").textContent === "5 questions · created 3 days ago");
ok("one from before either was stored says neither",
   rows()[2].querySelector(".pollmeta").textContent === "2 questions · never run");
ok("with three of them, any can be deleted",
   rows().every((r) => !r.querySelector('[data-act="delete"]').disabled));

console.log("picking one");
rows()[1].querySelector('[data-act="open"]').click();
await tick();
ok("switches to it", called("setCurrentDeck").at(-1)?.arg === "d001");
ok("and gets out of the way", $("poll-sheet").hidden);

console.log("picking the one already open");
$("deck-open").click();
await tick();
rows()[0].querySelector('[data-act="open"]').click();
await tick();
ok("writes nothing", called("setCurrentDeck").length === 1);
ok("just closes", $("poll-sheet").hidden);

console.log("renaming from the row it belongs to");
$("deck-open").click();
await tick();
rows()[1].querySelector('[data-act="rename"]').click();
await tick();
ok("asks, with the current name in the field", $("ask-input").value === "Product Q&A");
$("ask-input").value = "Product Q&A 2026";
$("ask-form").dispatchEvent(new dom.window.Event("submit"));
await tick(); await tick();
ok("renames that poll, not the open one",
   called("renameDeck").at(-1)?.arg.join() === "d001,Product Q&A 2026");

console.log("deleting from the row it belongs to");
$("deck-open").click();
await tick();
rows()[2].querySelector('[data-act="delete"]').click();
await tick();
ok("asks first, naming it", /Ice breaker/.test($("ask-title").textContent));
$("ask-form").dispatchEvent(new dom.window.Event("submit"));
await tick(); await tick();
ok("deletes that one", called("deleteDeck").at(-1)?.arg === "d002");

console.log("down to one poll");
closeSheet();
snap({ decks: [{ id: "d000", title: "Kickoff 2026", count: 3, createdAt: null, lastRunAt: null }] });
$("deck-open").click();
await tick();
ok("it can't be deleted — an event always keeps one",
   rows()[0].querySelector('[data-act="delete"]').disabled);
ok("but it can still be renamed", !rows()[0].querySelector('[data-act="rename"]').disabled);
$("poll-close").click();
await tick();
ok("Close puts the picker away", $("poll-sheet").hidden);

console.log("a run stamps the poll");
snap();
$("next").click(); // nothing on screen → this starts the run
await tick();
ok("says so when it begins", called("setCurrentIndex").at(-1)?.starting === true);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
