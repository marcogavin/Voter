// Screens that cache their own markup must forget it when the language
// changes, or they keep the language they were built in. That is what left
// "Tap the heart as often as you like" in English under a Portuguese title.
//
// Every cache guard has to be cleared inside the setLanguage branch. This
// finds the guards rather than being told them, so a new one that nobody
// resets shows up here instead of on someone's phone.
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const ok = (n, c) => (c ? (pass++, console.log("  ✓", n)) : (fail++, console.log("  ✗", n)));

// Every page that caches markup and follows the event's language. The wall is
// the most public of them: a screen stuck in the language it was built in is
// the whole room reading the wrong thing.
for (const file of ["app.js", "screen.js"]) {
  console.log(" ", file);
  const src = readFileSync(`../../js/${file}`, "utf8");

  // The block that runs when the language changes.
  const block = src.slice(src.indexOf("if (setLanguage("));
  const langBlock = block.slice(0, block.indexOf("\n  }") + 4);

  // Guards are the things compared before deciding not to rebuild.
  const dataGuards = [...src.matchAll(/(\w+(?:\.\w+)?)\.dataset\.(\w+)\s*!==/g)]
    .map((m) => `${m[1]}.dataset.${m[2]}`);
  const varGuards = [...src.matchAll(/!==\s*(shownQuestionId|\w*Menu)\b/g)].map((m) => m[1]);
  const guards = [...new Set([...dataGuards, ...varGuards])];

  console.log("    cache guards found:", guards.join(", ") || "none");
  ok(`${file}: at least one guard was found (the finder still works)`, guards.length > 0);

  for (const g of guards) {
    const cleared =
      langBlock.includes(`${g} = null`) ||
      langBlock.includes(`delete ${g}`) ||
      langBlock.includes(`${g} = ""`);
    ok(`${file}: "${g}" is cleared on a language change`, cleared);
  }
}

const src = readFileSync("../../js/app.js", "utf8");

// Every string baked into cached markup must come from t(), not be literal.
const ending = src.slice(src.indexOf("function showEnding"));
const endingMarkup = ending.slice(ending.indexOf("`"), ending.indexOf("`;") + 1);
ok("the closing screen's text all comes from t()",
   !/>[A-Za-z][A-Za-z ,.'!?]{6,}</.test(endingMarkup.replace(/\$\{[^}]*\}/g, "")));

console.log(fail ? `\n${fail} FAILED` : `\nall ${pass} passed`);
process.exit(fail ? 1 : 0);
