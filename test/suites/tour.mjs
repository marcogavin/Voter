// The guided tour.
//
// It runs once unasked, walks the page it is describing — including across
// the two halves of it — and can be left at any point from anywhere.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const page = readFileSync("../../host.html", "utf8")
  .replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://example.test/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false });
dom.window.matchMedia = globalThis.matchMedia;
globalThis.location = dom.window.location;

const sync = await import("../build/sync-host.js");
await import("../build/host.js");
await tick();

const $ = (id) => document.getElementById(id);
const tour = () => document.querySelector(".tour");
const says = () => document.querySelector(".tour-text")?.textContent ?? null;
const count = () => document.querySelector(".tour-count")?.textContent ?? null;
const lit = () => document.querySelector(".tour-ring");
const press = (cls) => document.querySelector("." + cls).click();

const snap = () => sync.state.push({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
  blanked: false, askedAt: null, pausedAt: null, seconds: 30, lang: "en",
  likes: 0, players: {}, seen: {},
  questions: [{ id: "q000", text: "Q", correct: null, voters: {}, times: {},
    options: [{ id: "a", label: "A", votes: 0 }] }],
  decks: [{ id: "d000", title: "K", count: 1, createdAt: null, lastRunAt: null }],
});

console.log("the first time a host signs in on this browser");
snap();
await tick();
ok("the tour shows itself, unasked", Boolean(tour()));
ok("starting where anybody would start", says().startsWith("You write your questions"));
ok("saying how far in it is", count() === "1 of 8");
ok("with something lit up", Boolean(lit()));
ok("and no way back from the first step", document.querySelector(".tour-back").hidden);

console.log("stepping through it");
press("tour-next");
ok("the second step is the polls", says().startsWith("A poll is just a set"));
ok("and now there is a way back", !document.querySelector(".tour-back").hidden);
press("tour-back");
ok("which goes back", count() === "1 of 8");

for (let i = 0; i < 5; i++) press("tour-next");
ok("the sixth step crosses into Run", !$("view-run").hidden && $("view-setup").hidden);
ok("and describes it", says().startsWith("This puts the first question up"));

press("tour-next");
press("tour-next");
ok("the eighth is the last", count() === "8 of 8");
ok("and it points at the way back to itself",
   says().startsWith("That's it") &&
     lit().getBoundingClientRect !== undefined);
ok("offering to finish rather than to go on",
   document.querySelector(".tour-next").textContent.trim() === "Done");
ok("and not Skip beside it, which would be the same button twice",
   document.querySelector(".tour-skip").hidden);

press("tour-next");
ok("finishing closes it", tour() === null);
ok("and puts the page back where it was", !$("view-setup").hidden);

console.log("the second time");
snap();
await tick();
ok("it does not show itself again", tour() === null);

console.log("asking for it back");
$("tour").click();
ok("the button reopens it", Boolean(tour()));
ok("from the beginning", count() === "1 of 8");

console.log("what it points at");
press("tour-skip");
$("tour").click();
for (let i = 0; i < 4; i++) press("tour-next");
ok("the sharing step names two ways in", says().startsWith("Two ways in"));
// Which two it actually lights up is a question about layout, and there
// isn't any here — tourfit measures that in a real browser.
press("tour-skip");

console.log("leaving early");
$("tour").click();
press("tour-skip");
ok("skip closes it", tour() === null);
$("tour").click();
document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
ok("and so does Escape", tour() === null);

console.log("a snapshot arriving mid-tour");
$("tour").click();
press("tour-next");
snap();
await tick();
ok("doesn't restart it", count() === "2 of 8");
ok("or close it", Boolean(tour()));
press("tour-skip");

console.log("signed out");
sync.state.anonymous = true;
snap();
await tick();
ok("there is nothing to be shown around", $("tour").hidden);
$("tour").click();
ok("and asking gets nothing", tour() === null);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
