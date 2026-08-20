// The guided tour: a spotlight, a callout, and a way out.
//
// Nothing here is invented. Coach marks have settled into a shape everyone
// already knows how to use, and this is that shape: the screen dims, one
// control stays lit, a note beside it says what the control is for, and the
// whole thing can be left at any point. Six or seven steps, one sentence each
// — a tour long enough to need a progress bar is a manual.
//
// The dimming is one element, not four. A single box with a very large
// spread shadow paints everything *except* itself, which is how the lit
// control ends up genuinely un-dimmed rather than approximately so.
//
// Nothing outside the tour can be clicked while it runs. A tour that lets you
// wander off mid-step spends the rest of its life describing controls that
// aren't where it left them.

import { t } from "./i18n.js";
import { icons } from "./icons.js";

/** Remembered so a returning host isn't shown it again. */
const SEEN = "votr-tour-seen";

/** How far the lit ring stands off the control it is drawn around. */
const HALO = 6;

/** Kept clear of the edges of the screen. */
const EDGE = 12;

let steps = [];
let at = 0;
let root = null;
let onClose = null;

/** True the first time this browser opens the host page. */
export function isFirstTime() {
  try {
    return !window.localStorage.getItem(SEEN);
  } catch (error) {
    // Private browsing can refuse storage. Showing the tour once per visit is
    // a better failure than never showing it at all.
    return true;
  }
}

/** So a host who has seen it isn't shown it again on the next event. */
function remember() {
  try {
    window.localStorage.setItem(SEEN, "1");
  } catch (error) {
    /* nothing to do about it */
  }
}

/**
 * Runs the tour.
 *
 * Each step names the element to light up and the line to say about it, and
 * may carry a `before` that puts the page into the state where that element
 * exists — which is how the tour crosses from Setup to Run without the host
 * having to.
 *
 * `done` is called when the tour ends, however it ends.
 */
export function startTour(list, done = null) {
  if (root) return;
  steps = list.filter((step) => step.at());
  if (!steps.length) return;
  at = 0;
  onClose = done;

  root = document.createElement("div");
  root.className = "tour";
  root.innerHTML =
    `<div class="tour-block"></div>` +
    `<div class="tour-ring" aria-hidden="true"></div>` +
    `<div class="tour-note" role="dialog" aria-modal="true" aria-live="polite">` +
    `<span class="tour-arrow" aria-hidden="true"></span>` +
    `<p class="tour-text"></p>` +
    `<div class="tour-foot">` +
    `<span class="tour-count"></span>` +
    `<button type="button" class="tour-skip"></button>` +
    `<button type="button" class="tour-back"></button>` +
    `<button type="button" class="tour-next btn btn--primary"></button>` +
    `</div></div>`;
  document.body.appendChild(root);

  root.querySelector(".tour-skip").addEventListener("click", () => stop());
  root.querySelector(".tour-back").addEventListener("click", () => go(at - 1));
  root.querySelector(".tour-next").addEventListener("click", () => go(at + 1));
  root.querySelector(".tour-block").addEventListener("click", () => stop());
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", place);
  window.addEventListener("scroll", place, true);

  draw();
}

function go(next) {
  if (next < 0) return;
  if (next >= steps.length) return stop();
  at = next;
  draw();
}

function stop() {
  if (!root) return;
  document.removeEventListener("keydown", onKey, true);
  window.removeEventListener("resize", place);
  window.removeEventListener("scroll", place, true);
  root.remove();
  root = null;
  remember();
  if (onClose) onClose();
}

function onKey(event) {
  if (event.key === "Escape") stop();
  else if (event.key === "ArrowRight") go(at + 1);
  else if (event.key === "ArrowLeft") go(at - 1);
  else if (event.key === "Tab") return; // let it cycle the three buttons
  else return;
  event.preventDefault();
  event.stopPropagation();
}

function draw() {
  const step = steps[at];
  if (step.before) step.before();

  root.querySelector(".tour-text").textContent = t(step.says);
  root.querySelector(".tour-count").textContent = t("tourStep", {
    n: at + 1,
    of: steps.length,
  });

  const back = root.querySelector(".tour-back");
  back.hidden = at === 0;
  back.textContent = t("tourBack");
  root.querySelector(".tour-skip").textContent = t("tourSkip");

  const next = root.querySelector(".tour-next");
  next.innerHTML =
    `<span class="btn-label">${t(at === steps.length - 1 ? "tourDone" : "tourNext")}</span>` +
    (at === steps.length - 1 ? "" : `<span class="btn-icon">${icons.next}</span>`);

  // The control has to be on screen before anything can be measured against
  // it, and a step further down the page is a step nobody can see.
  // Not every environment this runs in has a viewport to scroll.
  step.at()?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  place();
  next.focus();
}

/**
 * Puts the ring around the control and the note beside it.
 *
 * Below the control where there is room, above it where there isn't, and
 * always inside the screen — a callout half off the edge of a phone is the
 * usual way these go wrong.
 */
function place() {
  if (!root) return;
  const target = steps[at]?.at();
  if (!target) return;

  const box = target.getBoundingClientRect();
  const ring = root.querySelector(".tour-ring");
  ring.style.top = `${box.top - HALO}px`;
  ring.style.left = `${box.left - HALO}px`;
  ring.style.width = `${box.width + HALO * 2}px`;
  ring.style.height = `${box.height + HALO * 2}px`;

  const note = root.querySelector(".tour-note");
  const size = note.getBoundingClientRect();
  const below = box.bottom + HALO + 14;
  const above = box.top - HALO - 14 - size.height;
  const fits = below + size.height < window.innerHeight - EDGE;

  note.classList.toggle("is-above", !fits);
  note.style.top = `${fits ? below : Math.max(EDGE, above)}px`;

  const wanted = box.left + box.width / 2 - size.width / 2;
  const left = Math.min(
    Math.max(EDGE, wanted),
    window.innerWidth - size.width - EDGE,
  );
  note.style.left = `${left}px`;

  // The arrow points at the middle of the control, wherever the note ended up.
  const arrow = root.querySelector(".tour-arrow");
  arrow.style.left = `${Math.min(
    Math.max(16, box.left + box.width / 2 - left),
    size.width - 16,
  )}px`;
}
