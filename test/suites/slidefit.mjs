// A slide on the big screen, measured in a real browser.
//
// A slide is the one thing on the wall nobody sizes by hand: no font, no size,
// no alignment to pick. So the page has to get it right on its own, for any
// amount of text on any shape of display — and "right" is four things that
// can each be measured: nothing spills off the stage, nothing is broken
// mid-word, it sits in the middle both ways, and it uses the room it has
// rather than sitting small in the middle of a wall.
import { launch, SITE } from "../lib/browser.js";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };

const words = "Thanks for coming today we will split into groups and each group takes one theme from this morning and comes back with one thing it would change ".repeat(10);
const cut = (n) => words.slice(0, n).trim();

// The editor's limits: an 80-character title, a 280-character text in at
// most six lines. Every case here is at or past one of them, because that is
// where a slide comes out smallest.
const SLIDES = {
  "a short title alone": { text: "Coffee break", body: "" },
  "a title at its limit": { text: cut(80), body: "" },
  "a text at its limit": { text: "", body: cut(280) },
  "both at their limits": { text: cut(80), body: cut(280) },
  "a title and six short lines": {
    text: cut(80), body: Array.from({ length: 6 }, (_, i) => `Line ${i + 1}`).join("\n"),
  },
  "a title and six full lines": {
    text: cut(80),
    body: Array.from({ length: 6 }, (_, i) => `Point ${i + 1} ` + cut(38)).join("\n").slice(0, 280),
  },
  "a word longer than most lines": {
    text: "Internationalisation",
    body: "Supercalifragilisticexpialidocious, and other words that must never be broken in half.",
  },
};

// Nobody writes these on purpose; somebody pastes one by accident. They may
// be broken mid-word — it's the lesser harm — but they still may not spill
// or come out unreadably small.
const HOSTILE = {
  "one 280-character word": { text: "", body: "x".repeat(280) },
  "a title and a text that are each one word": { text: "y".repeat(80), body: "x".repeat(280) },
};

// The shapes projectors, TVs and laptop windows come in — including a
// portrait one, which is the hardest for a long heading.
const SHAPES = [[1280, 720], [1920, 1080], [1024, 768], [3840, 2160], [1366, 768], [800, 1280]];

const event = (slide) => ({
  lang: "en", ownerUid: "host", currentDeck: "d000", currentIndex: 0,
  revealed: false, blanked: false, askedAt: Date.now(), pausedAt: null,
  seconds: 30, likes: 0, players: { u1: "Ana" }, seen: { u1: Date.now() },
  decks: [{ id: "d000", title: "Offsite", count: 2 }],
  questions: [
    { id: "q000", kind: "slide", text: slide.text, body: slide.body, number: null,
      correct: null, voters: {}, options: [] },
    { id: "q001", kind: "question", text: "Tea or coffee?", body: "", number: 1,
      correct: null, voters: {}, options: [{ id: "a", label: "Tea", votes: 0 }, { id: "b", label: "Coffee", votes: 0 }] },
  ],
});

const b = await launch();

