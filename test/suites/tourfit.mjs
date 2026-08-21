// What the tour actually points at, measured.
//
// A step that says "two ways in" and lights up four buttons is a step that
// has stopped being an explanation. This walks every step in a real browser
// and checks the ring covers what the sentence is about — and nothing else
// that can be pressed.
import { launch } from "../lib/browser.js";

const STATE = {
  lang: "en", ownerUid: "me", currentDeck: "d000", currentIndex: -1,
  revealed: false, blanked: false, askedAt: Date.now(), pausedAt: null,
  seconds: 30, likes: 0, players: { me: "Marco" }, seen: { me: Date.now() },
  decks: [{ id: "d000", title: "Kickoff", count: 2, createdAt: null, lastRunAt: null }],
  questions: [
    { id: "q0", text: "One", correct: null, voters: {}, times: {},
      options: [{ id: "a", label: "A", votes: 0 }] },
    { id: "q1", text: "Two", correct: "a", voters: {}, times: {},
      options: [{ id: "a", label: "A", votes: 0 }] },
  ],
};

// step → what must be inside the ring, and what must not
const STEPS = [
  { lights: ["tab-setup", "tab-run"], spares: ["qr", "signout", "add-question"] },
  { lights: ["deck-new", "deck-open"], spares: ["add-question", "qr"] },
  { lights: ["add-question"], spares: ["deck-new", "language"] },
  { lights: ["language", "seconds"], spares: ["add-question"] },
  { lights: ["clear-room"], spares: ["language", "seconds", "add-question"] },
  { lights: ["qr", "bigscreen"], spares: ["signout", "tour"] },
  { lights: ["next"], spares: ["blank", "clear"] },
  { lights: ["blank", "clear"], spares: ["next", "prev"] },
  { lights: ["tour"], spares: ["qr", "bigscreen", "signout"] },
];

let bad = 0;
const b = await launch();

for (const [w, h] of [[390, 844], [1024, 700]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript((s) => { window.PREVIEW = s; window.SHOW_TOUR = true; }, STATE);
  await p.goto("http://127.0.0.1:8766/host.html", { waitUntil: "networkidle" });
  await p.waitForTimeout(700);

  for (let i = 0; i < STEPS.length; i++) {
    if (i) { await p.click(".tour-next"); await p.waitForTimeout(420); }
    const found = await p.evaluate((want) => {
      const ring = document.querySelector(".tour-ring").getBoundingClientRect();
      const note = document.querySelector(".tour-note").getBoundingClientRect();
      const covers = (id) => {
        const el = document.getElementById(id);
        if (!el || el.hidden || el.offsetParent === null) return null;
        const box = el.getBoundingClientRect();
        return box.left >= ring.left - 2 && box.right <= ring.right + 2 &&
          box.top >= ring.top - 2 && box.bottom <= ring.bottom + 2;
      };
      const out = [];
      for (const id of want.lights) {
        if (covers(id) === false) out.push(`doesn't light ${id}`);
      }
      for (const id of want.spares) {
        if (covers(id) === true) out.push(`also lights ${id}`);
      }
      if (note.left < 0 || note.right > innerWidth) out.push("the note is off the side");
      if (note.top < 0 || note.bottom > innerHeight) out.push("the note is off the screen");
      // The note must not sit on top of the thing it is pointing at.
      const over = !(note.bottom <= ring.top || note.top >= ring.bottom ||
        note.right <= ring.left || note.left >= ring.right);
      if (over) out.push("the note covers what it points at");
      return out;
    }, STEPS[i]);

    found.forEach((f) => { console.log(`  ✗ ${w}×${h} step ${i + 1}: ${f}`); bad++; });
  }
  if (!bad) console.log(`  ✓ ${w}×${h}: every step points at what it talks about`);
  await p.close();
}

await b.close();
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
