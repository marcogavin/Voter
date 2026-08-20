// The account line, in the gap between the gate opening and the first
// snapshot landing.
//
// The page ships gated and opens for a signed-in host as soon as connect()
// resolves — auth is settled by then, so there's no reason to wait on the
// database for that. But the account line's *text* used to be written only
// inside render(), which does wait on the database: for however long the
// first snapshot takes, a host who was already signed in read their own
// name as a blank line under the Sign out button.

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
dom.window.localStorage.setItem("votr-tour-seen", "1");
globalThis.location = dom.window.location;

// Already signed in — state.anonymous defaults to false — and no snapshot
// pushed yet. This is the gap the gate opens into.
const sync = await import("../build/sync-host.js");
await import("../build/host.js");
await tick();

const $ = (id) => document.getElementById(id);

console.log("the moment the gate opens, before any snapshot has landed");
ok("the account line is already showing", !$("account").hidden);
ok("and it already carries a name, not a blank line",
   $("account").textContent.trim() === "Signed in as marco@example.test");
ok("the sign-in prompt is the one that's hidden", $("signed-out").hidden);

console.log("once the first snapshot lands");
sync.state.push({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
  blanked: false, askedAt: null, pausedAt: null, seconds: 30, lang: "en",
  likes: 0, players: {}, seen: {}, questions: [],
  decks: [{ id: "d000", title: "", count: 0, createdAt: null, lastRunAt: null }],
});
await tick();
ok("the same name is still there", $("account").textContent.trim() === "Signed in as marco@example.test");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
