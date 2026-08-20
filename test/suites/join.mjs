// The join screen, driven through the real js/app.js in a real DOM.
//
// The bug this exists for: a refused write is rolled back by Firebase, which
// re-renders the screen — so the message explaining the refusal was being
// written to a form that had already been thrown away, and the name looked
// like it had simply vanished.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const page = readFileSync("../../index.html", "utf8")
  .replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://example.test/" });

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false });
dom.window.matchMedia = globalThis.matchMedia;

const sync = await import("../build/sync-audience.js");
const app = await import("../build/app.js");
await new Promise((r) => setTimeout(r, 0)); // start() awaits connect()

let failed = 0;
const ok = (label, cond) => {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failed++;
};
const $ = (id) => document.getElementById(id);
const text = (id) => ($(id) ? $(id).textContent.trim() : null);

const EVENT = {
  lang: "en", players: {}, questions: [], currentIndex: -1,
  revealed: false, blanked: false, askedAt: 0, seconds: 30, likes: 0,
  deckTitle: "", ownerUid: "host",
};
const snapshot = (over = {}) => ({ ...EVENT, ...over, players: { ...EVENT.players, ...(over.players || {}) } });

console.log("a phone that hasn't given a name");
sync.state.push(snapshot());
ok("is asked for one", text("question") === "What’s your name?");
ok("gets a field to type in", Boolean($("join-name")));
ok("with the plain note under it", text("join-note") === "Everyone in the room can see this.");

console.log("the name is accepted");
$("join-name").value = "  Marco  ";
await $("join").dispatchEvent(new dom.window.Event("submit"));
await new Promise((r) => setTimeout(r, 0));
ok("trimmed before it is stored", sync.state.saved.at(-1) === "Marco");
ok("the form is gone", !$("join"));
ok("without waiting for a snapshot", app.__latest().players.u1 === "Marco");
ok("and the name is on screen", document.querySelector(".whoami-name").textContent === "Marco");

console.log("the database refuses it (rules not republished)");
// Firebase applies the write locally, tells the room, then takes it back when
// the server rejects it — so the screen renders twice before the error lands.
let reject;
sync.state.saved = [];
sync.state.nextSave = () => new Promise((_, no) => { reject = no; });
sync.state.push(snapshot()); // the rollback: no name on the event
ok("back to the join screen", Boolean($("join")));
$("join-name").value = "Marco";
$("join").dispatchEvent(new dom.window.Event("submit"));
await new Promise((r) => setTimeout(r, 0));
sync.state.push(snapshot({ players: { u1: "Marco" } })); // optimistic
ok("which briefly looks like it worked", !$("join"));
sync.state.push(snapshot()); // rolled back
reject(new Error("PERMISSION_DENIED: Permission denied"));
await new Promise((r) => setTimeout(r, 0));

ok("the form comes back", Boolean($("join")));
ok("saying why, not silently", /refused it/.test(text("join-note")));
ok("naming the refusal", /PERMISSION_DENIED/.test(text("join-note")));
ok("marked as an error", $("join-note").className.includes("is-error"));
ok("with the typed name still there", $("join-name").value === "Marco");
ok("and the badge says refused", text("status") === "Refused");

console.log("trying again once the rules are published");
sync.state.nextSave = null;
$("join").dispatchEvent(new dom.window.Event("submit"));
await new Promise((r) => setTimeout(r, 0));
ok("goes through", !$("join"));

console.log("re-typing the same name");
document.getElementById("whoami").dispatchEvent(new dom.window.Event("click"));
ok("reopens the join screen", Boolean($("join")));
ok("with the old error cleared off it", text("join-note") === "Everyone in the room can see this.");
$("join-name").value = "Marco";
$("join").dispatchEvent(new dom.window.Event("submit"));
await new Promise((r) => setTimeout(r, 0));
ok("closes it again even though nothing changed", !$("join"));

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
