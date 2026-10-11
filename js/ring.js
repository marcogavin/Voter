// The countdown: a ring that drains, with the seconds left in the middle.
//
// It replaced a bar. A bar is a fine instrument and a dull one; a ring reads
// at a glance from the back of a room, and it has room in the middle for the
// number. Blue while there is time, amber from half way, red for the last
// five seconds — when the number pops on every tick and the ring pulses, so
// the room feels the end coming without anybody having to read anything.
//
// It only ever draws. How long is left is the page's to work out, from the
// server's clock: this is given the answer and paints it, so the ring can
// never run a clock of its own that disagrees with the one closing the vote.

/** The seconds at which the end is near. The same five the pages always used. */
export const URGENT = 5;

/**
 * Paints the ring.
 *
 * `left` is whole seconds left, as the number shows them; `fraction` is the
 * exact share of the time remaining, so the ring drains smoothly between the
 * seconds rather than in steps. `label` is the whole thing in words, for a
 * screen reader that can't see a ring.
 */
export function drawRing(clock, { left, fraction, label }) {
  const arc = clock.querySelector(".ring-arc");
  const number = clock.querySelector(".clock-time");
  const share = Math.max(0, Math.min(1, fraction));

  if (arc) arc.style.strokeDashoffset = String(100 - share * 100);
  clock.dataset.phase = left <= URGENT ? "urgent" : share <= 0.5 ? "half" : "calm";
  clock.classList.toggle("is-urgent", left <= URGENT);
  clock.setAttribute("aria-label", label);

  if (number && number.textContent !== String(left)) {
    number.textContent = String(left);
    // Each of the last few seconds lands with a little pop. Restarting an
    // animation means taking it off and putting it back after a reflow.
    if (left <= URGENT) {
      number.classList.remove("is-tick");
      void number.offsetWidth;
      number.classList.add("is-tick");
    }
  }
}