for (const [name, slide, hostile] of [
  ...Object.entries(SLIDES).map(([n, sl]) => [n, sl, false]),
  ...Object.entries(HOSTILE).map(([n, sl]) => [n, sl, true]),
]) {
  console.log(name);
  for (const [w, h] of SHAPES) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript((e) => { window.PREVIEW = e; }, event(slide));
    await p.goto(`${SITE}/screen.html`, { waitUntil: "networkidle" });
    await p.waitForSelector(".big-slide", { timeout: 5000 });

    const m = await p.evaluate(() => {
      const stage = document.getElementById("stage");
      const box = stage.getBoundingClientRect();
      const cs = getComputedStyle(stage);
      const inner = {
        top: box.top + parseFloat(cs.paddingTop),
        bottom: box.bottom - parseFloat(cs.paddingBottom),
        left: box.left,
        right: box.right,
      };
      const slide = document.querySelector(".big-slide");
      const parts = [...slide.children];
      // The text itself, not its boxes: a line can be narrower than the box
      // it sits in, and the words are what has to be in the middle.
      const range = document.createRange();
      range.selectNodeContents(slide);
      const ink = range.getBoundingClientRect();
      const visible = (id) => {
        const el = document.getElementById(id);
        return Boolean(el) && !el.hidden && !el.closest("[hidden]");
      };
      return {
        inner,
        ink: { top: ink.top, bottom: ink.bottom, left: ink.left, right: ink.right },
        size: parseFloat(getComputedStyle(slide).fontSize),
        smallest: Math.min(...parts.map((part) => parseFloat(getComputedStyle(part).fontSize))),
        measure: slide.clientWidth,
        broken: parts.some((part) => part.scrollWidth > part.clientWidth + 1),
        centredText: parts.every((part) => getComputedStyle(part).textAlign === "center"),
        chrome: ["votes", "join", "foot", "progress", "clock"].filter(visible),
      };
    });

    const tag = `${w}×${h}`;
    const stageH = m.inner.bottom - m.inner.top;
    const stageW = m.inner.right - m.inner.left;
    const inkH = m.ink.bottom - m.ink.top;
    const inkW = m.ink.right - m.ink.left;

    const inside =
      m.ink.top >= m.inner.top - 1 && m.ink.bottom <= m.inner.bottom + 1 &&
      m.ink.left >= m.inner.left - 1 && m.ink.right <= m.inner.right + 1;
    const middleY = Math.abs((m.ink.top + m.ink.bottom) / 2 - (m.inner.top + m.inner.bottom) / 2);
    const middleX = Math.abs((m.ink.left + m.ink.right) / 2 - (m.inner.left + m.inner.right) / 2);
    // Uses the room: tall enough to fill most of the stage, or wide enough
    // to fill most of its measure, or held back by the ceiling on purpose.
    const ceiling = Math.min(stageH * 0.16, m.inner.right * 0.09);
    const fills = inkH >= stageH * 0.5 || inkW >= stageW * 0.6 || m.size >= ceiling * 0.95;
    // Side margins: never closer to the edge than the measure allows.
    const sides = m.ink.left - m.inner.left >= stageW * 0.04 && m.inner.right - m.ink.right >= stageW * 0.04;

    ok(`${tag}: nothing spills off the stage`, inside);
    if (!hostile) ok(`${tag}: no word is broken in half`, !m.broken);
    // Readable from the back: the same floor the wall fits to, against the
    // stage's shorter side (its height on a projector, its width on end).
    const floor = Math.min(stageH, m.measure) * 0.045;
    ok(`${tag}: readable — smallest text ${m.smallest.toFixed(0)}px, floor ${floor.toFixed(0)}px`, m.smallest >= floor - 0.5);
    ok(`${tag}: centred across (off by ${middleX.toFixed(1)}px)`, middleX <= 3 && m.centredText);
    ok(`${tag}: centred top to bottom (off by ${middleY.toFixed(1)}px)`, middleY <= stageH * 0.03 + 2);
    ok(`${tag}: room left on both sides (${(m.ink.left - m.inner.left).toFixed(0)}px / ${(m.inner.right - m.ink.right).toFixed(0)}px of ${stageW.toFixed(0)})`, sides);
    ok(`${tag}: big enough to fill the wall (${m.size.toFixed(0)}px)`, fills);
    ok(`${tag}: nothing else on the wall`, m.chrome.length === 0);
    await p.close();
  }
}

console.log("the next question, after the slide");
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const e = event(SLIDES["a short title alone"]);
  await p.addInitScript((ev) => { window.PREVIEW = { ...ev, currentIndex: 1 }; }, e);
  await p.goto(`${SITE}/screen.html`, { waitUntil: "networkidle" });
  await p.waitForSelector(".big-question", { timeout: 5000 });
  const progress = await p.textContent("#progress");
  ok("is question 1 of 1 — the slide isn't counted", progress === "Question 1 of 1");
  ok("and its code and count are back", await p.isVisible("#join"));
  await p.close();
}

console.log("resizing the window");
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript((e) => { window.PREVIEW = e; }, event(SLIDES["both at their limits"]));
  await p.goto(`${SITE}/screen.html`, { waitUntil: "networkidle" });
  await p.waitForSelector(".big-slide");
  const before = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".big-slide")).fontSize));
  await p.setViewportSize({ width: 1920, height: 1080 });
  await p.waitForTimeout(200);
  const after = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".big-slide")).fontSize));
  ok(`a bigger window gets bigger text (${before.toFixed(0)}px → ${after.toFixed(0)}px)`, after > before * 1.2);
  await p.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
