// Signing in, and coming back from it.
//
// Google opens in a tab of its own. On a phone that tab is the whole screen,
// and when it closes there is nothing to say which of the others to go back
// to — so this page says so before it goes, and picks the account up by
// itself whenever it does come back.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const page = readFileSync("../../host.html", "utf8")
  .replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://example.test/", virtualConsole: undefined });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false });
dom.window.matchMedia = globalThis.matchMedia;
// The tour shows itself once per browser; these suites are not that once.
dom.window.localStorage.setItem("votr-tour-seen", "1");
globalThis.location = dom.window.location;

const sync = await import("../build/sync-host.js");
sync.state.anonymous = true;
await import("../build/host.js");
await tick();

const $ = (id) => document.getElementById(id);
const label = () => $("signin").querySelector(".btn-label").textContent;

// Whichever of the two lines is actually on screen. Reading the hidden one is
// how a message that could never be seen passed a test twice.
const note = () => {
  const shown = [$("account"), $("signed-out")].filter((el) => !el.hidden);
  return shown.map((el) => el.textContent.trim()).join(" | ");
};
const noteEl = () =>
  [$("account"), $("signed-out")].find((el) => !el.hidden) ?? $("account");
const called = (name) => sync.state.calls.filter((c) => c.name === name);

sync.state.push({
  ownerUid: null, currentDeck: "d000", currentIndex: -1, revealed: false,
  blanked: false, askedAt: null, pausedAt: null, seconds: 30, lang: "en",
  likes: 0, players: {}, questions: [],
  decks: [{ id: "d000", title: "", count: 0, createdAt: null, lastRunAt: null }],
});
await tick();

console.log("before");
ok("the button asks", label() === "Sign in with Google");
ok("and the page explains why", note() === "Sign in with Google to set up and run polls.");

console.log("while Google has the screen");
$("signin").click();
await tick();
ok("it went", called("signInWithGoogle").length === 1);
ok("the button says what it is waiting for", label() === "Waiting for Google…");
ok("and can't be pressed twice", $("signin").disabled);
ok("the page says which tab to come back to",
   note() === "Finished with Google? Come back to this tab.");

console.log("and a snapshot lands while it is waiting");
sync.state.push({
  ownerUid: null, currentDeck: "d000", currentIndex: 0, revealed: false,
  blanked: false, askedAt: Date.now(), pausedAt: null, seconds: 30, lang: "en",
  likes: 0, players: { u1: "Ana" },
  questions: [{ id: "q0", text: "Q", correct: null, voters: {},
    options: [{ id: "a", label: "A", votes: 1 }] }],
  decks: [{ id: "d000", title: "", count: 1, createdAt: null, lastRunAt: null }],
});
await tick();
ok("the instruction survives it",
   note() === "Finished with Google? Come back to this tab.");
ok("and so does the button", label() === "Waiting for Google…");

console.log("the page watches for the account itself");
ok("rather than only for the answer from the popup",
   typeof sync.state.signedIn === "function");

console.log("when Google refuses");
sync.state.calls = [];
sync.state.nextSignIn = () =>
  Promise.reject(Object.assign(new Error("no"), { code: "auth/network-request-failed" }));
$("signin").disabled = false;
$("signin").click();
await tick();
await tick();
ok("the button comes back", !$("signin").disabled && label() === "Sign in with Google");
ok("and says what went wrong instead", note().startsWith("Couldn't reach Google"));
ok("marked as a failure, not as an instruction",
   noteEl().classList.contains("is-error"));
ok("on a line that is actually visible", !noteEl().hidden);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
