// The big screen, measured in a real browser at the sizes projectors come in.
//
// This page is the one place in the app where nothing can be scrolled to: the
// body clips, so anything that doesn't fit is simply not there — and nobody in
// the room can do a thing about it. So every screen is measured at four shapes
// of display, in the language with the longest words, and in both palettes.
import { launch } from "../lib/browser.js";

const q = (id, text, opts, voters = {}, correct = null) => ({
  id, text, correct, voters,
  options: opts.map(([id, label, votes]) => ({ id, label, votes })),
});

// A full room: the scores screen has to hold what it can and count the rest,
// at every shape of display, without a row running under the header.
const many = {};
("Ana Bo Chen Dee Eve Finn Gus Hana Iris Jo Kit Lars Mia Noor Otto Pia " +
 "Quinn Rui Sam Tess Uma Vik Wen Xan").split(" ")
  .forEach((name, i) => { many["u" + i] = name; });

const LONG = "Looking back at the last twelve months, which of these do you think made the biggest difference to how the team actually works?";

const BASE = {
  lang: "en", ownerUid: "host", currentDeck: "d000", currentIndex: -1,
  revealed: false, blanked: false, askedAt: Date.now() - 9000, pausedAt: null,
  seconds: 30, likes: 128, players: many,
  decks: [{ id: "d000", title: "Kickoff 2026 — the whole company", count: 2 }],
  questions: [
    q("q0", LONG,
      ["Weekly planning", "Fewer meetings", "The new deploy pipeline",
       "Pairing on Fridays", "Writing things down", "Honestly, none of it"]
        .map((label, i) => ["abcdef"[i], label, [12, 30, 8, 3, 17, 5][i]])),
    {
    ...q("q1", "Which city hosts the summit?",
      [["a", "Lisbon", 12], ["b", "Zurich", 31], ["c", "Berlin", 6]],
      Object.fromEntries(Object.keys(many).map((u, n) => [u, n % 3 ? "b" : "a"])), "b"),
    times: Object.fromEntries(Object.keys(many).map((u, n) => [u, 1500 + n * 700])),
  },
  ],
};

const SCREENS = {
  join: { currentIndex: -1 },
  question: { currentIndex: 0 },
  revealed: { currentIndex: 1, revealed: true },
  scores: { currentIndex: 2, revealed: true },
  ending: { currentIndex: 3, revealed: true },
};

// Same rule as touching.mjs: two grounds a hair apart read as a mistake.
const MIN = 6;

const measure = (MIN) => {
  const out = [];
  const name = (el) =>
    el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).join(".") : "");

  // What is laid out in flow. Confetti and hearts are in flight: they are
  // absolutely positioned, they overlap each other on purpose, and they leave
  // the screen by design — measuring them would fail every celebration.
  const flowing = (el) => getComputedStyle(el).position === "static";

  // Nothing may be clipped: the page can't be scrolled by anyone watching it.
  const wall = document.querySelector(".big").getBoundingClientRect();
  const stage = document.querySelector(".big-stage").getBoundingClientRect();
  const inside = (r, box) =>
    r.top >= box.top - 1 && r.bottom <= box.bottom + 1 &&
    r.left >= box.left - 1 && r.right <= box.right + 1;

  for (const el of document.querySelectorAll(".big > *")) {
    const r = el.getBoundingClientRect();
    if (r.height && !inside(r, wall)) out.push(`${name(el)} is outside the wall`);
  }
  for (const el of document.querySelectorAll(".big-stage > *")) {
    if (!flowing(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height && !inside(r, stage)) out.push(`${name(el)} is cut off by the stage`);
  }

  // …and nothing overlaps the header, which is the one thing drawn over the
  // top of a stage that centres itself.
  const top = document.querySelector(".big-top").getBoundingClientRect();
  for (const el of document.querySelectorAll(".big-stage > *")) {
    const r = el.getBoundingClientRect();
    if (r.height && flowing(el) && r.top < top.bottom - 1) {
      out.push(`${name(el)} runs under the header`);
    }
  }

  // Grounds that touch, the same measure the phone screens answer to.
  const shown = (el) => el.offsetParent !== null;
  const grounded = (el) => {
    const s = getComputedStyle(el);
    return (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundImage === "none") ||
      ["Top", "Right", "Bottom", "Left"].some((side) =>
        parseFloat(s["border" + side + "Width"]) > 0 &&
        s["border" + side + "Style"] !== "none" &&
        s["border" + side + "Color"] !== "rgba(0, 0, 0, 0)");
  };
  for (const parent of document.querySelectorAll("body *")) {
    const kids = [...parent.children].filter(
      (el) => shown(el) && flowing(el) && grounded(el),
    );
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect();
      const b = kids[i].getBoundingClientRect();
      if (!a.height || !b.height) continue;
      const gap = b.top - a.bottom;
      const sideBySide = b.left < a.right - 1 && a.left < b.right - 1;
      if (sideBySide && gap < MIN) {
        out.push(`${name(kids[i - 1])} → ${name(kids[i])}: ${gap.toFixed(1)}px apart`);
      }
    }
  }
  return [...new Set(out)];
};

const b = await launch();
let bad = 0;

for (const [w, h] of [[1280, 720], [1024, 768], [1920, 1080], [1366, 768]]) {
  for (const lang of ["de", "en"]) {
    const dark = lang === "en";
    const p = await b.newPage({
      viewport: { width: w, height: h },
      colorScheme: dark ? "dark" : "light",
    });
    let hits = 0;
    for (const [name, over] of Object.entries(SCREENS)) {
      await p.addInitScript((s) => { window.PREVIEW = s; }, { ...BASE, ...over, lang });
      await p.goto("http://127.0.0.1:8766/screen.html", { waitUntil: "networkidle" });
      await p.waitForTimeout(350);
      const found = await p.evaluate(measure, MIN);
      found.forEach((f) => { console.log(`  ✗ ${w}×${h} ${lang} ${name}: ${f}`); hits++; });

      if (name === "scores") {
        const board = await p.evaluate(() => ({
          rows: document.querySelectorAll(".board-row").length,
          more: document.querySelector(".board-more")?.textContent ?? "",
          columns: getComputedStyle(document.querySelector(".board")).gridTemplateColumns,
        }));
        if (board.rows < 4) {
          console.log(`  ✗ ${w}×${h} ${lang}: only ${board.rows} names fit`);
          hits++;
        }
        if (board.columns !== "none") {
          console.log(`  ✗ ${w}×${h} ${lang}: the board split into columns`);
          hits++;
        }
        if (!board.more) {
          console.log(`  ✗ ${w}×${h} ${lang}: the names it couldn't fit went unmentioned`);
          hits++;
        }
      }
    }
    bad += hits;
    if (!hits) console.log(`  ✓ ${w}×${h} ${lang}${dark ? " dark" : ""}: every screen fits, nothing touching`);
    await p.close();
  }
}

await b.close();
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
