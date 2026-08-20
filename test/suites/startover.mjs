// Start over, and the reset button beside it — through the real js/host.js.
//
// The two used to overlap: one cleared the question on screen, the other went
// back to the top and left every answer from the last run in place, so a poll
// run twice showed the first run's results.

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
const label = (id) => $(id).querySelector(".btn-label").textContent;

const question = (id, votes) => ({
  id, text: `Question ${id}`, correct: null,
  options: [{ id: "a", label: "A", votes }, { id: "b", label: "B", votes: 0 }],
});
const snap = (over = {}) => sync.state.push({
  ownerUid: "host-uid", currentDeck: "d000", currentIndex: -1, revealed: false,
  blanked: false, askedAt: 0, seconds: 0, lang: "en", likes: 0, players: {},
  decks: [{ id: "d000", title: "Marco", count: 2 }],
  questions: [question("q000", 3), question("q001", 4)],
  ...over,
});

console.log("the button that clears one question");
snap({ currentIndex: 0 });
ok("says what it resets", label("reset") === "Reset votes");
ok("and the whole sentence is its accessible name",
   $("reset").getAttribute("aria-label") === "Reset this question’s votes");
ok("and is offered while one is up", !$("reset").disabled);
$("reset").click();
await tick();
ok("clears that question alone", called("resetVotes").length === 1 && called("resetVotes")[0].arg === "q000");
ok("and nothing else", called("resetAllVotes").length === 0);

console.log("with nothing on screen");
snap({ currentIndex: -1 });
ok("there is no one question to clear, so it is off", $("reset").disabled);

console.log("start over, with answers already given");
sync.state.calls = [];
$("clear").click();
await tick();
ok("asks first", !$("ask-overlay").hidden);
ok("saying how much is at stake", /7 votes/.test($("ask-title").textContent));
ok("and does nothing until answered", called("resetAllVotes").length === 0);

console.log("answering no");
$("ask-cancel").click();
await tick();
ok("keeps the votes", called("resetAllVotes").length === 0);
ok("and stays where it was", called("setCurrentIndex").length === 0);

console.log("answering yes");
$("clear").click();
await tick();
$("ask-form").dispatchEvent(new dom.window.Event("submit"));
await tick(); await tick();
ok("clears every question", called("resetAllVotes").length === 1);
ok("all of them, not just the one on screen", called("resetAllVotes")[0].arg.join() === "q000,q001");
ok("goes back to the top", called("setCurrentIndex").at(-1).arg === -1);
ok("with nothing on screen — the room waits for Start",
   called("setCurrentIndex").every((c) => c.arg === -1));

console.log("a poll nobody has answered yet");
sync.state.calls = [];
snap({ currentIndex: 0, questions: [question("q000", 0), question("q001", 0)] });
$("clear").click();
await tick();
ok("has nothing to lose, so it doesn't ask", $("ask-overlay").hidden);
ok("and doesn't write a reset nobody needs", called("resetAllVotes").length === 0);
ok("it just goes back to the top", called("setCurrentIndex").at(-1).arg === -1);

console.log("writing a question");
snap({ currentIndex: -1 });
ok("the form is not on screen to begin with", $("editor-sheet").hidden);
$("add-question").click();
await tick();
ok("Add question brings it up", !$("editor-sheet").hidden);
ok("as an empty form", $("question-input").value === "");
ok("with no character count until one is near", $("question-count").textContent === "");
$("ask-cancel").click(); // a stray Escape elsewhere must not close it
ok("still up", !$("editor-sheet").hidden);
$("cancel").click();
await tick();
ok("Cancel puts it away", $("editor-sheet").hidden);

console.log("editing one that exists");
snap({ currentIndex: -1 });
document.querySelectorAll(".qbtns .iconbtn")[2].click();
await tick();
ok("opens the same form", !$("editor-sheet").hidden);
ok("with the question in it", $("question-input").value === "Question q000");
ok("and its answers", $("options-input").value === "A\nB");
ok("the button says save rather than add", label("save") === "Save changes");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
