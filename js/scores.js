// The leaderboard, worked out from what is already stored.
//
// Nothing new is kept for this: who answered what is in each question's
// `voters`, which of them was right is its `correct`, and who each device is
// belongs to `players`. A score is a reading of the event, not a field in it —
// which means it is right for a poll that was run before this existed, and
// there is no way for it to disagree with the votes it is counting.
//
// **Right answers first, then the clock.** Where a time limit is set, every
// vote records how long it took, and the total breaks ties between people on
// the same score — which is what makes a quiz a race rather than a poll with
// a winner. Where nothing is timed, the board is exactly what it was: right
// answers, and a shared place for everyone level on them.
//
// Only questions with a right answer count towards either number. An opinion
// question is not something anyone can be quick at.

import { t, getLanguage } from "./i18n.js";
import { icons } from "./icons.js";

/**
 * How long a device counts as being in the room after its last sign of life.
 *
 * A name is written once and would otherwise be there forever: yesterday's
 * tab, the phone that joined and went back in a pocket, the browser somebody
 * closed without leaving. An hour is longer than any break in a session and
 * shorter than the gap to the next one.
 */
export const PRESENT_MS = 60 * 60 * 1000;

/**
 * How many people are actually here — the denominator of "Votes 7/12".
 *
 * Read from `seen`, which every phone refreshes while it is being looked at.
 * A name with no entry at all is from before any of this was recorded, which
 * for this purpose is the same as long gone.
 *
 * Both screens that show the count read this, so the wall and the host can't
 * disagree about the size of the room they are both in.
 */
export function roomSize(event, now = Date.now()) {
  const seen = event?.seen ?? {};
  return Object.keys(event?.players ?? {}).filter(
    (uid) => now - (seen[uid] ?? 0) < PRESENT_MS,
  ).length;
}

/**
 * True when there is anything to score. A poll of opinion questions has no
 * right answers, so a leaderboard would be a table of zeroes — those go
 * straight from the last question to the closing screen.
 */
export function isScorable(event) {
  return (event?.questions ?? []).some((question) => question.correct !== null);
}

/**
 * How long a question was open, in milliseconds, or null when it wasn't timed.
 *
 * This doubles as the cost of not answering one. A question you sat out has
 * to cost the whole clock: anything less and skipping would be a way to post
 * a faster time than the people who actually answered.
 */
function limit(event) {
  const seconds = event?.seconds ?? 0;
  return seconds > 0 ? seconds * 1000 : null;
}

/**
 * True when there are real times to rank on: a limit is set *and* something
 * was actually recorded. A poll run before timing existed, or one whose votes
 * arrived while the rules still refused the times, shows no clock at all
 * rather than a column of identical numbers.
 */
export function isTimed(event) {
  if (limit(event) === null) return false;
  return (event?.questions ?? []).some(
    (question) =>
      question.correct !== null && Object.keys(question.times ?? {}).length > 0,
  );
}

/**
 * Everyone who answered anything, best first.
 *
 * Right answers decide it; the clock separates people level on them. Ties that
 * survive both share a place and the next one skips, the way places work: two
 * people on 5 are both second, and the next is fourth. Within a tie it is by
 * name, so the order doesn't shuffle between two renders of the same scores.
 */
export function standings(event) {
  const scored = (event?.questions ?? []).filter((q) => q.correct !== null);
  const players = event?.players ?? {};
  const timed = isTimed(event);
  const full = limit(event) ?? 0;

  const rows = Object.entries(players)
    .map(([uid, name]) => {
      let right = 0;
      let answered = 0;
      let ms = 0;
      for (const question of scored) {
        const pick = question.voters?.[uid];
        if (pick === undefined) {
          // Never answered: the whole clock.
          ms += full;
          continue;
        }
        answered += 1;
        if (pick === question.correct) right += 1;
        // Answered but untimed — a vote from before this existed, or one the
        // rules took without its time. Costs the whole clock too: a missing
        // time must never read as an instant one.
        ms += question.times?.[uid] ?? full;
      }
      return { uid, name, right, answered, of: scored.length, ms: timed ? ms : null };
    })
    // Somebody who never answered anything isn't in the running; they were in
    // the room, which is not the same thing.
    .filter((row) => row.answered > 0)
    .sort(
      (a, b) =>
        b.right - a.right ||
        (timed ? a.ms - b.ms : 0) ||
        a.name.localeCompare(b.name),
    );

  let place = 0;
  let seen = 0;
  let last = null;
  for (const row of rows) {
    seen += 1;
    // Level on everything that decides the order — which with a clock running
    // is a rarer thing than it used to be.
    const key = timed ? `${row.right}:${row.ms}` : `${row.right}`;
    if (key !== last) {
      place = seen;
      last = key;
    }
    row.place = place;
  }
  return rows;
}

