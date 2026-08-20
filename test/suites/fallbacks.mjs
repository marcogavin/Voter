// The text in the markup is what shows for the instant before the script
// runs, so it has to be the English string the script would put there. A
// fallback that drifts is a flash of stale wording nobody sees in testing.
import { readFileSync } from "node:fs";
const R = "../../";
const src = readFileSync(R + "js/i18n.js", "utf8");
const en = src.slice(src.indexOf("  en: {"), src.indexOf("  pt: {"));
const val = {};
for (const m of en.matchAll(/^    (\w+): "((?:[^"\\]|\\.)*)",$/gm)) val[m[1]] = m[2].replace(/\\n/g, "\n");

let bad = 0;
const fail = (msg) => { console.log("  ✗ " + msg); bad++; };
for (const f of ["host.html", "index.html"]) {
  const h = readFileSync(R + f, "utf8");
  for (const [, k, text] of h.matchAll(/data-i18n="(\w+)"[^>]*>\s*([^<]*?)\s*</g)) {
    if (!(k in val)) { fail(`${f}: no such key: ${k}`); continue; }
    const want = val[k].replace(/\{[^}]+\}/g, "").trim();
    if (text && !text.includes(want.split("—")[0].trim()) && text !== val[k]) {
      fail(`${f}: ${k} — markup "${text}", i18n "${val[k]}"`);
    }
  }
  for (const [, k, ph] of h.matchAll(/data-i18n-placeholder="(\w+)"[\s\S]{0,120}?placeholder="([^"]*)"/g)) {
    if (ph !== val[k].replace(/\n/g, "&#10;")) fail(`${f}: placeholder ${k} — markup "${ph}", i18n "${val[k]}"`);
  }
}
console.log(bad ? `\n${bad} FAILED` : "  ✓ every static fallback matches its English string\n\nall passed");
process.exit(bad ? 1 : 0);
