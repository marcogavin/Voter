// The version, and what it opens.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { CHANGES, VERSION } from "../../js/changes.js";

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
dom.window.localStorage.setItem("votr-tour-seen", "1");

const sync = await import("../build/sync-host.js");
await import("../build/host.js");
await tick();

const $ = (id) => document.getElementById(id);
sync.state.push({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
  blanked: false, askedAt: null, pausedAt: null, seconds: 30, lang: "en",
  likes: 0, players: {}, seen: {}, questions: [],
  decks: [{ id: "d000", title: "K", count: 0, createdAt: null, lastRunAt: null }],
});
await tick();

console.log("the log itself");
ok("every version is numbered", CHANGES.every((c) => /^\d+\.\d+$/.test(c.version)));
ok("newest first", CHANGES[0].version === VERSION);
ok("in order", CHANGES.every((c, i) =>
  i === 0 || Number(CHANGES[i - 1].version) > Number(c.version)));
ok("every one says something", CHANGES.every((c) => c.lines.length > 0));
ok("and nothing is written in code",
   CHANGES.every((c) => c.lines.every((l) =>
     !/[{}<>]|function |const |\.js\b/.test(l))));
ok("every date is a date", CHANGES.every((c) => !Number.isNaN(Date.parse(c.on))));

console.log("on the page");
ok("the build says which it is", $("version").textContent === `v${VERSION}`);
ok("and what pressing it does", $("version").title === "What's new");
ok("the log is closed to start with", $("news-sheet").hidden);

console.log("opening it");
$("version").click();
ok("it opens", !$("news-sheet").hidden);
ok("with every version in it",
   document.querySelectorAll(".news-version").length === CHANGES.length);
ok("newest at the top",
   document.querySelector(".news-version").textContent.startsWith(`Version ${VERSION}`));
ok("carrying its month", document.querySelector(".news-version").textContent.includes("2026"));
ok("and every line of every version",
   document.querySelectorAll(".news-list li").length ===
     CHANGES.reduce((n, c) => n + c.lines.length, 0));
ok("as text, never as markup",
   document.querySelector(".news-list li").innerHTML ===
     document.querySelector(".news-list li").textContent);

console.log("closing it");
$("news-close").click();
ok("the button closes it", $("news-sheet").hidden);
$("version").click();
$("news-sheet").click();
ok("and so does the space around it", $("news-sheet").hidden);

console.log("opening it twice");
$("version").click();
$("version").click();
ok("doesn't list everything twice",
   document.querySelectorAll(".news-version").length === CHANGES.length);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
