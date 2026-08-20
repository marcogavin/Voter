// The standings, on their own — no DOM, no database, just the reading.
import {
  standings, isScorable, isTimed, clockText, roomSize, PRESENT_MS,
} from "../../js/scores.js";

let failed = 0;
const ok = (l, c) => { console.log(`  ${c ? "✓" : "✗"} ${l}`); if (!c) failed++; };

const q = (id, correct, voters) => ({ id, text: id, correct, voters, options: [] });
const event = (over = {}) => ({
  players: { a: "Ana", b: "Bo", c: "Cy", d: "Dee" },
  questions: [
    q("q0", "x", { a: "x", b: "x", c: "y", d: "x" }),
    q("q1", "y", { a: "y", b: "z", c: "y" }),
    q("q2", null, { a: "1", b: "2" }), // an opinion question, worth nothing
    q("q3", "z", { a: "z", b: "z", c: "z" }),
  ],
  ...over,
});

console.log("what counts");
const table = standings(event());
ok("only questions with a right answer", table[0].of === 3);
ok("the best is first", table[0].name === "Ana" && table[0].right === 3);
ok("everyone who answered is in it", table.length === 4);
ok("with what they answered out of what they could", table[1].answered === 3);

console.log("places");
const places = Object.fromEntries(table.map((r) => [r.name, r.place]));
ok("a clear first is first", places.Ana === 1);
ok("two on the same score share second", places.Bo === 2 && places.Cy === 2);
ok("and the next place skips the one they shared", places.Dee === 4);

console.log("who is left out");
const quiet = standings(event({ players: { a: "Ana", z: "Zed" } }));
ok("somebody who never answered isn't in the running", !quiet.some((r) => r.name === "Zed"));
ok("being in the room isn't a score", quiet.length === 1);

console.log("a poll with nothing to score");
const opinions = { players: { a: "Ana" }, questions: [q("q0", null, { a: "1" })] };
ok("has no leaderboard", !isScorable(opinions));
ok("while one right answer is enough to have one", isScorable(event()));
ok("and an empty poll has none", !isScorable({ players: {}, questions: [] }));

console.log("ordering inside a tie");
const tied = standings({
  players: { a: "Zed", b: "Ana" },
  questions: [q("q0", "x", { a: "x", b: "x" })],
});
ok("is by name, so two renders agree", tied[0].name === "Ana");

/* ── The clock ──────────────────────────────────────────────────────────
   Where a time limit is set, every vote records how long it took and the
   total separates people level on right answers.                          */

const timed = (over = {}) => ({
  seconds: 30,
  players: { a: "Ana", b: "Bo", c: "Cy" },
  questions: [
    { ...q("q0", "x", { a: "x", b: "x", c: "x" }), times: { a: 4000, b: 9000, c: 1000 } },
    { ...q("q1", "y", { a: "y", b: "y" }), times: { a: 3000, b: 1000 } },
    { ...q("q2", null, { a: "1", b: "2", c: "1" }), times: { a: 100, b: 100, c: 100 } },
  ],
  ...over,
});

console.log("a timed quiz");
const race = standings(timed());
ok("it is timed", isTimed(timed()));
ok("right answers still decide it", race[0].right === 2 && race[2].right === 1);
ok("Ana beat Bo on the clock", race[0].name === "Ana" && race[1].name === "Bo");
ok("over the questions that were scored", race[0].ms === 7000);
ok("and not the opinion one, however fast anybody was", race[1].ms === 10000);
ok("a question you sat out costs the whole clock", race[2].ms === 1000 + 30000);
ok("so skipping can never post a faster time", race[2].ms > race[1].ms);
ok("nobody shares a place once the clock has spoken",
   race.map((r) => r.place).join() === "1,2,3");

console.log("a time that never arrived");
const untimedVote = standings(timed({
  questions: [
    { ...q("q0", "x", { a: "x", b: "x" }), times: { b: 9000 } },
    { ...q("q1", "x", { a: "x", b: "x" }), times: { a: 1000, b: 1000 } },
  ],
}));
ok("costs the whole clock as well", untimedVote.find((r) => r.name === "Ana").ms === 31000);
ok("so a missing time never reads as an instant one",
   untimedVote[0].name === "Bo");

console.log("when there is no clock to read");
ok("no time limit, no times", !isTimed(timed({ seconds: 0 })));
ok("a limit with nothing recorded is still no times",
   !isTimed(timed({ questions: [q("q0", "x", { a: "x" })] })));
ok("times on opinion questions alone don't count either",
   !isTimed(timed({ questions: [{ ...q("q0", null, { a: "1" }), times: { a: 500 } }] })));
ok("and the rows carry no time at all", standings(timed({ seconds: 0 }))[0].ms === null);
ok("so people level on right answers share a place again",
   standings(timed({ seconds: 0 })).filter((r) => r.place === 1).length === 2);

console.log("reading a stopwatch");
ok("a tenth of a second, up to a minute", clockText(7400) === "7.4s");
ok("rounded, not truncated", clockText(7460) === "7.5s");
ok("zero is zero", clockText(0) === "0.0s");
ok("then minutes and seconds", clockText(84000) === "1:24");
ok("padded, so a column lines up", clockText(65000) === "1:05");
ok("and a minute exactly is a minute", clockText(60000) === "1:00");

/* ── Who is in the room ─────────────────────────────────────────────────
   A name is written once and would otherwise count forever.               */

console.log("counting the room");
const now = Date.now();
const room = (seen) => roomSize({ players: { a: "Ana", b: "Bo", c: "Cy" }, seen }, now);
ok("everyone awake counts", room({ a: now, b: now - 1000, c: now - 60000 }) === 3);
ok("a tab from two hours ago doesn't", room({ a: now, b: now, c: now - 2 * PRESENT_MS }) === 2);
ok("nor one from a minute past the hour",
   room({ a: now, b: now, c: now - PRESENT_MS - 60000 }) === 2);
ok("a minute inside it still does",
   room({ a: now, b: now, c: now - PRESENT_MS + 60000 }) === 3);
ok("a name with no sign of life at all is long gone", room({ a: now }) === 1);
ok("and a room nobody has reported from is empty", room({}) === 0);
ok("no players, no room", roomSize({ players: {}, seen: { a: now } }, now) === 0);
ok("a missing event doesn't throw", roomSize(undefined, now) === 0);
ok("an hour is the window", PRESENT_MS === 60 * 60 * 1000);

console.log("nothing at all");
ok("no players, no rows", standings({ players: {}, questions: [q("q0", "x", {})] }).length === 0);
ok("a missing event doesn't throw", standings(undefined).length === 0);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
