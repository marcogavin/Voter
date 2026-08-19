// A small stroke-icon set, drawn here rather than pulled from a library: five
// files and no build step is the whole point of this app, and an icon font or
// an npm dependency would cost more than the fourteen paths below.
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
  heart: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
    `<path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21z"/></svg>`,
};

/** Puts an icon into every element that names one in data-icon. */
export function drawIcons(root = document) {
  for (const slot of root.querySelectorAll("[data-icon]")) {
    const svg = icons[slot.dataset.icon];
    if (svg) slot.innerHTML = svg;
  }
}