/**
 * A total, as a stopwatch reads it: seconds and a tenth up to a minute, then
 * minutes and seconds. The tenth is what stops two people who tied being shown
 * the same number and ranked differently.
 */
export function clockText(ms) {
  const total = Math.round(ms / 100) / 10;
  if (total < 60) {
    const digits = new Intl.NumberFormat(getLanguage(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(total);
    return `${digits}s`;
  }
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Which of the run's screens an index lands on.
 *
 * The end of a poll is two screens now — the standings, then the applause —
 * and both pages have to agree on that without either one owning the rule.
 * A poll with nothing to score keeps the shape it always had: last question,
 * then the heart.
 */
export function screenAt(event) {
  const count = event?.questions?.length ?? 0;
  const index = event?.currentIndex ?? -1;

  if (!count || index < 0) return "none";
  if (index < count) return "question";
  if (index === count) return isScorable(event) ? "scores" : "ending";
  if (index === count + 1 && isScorable(event)) return "ending";
  return "none";
}

/** The furthest the host can move forward: the last screen there is. */
export function lastIndex(event) {
  const count = event?.questions?.length ?? 0;
  if (!count) return -1;
  return isScorable(event) ? count + 1 : count;
}

/**
 * The standings as markup, for whichever screen is showing them — the room's
 * phones and the host's copy of the same thing draw this one function, so the
 * two can't disagree about who won.
 *
 * `me` is the device reading it, marked so nobody has to hunt for their own
 * name; on the host nobody is.
 *
 * `limit` caps how many rows are drawn, with the rest counted underneath. A
 * phone can scroll and a projector can't: thirty names on a wall are thirty
 * names nobody at the back can read, and the ones worth reading are at the
 * top anyway.
 */
export function boardMarkup(event, me, limit = Infinity) {
  const all = standings(event);
  if (!all.length) {
    return `<p class="panel-message">${t("noScoresYet")}</p>`;
  }

  const rows = all.slice(0, limit);
  const hidden = all.length - rows.length;

  return (
    // The row count rides along as a custom property: the rows arrive from
    // the bottom up, so how long that takes — and when the winner's row is
    // finally there to be celebrated — depends on how many there are.
    `<ol class="board" style="--n: ${rows.length}">` +
    rows
      .map((row, index) => {
        const classes =
          "board-row" +
          (row.place === 1 ? " is-first" : "") +
          (row.uid === me ? " is-me" : "");
        return (
          `<li class="${classes}" style="--i: ${index}">` +
          `<span class="board-place">${row.place}</span>` +
          `<span class="board-name"></span>` +
          `<span class="board-score">${row.right}<span class="board-of">/${row.of}</span></span>` +
          (row.ms === null
            ? ""
            : `<span class="board-time">${clockText(row.ms)}</span>`) +
          `</li>`
        );
      })
      .join("") +
    (hidden ? `<li class="board-more">${t("andMore", { n: hidden })}</li>` : "") +
    `</ol>`
  );
}

/**
 * Puts the names in after the markup is on the page. A name is typed by a
 * person, so it goes in as text and never as markup — and doing it here means
 * boardMarkup can stay a string without any of it being unsafe.
 */
export function fillNames(root, event) {
  const rows = standings(event);
  root.querySelectorAll(".board-row").forEach((element, index) => {
    const row = rows[index];
    if (!row) return;
    element.querySelector(".board-name").textContent = row.name;
    if (row.place === 1) {
      element.insertAdjacentHTML(
        "afterbegin",
        `<span class="board-crown" aria-hidden="true">${icons.trophy}</span>`,
      );
    }
  });
}
