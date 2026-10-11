// A Google account that is signed in but doesn't own the event, through the
// real js/host.js.
//
// The bug this exists for: Add question still opened the editor for such an
// account, as a half-transparent sheet whose question and answer boxes took
// no typing while its pickers carried on working. Two bugs to the person
// looking at it, one cause underneath — and nothing on the page said why.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const page = readFileSync("../../host.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://example.test/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false });
dom.window.matchMedia = globalThis.matchMedia;
// The tour shows itself once per browser; this suite is not that once.
dom.window.localStorage.setItem("votr-tour-seen", "1");
globalThis.location = dom.window.location;

const sync = await import("../build/sync-host.js");
await import("../build/host.js");
await new Promise((r) => setTimeout(r, 0));

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const $ = (id) => document.getElementById(id);
// Shown means not hidden by itself or by anything it sits inside.
const shown = (el) => Boolean(el) && !el.hidden && !el.closest("[hidden]");

const snap = (over = {}) => sync.state.push({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
  blanked: false, askedAt: 0, seconds: 30, lang: "en", likes: 0, players: {},
  decks: [{ id: "d000", title: "Offsite", count: 1 }],
  questions: [{ id: "q000", text: "Q", correct: null,
    options: [{ id: "a", label: "A", votes: 0 }, { id: "b", label: "B", votes: 0 }] }],
  ...over,
});

const editorControls = () => [...$("editor").elements].filter((c) => c !== $("cancel"));

console.log("the owner");
snap();
ok("sees no view-only notice", !shown($("view-only")));
ok("can press Add question", !$("add-question").disabled);
$("add-question").click();
await tick();
ok("which opens the editor", shown($("editor-sheet")));
ok("with the question box taking typing", !$("question-input").disabled);
ok("and the answers box", !$("options-input").disabled);
ok("and every other control in it", editorControls().every((c) => !c.disabled));

console.log("the event changes hands while the form is open");
snap({ ownerUid: "someone-else" });
await tick();
ok("the form closes rather than going dead under the cursor", !shown($("editor-sheet")));

console.log("a signed-in account that isn't the owner");
ok("is told, at the top of the page", shown($("view-only")));
ok("in words that say what it can't do",
   $("view-only").textContent.includes("only that account can add questions"));
ok("and how to change that", $("view-only").textContent.includes("sign out and sign in"));
ok("cannot press Add question", $("add-question").disabled);
ok("or Add text slide", $("add-slide").disabled);
$("add-question").click();
await tick();
ok("and pressing it anyway opens nothing", !shown($("editor-sheet")));
ok("every control in the form is off, not only the text boxes",
   editorControls().every((c) => c.disabled));
ok("the question type picker included", $("question-type").disabled);

console.log("on the Run tab too");
$("tab-run").click();
await tick();
ok("the notice is still there", shown($("view-only")));
ok("and Next is off", $("next").disabled);
$("tab-setup").click();
await tick();

console.log("in another language");
snap({ ownerUid: "someone-else", lang: "pt" });
await tick();
ok("the notice follows the room's language",
   $("view-only").querySelector(".notice-title").textContent === "Apenas leitura");
snap({ ownerUid: "someone-else", lang: "en" });
await tick();

console.log("a visitor who hasn't signed in");
sync.state.anonymous = true;
snap({ ownerUid: "someone-else" });
await tick();
ok("is asked to sign in, not told about another account", !shown($("view-only")));
sync.state.anonymous = false;

console.log("the owner again");
snap();
await tick();
ok("the notice goes", !shown($("view-only")));
ok("and Add question comes back", !$("add-question").disabled);
$("add-question").click();
await tick();
ok("opening a form that takes typing", shown($("editor-sheet")) && !$("question-input").disabled);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
