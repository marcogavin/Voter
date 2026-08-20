// The leaderboard, worked out from what is already stored.
//
// Nothing new is kept for this: who answered what is in each question's
// `voters`, which of them was right is its `correct`, and who each device is
// belongs to `players`. A score is a reading of the event, not a field in it —
// which means it is right for a poll that was run before this existed, and
// there is no way for it to disagree with the votes it is counting.
//
// **Ranked on right answers alone.** Ranking on speed as well would need a
// timestamp beside every vote, and a vote is one atomic write that the rules
// would have to be republished to accept — worth doing, but not worth a poll
// that quietly refuses votes until the rules catch up. People who got the same
// number right share a place, which is also the honest answer.

import { t } from "./i18n.js";
import { icons } from "./icons.js";

/**
 * True when there is anything to score. A poll of opinion questions has no
 * right answers, so a leaderboard would be a table of zeroes — those go
 * straight from the last question to the closing screen.
 */
export function isScorable(event) {
  return (event?.questions ?? []).some((question) => question.correct !== null);
}

/**
 * Everyone who answered anything, best first.
 *
 * Ties share a place and the next one skips, the way places work: two people
 * on 5 are both second, and the next is fourth. Within a tie it is by name, so
 * the order doesn't shuffle between two renders of the same scores.
 */
export function standings(event) {
  const scored = (event?.questions ?? []).filter((q) => q.correct !== null);
  const players = event?.players ?? {};

  const rows = Object.entries(players)
    .map(([uid, name]) => {
      let right = 0;
      let answered = 0;
      for (const question of scored) {
        const pick = question.voters?.[uid];
        if (pick === undefined) continue;
        answered += 1;
        if (pick === question.correct) right += 1;
      }
      return { uid, name, right, answered, of: scored.length };
    })
    // Somebody who never answered anything isn't in the running; they were in
    // the room, which is not the same thing.
    .filter((row) => row.answered > 0)
    .sort((a, b) => b.right - a.right || a.name.localeCompare(b.name));

  let place = 0;
  let seen = 0;
  let last = null;
  for (const row of rows) {
    seen += 1;
    if (row.right !== last) {
      place = seen;
      last = row.right;
    }
    row.place = place;
  }
  return rows;
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
 */
export function boardMarkup(event, me) {
  const rows = standings(event);
  if (!rows.length) {
    return `<p class="panel-message">${t("noScoresYet")}</p>`;
  }

  return (
    `<ol class="board">` +
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
          `</li>`
        );
      })
      .join("") +
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
