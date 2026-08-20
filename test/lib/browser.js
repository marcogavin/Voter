// One place that knows how to start Chromium.
//
// Locally it may be a browser that came with the machine, at a path the
// suites have no business knowing. In CI `npx playwright install chromium`
// puts one where Playwright expects it and no path is needed at all. Both
// work, and neither is spelled out twenty times.

import { existsSync } from "node:fs";
import { chromium } from "playwright";

/** A Chromium already on this machine, if there is one worth naming. */
const LOCAL = "/opt/pw-browsers/chromium";

export function launch() {
  return chromium.launch(existsSync(LOCAL) ? { executablePath: LOCAL } : {});
}

/** Where the mirrored app is served from — see test/lib/build.sh. */
export const SITE = "http://127.0.0.1:8766";

/** And the repo exactly as it would be deployed. */
export const DEPLOYED = "http://127.0.0.1:8765";
