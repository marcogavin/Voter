// Every pair of colours that ends up as text on a ground, in both palettes.
import { readFileSync } from "node:fs";
const css = readFileSync("../../css/style.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const darkBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
const dark = { ...light, ...tokens(darkBlock.slice(0, darkBlock.indexOf("}\n\n  /*"))) };

const hex = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [text, ground, minimum, what it is]
const PAIRS = [
  ["--ink", "--paper", 4.5, "body text on the panel"],
  ["--muted", "--paper", 4.5, "a note on the panel"],
  ["--accent", "--paper", 4.5, "a section heading"],
  ["--ink", "--surface", 4.5, "body text in a sheet"],
  ["--ink", "--card", 4.5, "body text on a card"],
  ["--muted", "--card", 4.5, "a share, on a card nobody claimed"],
  ["--ink", "--flat", 4.5, "an answer over the neutral share"],
  ["--ink", "--flat", 4.5, "its percentage, over the same"],
  ["--ink", "--sunken", 4.5, "text you type into a field"],
  ["--muted", "--surface", 4.5, "labels and notes"],
  ["--muted", "--sunken", 4.5, "a select's own text"],
  ["--accent", "--surface", 4.5, "the accent as text"],
  ["--accent", "--accent-soft", 4.5, "an icon on its tinted ground"],
  ["--on-accent", "--accent", 4.5, "a primary button's label"],
  ["--ink", "--vote-soft", 4.5, "an answer you voted for"],
  ["--ink", "--right-soft", 4.5, "the right answer"],
  ["--ink", "--wrong-soft", 4.5, "your wrong answer"],
  ["--ink", "--vote-soft", 4.5, "its share, in the same card"],
  ["--ink", "--right-soft", 4.5, "its share, in the same card"],
  ["--ink", "--wrong-soft", 4.5, "its share, in the same card"],
  ["--vote", "--surface", 3, "the border of your pick"],
  ["--right", "--surface", 3, "the border of the right answer"],
  ["--wrong", "--surface", 3, "the border of your wrong one"],
  ["--on-accent", "--vote", 4.5, "the tick inside your mark"],
  ["--on-accent", "--right", 4.5, "the ✓ inside the right mark"],
  ["--on-accent", "--wrong", 4.5, "the ✗ inside your wrong mark"],
  // The badge's own text is the accent; --live is the 7px dot beside it,
  // which is a shape rather than a word and answers to the 3:1 line.
  ["--live", "--surface", 3, "the on-air dot"],
  ["--ink", "--gold-soft", 4.5, "the winner's name"],
  ["--gold-ink", "--gold-soft", 4.5, "their place and their cup"],
  ["--gold", "--card", 3, "the border of the winner's row"],
  ["--tour", "--surface", 4.5, "what the tour says, on its own card"],
  ["--tour", "--paper", 3, "the ring it draws around a control"],
  ["--tour-ink", "--tour", 4.5, "the label on its one button"],
  ["--muted", "--surface", 4.5, "its step count and its way out"],
];

let bad = 0;
for (const [name, palette] of [["light", light], ["dark", dark]]) {
  console.log(name);
  for (const [fg, bg, min, what] of PAIRS) {
    const r = ratio(palette[fg], palette[bg]);
    const ok = r >= min;
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${r.toFixed(2)}:1 (needs ${min}) — ${what}`);
  }
}
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
