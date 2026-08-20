// The applause on the closing screen.
//
// A tap is worth an animation on every phone in the room, not just the one
// that made it — a room clapping is the whole point of the screen — so this
// draws hearts for a *number* of taps rather than for one gesture. The
// number comes from the counter moving, which is the only thing the database
// tells everyone about.
//
// Colours come from the stylesheet as --heart-1 … --heart-8, so the palette
// stays a design decision rather than a list of hex codes buried in here.

import { icons } from "./icons.js";

/** How many --heart-N tokens the stylesheet defines. */
const PALETTE = 8;

/** A burst, not a swarm. Thirty people tapping at once is still a burst. */
const MOST_AT_ONCE = 12;

/**
 * The same colour every time for the same id, so your own hearts are always
 * yours. Two people can land on the same colour — with eight of them and a
 * room full of phones they will, and it doesn't matter.
 */
export function heartColour(id) {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) % 997;
  return (sum % PALETTE) + 1;
}

/** For hearts from someone else: which person is unknowable, the colour isn't. */
export function anyColour() {
  return Math.floor(Math.random() * PALETTE) + 1;
}

/**
 * Sends `count` hearts up from `stage`, each with its own drift, tilt, size
 * and start — released together they'd read as one heart stuttering rather
 * than as several people tapping.
 *
 * `colour` is a number from the palette, or null to give every heart its own
 * (which is what a burst from several people at once deserves).
 */
export function flyHearts(stage, count, colour = null) {
  if (!stage) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  for (let i = 0; i < Math.min(count, MOST_AT_ONCE); i++) {
    const fly = document.createElement("span");
    fly.className = "heart-fly";
    fly.innerHTML = icons.heart;
    fly.style.color = `var(--heart-${colour ?? anyColour()})`;
    fly.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 140)}px`);
    fly.style.setProperty("--tilt", `${Math.round((Math.random() - 0.5) * 60)}deg`);
    fly.style.setProperty("--size", `${(1.5 + Math.random() * 1.5).toFixed(2)}rem`);
    fly.style.animationDelay = `${i * 70 + Math.round(Math.random() * 60)}ms`;
    fly.addEventListener("animationend", () => fly.remove());
    stage.appendChild(fly);
  }
}

/* ── The winner ────────────────────────────────────────────────────────── */

/** How many pieces a win is worth. Enough to read as a burst, not a mess. */
const CONFETTI = 26;

/**
 * When the row this is bursting from will have finished arriving.
 *
 * The rows land from the bottom up, so the winner's is the *last* one there —
 * and confetti thrown before it has arrived is a burst over an empty space,
 * which is most of what made the old one read as a glitch. The pace comes from
 * the stylesheet, which is where it is decided.
 */
function landing(row) {
  const board = row.closest?.(".board");
  if (!board) return 0;

  // Through `window`, like matchMedia above: the bare global isn't there in
  // every environment this file is asked to run in.
  const step =
    parseFloat(window.getComputedStyle(board).getPropertyValue("--step")) || 130;
  const rows = board.querySelectorAll(".board-row").length;
  return Math.max(0, (rows - 1) * step + 300);
}

/**
 * A burst of colour from the top of the standings, in the same palette the
 * hearts use — the app has one set of celebratory colours and this is it.
 *
 * Same mechanics as a heart: a few absolutely positioned pieces that remove
 * themselves when they are done, and none at all for anyone who has asked
 * for less movement.
 */
export function celebrate(stage) {
  if (!stage) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const after = landing(stage);

  for (let i = 0; i < CONFETTI; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.background = `var(--heart-${anyColour()})`;
    piece.style.left = `${Math.round(Math.random() * 100)}%`;
    piece.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 220)}px`);
    piece.style.setProperty("--spin", `${Math.round((Math.random() - 0.5) * 720)}deg`);
    // Slower than a heart, and spread over half a second: a burst that is
    // over in one is a flicker somebody at the back never sees at all.
    piece.style.setProperty("--fall", `${(1.9 + Math.random() * 1.2).toFixed(2)}s`);
    piece.style.animationDelay = `${after + Math.round(Math.random() * 480)}ms`;
    piece.addEventListener("animationend", () => piece.remove());
    stage.appendChild(piece);
  }
}
