// A small stroke-icon set, drawn here rather than pulled from a library: five
// files and no build step is the whole point of this app, and an icon font or
// an npm dependency would cost more than the couple of dozen paths below.
//
// All 24×24, stroke rather than fill, so they take their colour from the text
// beside them and stay legible at any size.

const ICON = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  qr: ICON(
    `<rect x="3" y="3" width="7" height="7" rx="1"/>` +
      `<rect x="14" y="3" width="7" height="7" rx="1"/>` +
      `<rect x="3" y="14" width="7" height="7" rx="1"/>` +
      `<path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M20 20v.01M17.5 20.5h.01"/>`,
  ),
  signOut: ICON(
    `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>` +
      `<path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>`,
  ),
  signIn: ICON(
    `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>` +
      `<path d="M10 17l-5-5 5-5"/><path d="M5 12h12"/>`,
  ),
  hide: ICON(
    `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>` +
      `<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>` +
      `<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>`,
  ),
  show: ICON(
    `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>` +
      `<circle cx="12" cy="12" r="3"/>`,
  ),
  reveal: ICON(
    `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>` +
      `<circle cx="12" cy="12" r="3"/>`,
  ),
  reopen: ICON(`<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>`),
  reset: ICON(
    `<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>` +
      `<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>`,
  ),
  startOver: ICON(`<path d="M19 20L9 12l10-8z"/><path d="M5 19V5"/>`),
  prev: ICON(`<path d="M15 18l-6-6 6-6"/>`),
  next: ICON(`<path d="M9 18l6-6-6-6"/>`),
  plus: ICON(`<path d="M12 5v14"/><path d="M5 12h14"/>`),
  polls: ICON(
    `<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>`,
  ),
  edit: ICON(
    `<path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>`,
  ),
  remove: ICON(`<path d="M18 6L6 18"/><path d="M6 6l12 12"/>`),
  up: ICON(`<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>`),
  down: ICON(`<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>`),
  close: ICON(`<path d="M18 6L6 18"/><path d="M6 6l12 12"/>`),
  check: ICON(`<path d="M20 6L9 17l-5-5"/>`),
  trophy: ICON(
    `<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/>` +
      `<path d="M8 6H5a3 3 0 0 0 3 3"/><path d="M16 6h3a3 3 0 0 1-3 3"/>` +
      `<path d="M12 13v3"/><path d="M9 20h6"/><path d="M10 20a2 2 0 0 1 4 0"/>`,
  ),
  copy: ICON(
    `<rect x="9" y="9" width="11" height="11" rx="2"/>` +
      `<path d="M5 15V5a2 2 0 0 1 2-2h10"/>`,
  ),
  link: ICON(
    `<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/>` +
      `<path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>`,
  ),
  globe: ICON(
    `<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>` +
      `<path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>`,
  ),
  clock: ICON(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`),
  help: ICON(
    `<circle cx="12" cy="12" r="9"/>` +
      `<path d="M9.2 9.2a2.8 2.8 0 0 1 5.5.7c0 1.9-2.7 2.4-2.7 4"/>` +
      `<path d="M12 17.5v.01"/>`,
  ),
  screen: ICON(
    `<rect x="2" y="4" width="20" height="13" rx="2"/>` +
      `<path d="M12 17v4"/><path d="M8 21h8"/>`,
  ),
  expand: ICON(
    `<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/>` +
      `<path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/>`,
  ),
  shrink: ICON(
    `<path d="M3 8h3a2 2 0 0 0 2-2V3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>` +
      `<path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/>`,
  ),
  heart: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
    `<path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21z"/></svg>`,
  star: ICON(
    `<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>`,
  ),
  starFilled: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
    `<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></svg>`,
};

/** Puts an icon into every element that names one in data-icon. */
export function drawIcons(root = document) {
  for (const slot of root.querySelectorAll("[data-icon]")) {
    const svg = icons[slot.dataset.icon];
    if (svg) slot.innerHTML = svg;
  }
}

/**
 * The blank screen's mark: the wordmark's own O, lifted from
 * img/votr-logo.svg unaltered, with its bars breathing — something is being
 * measured, just not here.
 *
 * It lives beside the icons because both screens draw it now: the audience
 * while it waits, and the host so it can see what the room is looking at.
 * `label` is the accessible name, which differs by screen.
 */
export function waitingArt(label) {
  return `
    <svg class="waiting-art" viewBox="269 13 328 352" role="img"
         aria-label="${label}">
      <path d="M 516,42 L 495,31 L 467,22 L 445,19 L 401,22 L 365,34 L 343,47 L 318,69 L 303,88 L 282,132 L 275,182 L 279,215 L 288,243 L 299,264 L 320,291 L 307,354 L 311,359 L 325,358 L 379,331 L 419,339 L 457,338 L 485,331 L 506,322 L 533,304 L 549,289 L 567,265 L 581,237 L 589,209 L 591,164 L 588,145 L 580,119 L 563,87 L 534,55 Z M 414,53 L 447,52 L 459,54 L 481,61 L 507,76 L 528,96 L 542,116 L 552,138 L 558,164 L 558,194 L 554,214 L 544,239 L 531,259 L 510,280 L 492,292 L 477,299 L 450,306 L 407,304 L 385,297 L 362,284 L 339,263 L 329,250 L 317,227 L 310,204 L 308,172 L 311,151 L 319,127 L 330,107 L 351,83 L 370,69 L 391,59 Z" fill="#1D4ED8" fill-rule="evenodd"/>
      <path d="M 358,172 L 356,173 L 352,178 L 352,258 L 357,264 L 360,265 L 395,265 L 396,263 L 396,179 L 395,176 L 390,172 Z" fill="#0B7D88" fill-rule="evenodd" class="waiting-bar waiting-bar--a"/>
      <path d="M 420,106 L 415,108 L 412,113 L 412,263 L 414,265 L 453,265 L 455,263 L 455,113 L 453,109 L 450,107 L 439,107 L 438,106 L 422,107 Z" fill="#1D4ED8" fill-rule="evenodd" class="waiting-bar waiting-bar--b"/>
      <path d="M 479,150 L 476,151 L 472,156 L 472,264 L 473,265 L 508,265 L 514,260 L 515,257 L 515,158 L 514,155 L 510,151 L 507,150 Z" fill="#17743C" fill-rule="evenodd" class="waiting-bar waiting-bar--c"/>
    </svg>
  `;
}
