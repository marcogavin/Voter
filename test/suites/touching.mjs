// Boxes that touch. Anything with its own ground or edge should either be
// clearly apart from its neighbour or clearly inside it — a 1–5px gap reads
// as a mistake, and a 0px one reads as a bug.
import { launch } from "../lib/browser.js";

const day = 86400000;
const STATE = {
  lang: "en", ownerUid: "me", currentDeck: "d000", currentIndex: 0,
  revealed: false, blanked: false, askedAt: Date.now() - 9000, seconds: 30,
  likes: 42, players: { me: "Marco" },
  decks: [
    { id: "d000", title: "Kickoff 2026", count: 3, createdAt: Date.now() - 30 * day, lastRunAt: Date.now() - 2 * day },
    { id: "d001", title: "Product Q&A", count: 5, createdAt: Date.now() - 3 * day, lastRunAt: null },
  ],
  questions: [
    { id: "q0", text: "In a perfect world, what would ice cream be made of?", correct: "e", voters: {},
      options: [["a","Chocolate",4],["b","Rainbows",11],["c","Hagelslag",7],["d","Super kali fragilistic expi Ali go cloud",2],["e","Noice!",9]]
        .map(([id,label,votes])=>({id,label,votes})) },
    { id: "q1", text: "Second", correct: null, voters: {}, options: [{ id: "a", label: "A", votes: 1 }] },
  ],
};

const MIN = 6; // px: below this two grounds read as touching

const measure = (MIN) => {
  const shown = (el) => el.offsetParent !== null || el === document.body;
  const grounded = (el) => {
    const s = getComputedStyle(el);
    const hasFill = s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundImage === "none";
    const hasEdge = ["Top", "Right", "Bottom", "Left"].some(
      (side) => parseFloat(s["border" + side + "Width"]) > 0 &&
        s["border" + side + "Style"] !== "none" &&
        s["border" + side + "Color"] !== "rgba(0, 0, 0, 0)",
    );
    return hasFill || hasEdge;
  };
  const name = (el) =>
    el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "");

  const out = [];
  for (const parent of document.querySelectorAll("body *")) {
    const kids = [...parent.children].filter((el) => shown(el) && grounded(el));
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect();
      const b = kids[i].getBoundingClientRect();
      if (!a.height || !b.height) continue;
      const vertical = b.top - a.bottom;
      const overlapsHorizontally = b.left < a.right - 1 && a.left < b.right - 1;
      if (overlapsHorizontally && vertical < MIN) {
        out.push(`${name(kids[i - 1])} → ${name(kids[i])}: ${vertical.toFixed(1)}px apart`);
      }
    }
    // A box inside a box: two visible edges a hair apart is the thing that
    // reads as a mistake. A fill sitting flush inside its own card is not —
    // that is a background doing its job — so both sides must have an edge.
    const edged = (el) => {
      const s = getComputedStyle(el);
      return ["Top", "Right", "Bottom", "Left"].some(
        (side) => parseFloat(s["border" + side + "Width"]) > 0 &&
          s["border" + side + "Style"] !== "none" &&
          s["border" + side + "Color"] !== "rgba(0, 0, 0, 0)",
      );
    };
    if (edged(parent)) {
      const inner = [...parent.children].filter((el) => shown(el) && edged(el));
      const p = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      const cap = (side) => side[0].toUpperCase() + side.slice(1);
      for (const kid of inner) {
        const k = kid.getBoundingClientRect();
        const gaps = { top: k.top - p.top, bottom: p.bottom - k.bottom, left: k.left - p.left, right: p.right - k.right };
        for (const [side, gap] of Object.entries(gaps)) {
          // Only where the parent actually draws an edge on that side: a bar
          // with a rule along its top isn't crowding anything on its right.
          const drawn = parseFloat(style["border" + cap(side) + "Width"]) > 0 &&
            style["border" + cap(side) + "Style"] !== "none" &&
            style["border" + cap(side) + "Color"] !== "rgba(0, 0, 0, 0)";
          if (drawn && gap > -0.5 && gap < MIN && parseFloat(style["padding" + cap(side)]) < MIN) {
            out.push(`${name(kid)} sits ${gap.toFixed(1)}px from the ${side} edge of ${name(parent)}`);
          }
        }
      }
    }
  }
  return [...new Set(out)];
};

const b = await launch();
let found = 0;
for (const [label, page, dark, act] of [
  ["host setup", "host.html", true, null],
  ["host run", "host.html", true, (p) => p.click("#tab-run")],
  ["host picker", "host.html", true, (p) => p.click("#deck-open")],
  ["host editor", "host.html", true, (p) => p.click("#add-question")],
  ["audience question", "index.html", true, null],
  ["host setup (light)", "host.html", false, null],
  ["host run (light)", "host.html", false, (p) => p.click("#tab-run")],
]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: dark ? "dark" : "light" });
  await p.addInitScript((s) => { window.PREVIEW = s; }, STATE);
  await p.goto("http://127.0.0.1:8766/" + page, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  if (act) { await act(p); await p.waitForTimeout(400); }
  const hits = await p.evaluate(measure, MIN);
  console.log(`${label}${hits.length ? "" : " — clear"}`);
  hits.forEach((h) => { console.log("   ✗ " + h); found++; });
  await p.close();
}
await b.close();
console.log(found ? `\n${found} places where grounds touch or nearly touch` : "\nnothing touching");
process.exit(found ? 1 : 0);
