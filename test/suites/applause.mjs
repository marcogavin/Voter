// The closing screen's hearts, driven through the real js/app.js in a real DOM.
//
// The thing worth testing is the double-count: your own tap flies a heart
// immediately AND comes back as a snapshot a moment later. One tap, one
// heart — while somebody else's tap, which arrives only as a bigger number,
// still has to fly one.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const page = readFileSync("../../index.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://example.test/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false });
dom.window.matchMedia = globalThis.matchMedia;
// Nothing in jsdom finishes a CSS animation, so hearts stay in the DOM and
// can be counted. That is what we want here; the browser removes them on
// animationend.

const sync = await import("../build/sync-audience.js");
await import("../build/app.js");
await new Promise((r) => setTimeout(r, 0));

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const hearts = () => document.querySelectorAll(".heart-stage .heart-fly").length;
const colours = () => [...document.querySelectorAll(".heart-stage .heart-fly")].map((h) => h.style.color);

const EVENT = {
  lang: "en", players: { u1: "Marco" }, questions: [{ id: "q1", text: "Q", correct: null, options: [], voted: null }],
  currentIndex: 1, revealed: false, blanked: false, askedAt: 0, seconds: 0, likes: 0, deckTitle: "", ownerUid: "host",
};
const snap = (likes) => sync.state.push({ ...EVENT, likes });

console.log("arriving at the closing screen with applause already counted");
snap(17);
ok("the count is shown", document.getElementById("like-count").textContent === "17");
ok("but the past doesn't replay", hearts() === 0);

console.log("somebody else taps");
snap(18);
ok("their heart flies here too", hearts() === 1);
snap(21);
ok("three at once is three hearts", hearts() === 4);

console.log("you tap");
const before = hearts();
document.getElementById("like").click();
await tick();
ok("a heart leaves immediately, without waiting for the database", hearts() === before + 1);
ok("the count moves with it", document.getElementById("like-count").textContent === "22");
snap(22); // the same tap coming back as a snapshot
ok("and its snapshot doesn't fly a second one", hearts() === before + 1);

console.log("your hearts are your colour");
document.getElementById("like").click();
await tick();
snap(23);
const mine = colours().slice(-2);
ok("the same colour twice", mine[0] === mine[1]);
ok("from the palette in the stylesheet", /^var\(--heart-[1-8]\)$/.test(mine[0]));

console.log("a refused tap");
sync.state.nextLike = () => Promise.reject(new Error("PERMISSION_DENIED"));
const held = hearts();
document.getElementById("like").click();
await tick(); await tick();
ok("says so", /refused it/.test(document.getElementById("like-hint").textContent));
ok("and puts the count back", document.getElementById("like-count").textContent === "23");
snap(23); // the rollback
ok("without the rollback flying anything", hearts() === held + 1);

console.log("a burst from a full room");
sync.state.nextLike = null;
const many = hearts();
snap(23 + 200);
ok("is a burst, not two hundred hearts", hearts() - many === 12);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
