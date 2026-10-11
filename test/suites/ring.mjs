// The countdown ring, in a real browser, on the phone and the wall.
//
// It replaced a bar. What a person should see: a ring that drains with the
// time, the seconds in the middle, blue while there is time, amber from half
// way, red for the last five with each second popping — and on a phone, the
// ring beside "Question 2 of 5" rather than taking room from the answers.
import { readFileSync } from "node:fs";
import { launch, SITE } from "../lib/browser.js";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };

const css = readFileSync("../../css/style.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const NIGHT = ':root[data-theme="dark"] {';
const token = (block, name) => block.match(new RegExp(`${name}:\\s*([^;]+);`))[1].trim();
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const DAY = css.slice(css.indexOf(":root {"), css.indexOf(NIGHT));
const COLOUR = { calm: rgb(token(DAY, "--accent")), half: rgb(token(DAY, "--gold")), urgent: rgb(token(DAY, "--live")) };

const event = (gone) => ({
  lang: "en", ownerUid: "host", currentDeck: "d000", currentIndex: 0, revealed: false, blanked: false,
  askedAt: Date.now() - gone * 1000, pausedAt: null, seconds: 30, likes: 0,
  players: { me: "Ana", u1: "Bo" }, seen: { me: Date.now(), u1: Date.now() },
  decks: [{ id: "d000", title: "Offsite", count: 3 }],
  questions: [{ id: "q000", kind: "question", text: "Tea or coffee?", body: "", correct: null, voters: {},
    options: [{ id: "a", label: "Tea", votes: 1 }, { id: "b", label: "Coffee", votes: 0 }] }],
});

const read = (p) => p.evaluate(() => {
  const clock = document.getElementById("clock");
  const arc = clock.querySelector(".ring-arc");
  const number = document.getElementById("clock-time");
  const r = clock.getBoundingClientRect();
  return {
    shown: !clock.hidden && !clock.closest("[hidden]") && r.width > 0,
    phase: clock.dataset.phase,
    stroke: getComputedStyle(arc).stroke,
    offset: parseFloat(arc.style.strokeDashoffset),
    number: number.textContent,
    label: clock.getAttribute("aria-label"),
    rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
    popping: number.getAnimations().length > 0,
    pulsing: clock.querySelector(".ring").getAnimations().length > 0,
  };
});

const b = await launch();

for (const [name, file, viewport] of [
  ["the phone", "index.html", { width: 390, height: 844 }],
  ["the wall", "screen.html", { width: 1280, height: 720 }],
]) {
  console.log(name);
  for (const [gone, phase, left] of [[3, "calm", 27], [18, "half", 12], [27, "urgent", 3]]) {
    const ctx = await b.newContext({ viewport, colorScheme: "light" });
    const p = await ctx.newPage();
    await p.addInitScript((e) => { window.PREVIEW = e; }, event(gone));
    await p.goto(`${SITE}/${file}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(400);
    const m = await read(p);
    ok(`${gone}s into thirty: a ring, showing ${left}`, m.shown && m.number === String(left));
    ok(`  ${phase === "calm" ? "blue" : phase === "half" ? "amber" : "red"}`, m.phase === phase && m.stroke === COLOUR[phase]);
    // Drained by the share of the time gone, give or take the moment it took
    // to load: 100 is empty, 0 is full.
    ok(`  drained ${(gone / 30 * 100).toFixed(0)} in a hundred (${m.offset.toFixed(0)})`, Math.abs(m.offset - (gone / 30) * 100) < 6);
    ok("  and said in words", m.label === `${left}s`);
    ok("  round, not squashed", Math.abs(m.rect.width - m.rect.height) < 1);
    if (phase === "urgent") {
      await p.waitForTimeout(1100);
      const later = await read(p);
      ok("  the last seconds pop as they land", later.popping);
      ok("  and the ring breathes", later.pulsing);
    }
    if (file === "index.html" && phase === "calm") {
      const line = await p.evaluate(() => {
        const progress = document.getElementById("progress").getBoundingClientRect();
        const clock = document.getElementById("clock").getBoundingClientRect();
        const question = document.getElementById("question").getBoundingClientRect();
        return { progress, clock, question };
      });
      ok("  on the same line as \"Question 1 of 3\"",
         line.clock.top < line.progress.bottom && line.clock.bottom > line.progress.top);
      ok("  at its right-hand end", line.clock.left > line.progress.right);
      ok("  above the question, not between it and the answers", line.clock.bottom <= line.question.top + 1);
    }
    await ctx.close();
  }
}

console.log("someone who asked for less motion");
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.addInitScript((e) => { window.PREVIEW = e; }, event(27));
  await p.goto(`${SITE}/index.html`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1100);
  const m = await read(p);
  ok("still sees the ring turn red", m.phase === "urgent" && m.stroke === COLOUR.urgent);
  ok("without the pop or the pulse", !m.popping && !m.pulsing);
  await ctx.close();
}

console.log("with no time limit");
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.addInitScript((e) => { window.PREVIEW = { ...e, seconds: 0 }; }, event(3));
  await p.goto(`${SITE}/index.html`, { waitUntil: "networkidle" });
  ok("there is no ring", !(await read(p)).shown);
  await ctx.close();
}

await b.close();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
