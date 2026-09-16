// A phone at the end of a run: on the board, not on the board, and a room where nobody answered.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
const page = readFileSync("../../index.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(page, { url: "https://example.test/" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.matchMedia = () => ({ matches: false }); dom.window.matchMedia = globalThis.matchMedia;
const sync = await import("../build/sync-audience.js");
await import("../build/app.js");
await new Promise((r) => setTimeout(r, 0));
const base = { lang: "en", ownerUid: "host", blanked: false, revealed: false, askedAt: Date.now(), pausedAt: null,
  seconds: 30, likes: 0, seen: {}, players: { u1: "Ana", u2: "Bo" } };
const q = (id, correct, voters) => ({ id, text: "", correct, voters, times: {}, ratingStars: null, ratingColor: null, options: [] });
const run = (label, over) => {
  try { sync.state.push({ ...base, ...over }); console.log("ok  ", label, "->", document.getElementById("options").dataset.screen, "|", document.getElementById("question").textContent); }
  catch (e) { console.log("THREW", label, "->", e.message); }
};
// this phone is u1
run("u1 answered a scored question", { currentIndex: 2, questionCount: 2, questions: [q("q000", "a", { u1: "a", u2: "b" }), q("q001", null, {})] });
run("u1 answered nothing scored, u2 did", { currentIndex: 2, questionCount: 2, questions: [q("q000", "a", { u2: "b" }), q("q001", null, {})] });
run("nobody answered anything", { currentIndex: 2, questionCount: 2, questions: [q("q000", "a", {}), q("q001", null, {})] });
run("then the heart", { currentIndex: 3, questionCount: 2, questions: [q("q000", "a", {}), q("q001", null, {})] });
run("no players node at all", { currentIndex: 2, questionCount: 2, players: { u1: "Ana" }, questions: [q("q000", "a", {})] });
