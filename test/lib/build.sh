#!/bin/sh
# Builds everything the suites run against, from the files that actually ship.
#
# Two kinds of thing come out of here, and both are generated rather than
# committed — a copy of the app kept by hand is a copy that drifts, and a
# suite passing against a drifted copy is worse than no suite at all.
#
#   build/*.js    the page scripts with sync.js and firebase-config.js
#                 swapped for stubs, so jsdom can drive the real code
#   build/site/   the whole app mirrored with a stubbed sync, served to a
#                 real browser so the layout suites measure real layout
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
TEST="$HERE/.."
R="$TEST/.."
OUT="$TEST/build"

rm -rf "$OUT"
mkdir -p "$OUT/site/js" "$OUT/site/css" "$OUT/site/img"

# — the page scripts, for jsdom ————————————————————————————————————————
# Every import that would reach the network is pointed at a stub; everything
# else is left alone, so what runs under test is the shipped file.
stub() {
  sed -e "s|from \"./sync.js\"|from \"$2\"|" \
      -e "s|from \"./firebase-config.js\"|from \"../lib/stubs/config.js\"|" \
      -e "s|from \"./qr.js\"|from \"../../js/qr.js\"|" \
      -e "s|from \"./icons.js\"|from \"../../js/icons.js\"|" \
      -e "s|from \"./hearts.js\"|from \"../../js/hearts.js\"|" \
      -e "s|from \"./scores.js\"|from \"../../js/scores.js\"|" \
      -e "s|from \"./tour.js\"|from \"../../js/tour.js\"|" \
      -e "s|from \"./changes.js\"|from \"../../js/changes.js\"|" \
      -e "s|from \"./i18n.js\"|from \"../../js/i18n.js\"|" \
      "$1"
}

cp "$TEST/lib/stubs/sync-audience.js" "$OUT/sync-audience.js"
cp "$TEST/lib/stubs/sync-host.js" "$OUT/sync-host.js"
cp "$TEST/lib/stubs/sync-screen.js" "$OUT/sync-screen.js"

stub "$R/js/app.js" ./sync-audience.js > "$OUT/app.js"
# The join suite reaches inside; nothing else does.
printf '\nexport { showJoin, onJoin };\nexport function __latest() { return latest; }\n' >> "$OUT/app.js"
stub "$R/js/host.js" ./sync-host.js > "$OUT/host.js"
stub "$R/js/screen.js" ./sync-screen.js > "$OUT/screen.js"
printf '\nexport { state } from "./sync-screen.js";\n' >> "$OUT/screen.js"

# sync.js has no seam of its own, so the copy under test is the shipped file
# plus three accessors. Generated here so it can never drift from it.
sed -e "s|from \"./firebase-config.js\"|from \"../lib/stubs/sync-config.js\"|" \
    "$R/js/sync.js" > "$OUT/sync.js"
cat >> "$OUT/sync.js" <<'JS'

export function __inject(fakeDatabase, ref, id, instance) { database = fakeDatabase; eventRef = ref; uid = id; db = instance; }
export function __normalise(raw) { return normalise(raw); }
export function __state() { return { liveDeck, questionsPath, unmigrated }; }
JS

# — the whole app, for a real browser ——————————————————————————————————
cp "$R"/*.html "$OUT/site/"
cp "$R"/css/style.css "$OUT/site/css/"
cp "$R"/img/* "$OUT/site/img/"
cp "$R"/js/*.js "$OUT/site/js/"
cp "$TEST/lib/stubs/sync-browser.js" "$OUT/site/js/sync.js"

cat > "$OUT/site/js/firebase-config.js" <<'JS'
export function isConfigured() { return true; }
export const SECONDS_CHOICES = [0, 10, 30, 60, 120];
export const DEFAULT_SECONDS = 30;
export const EVENT_ID = "live";
JS

# The tour opens itself once per browser. Every suite and every screenshot
# would be that once, so the mirrored host page marks it seen — unless the
# page under test asks for it by setting window.SHOW_TOUR first.
python3 - "$OUT/site/host.html" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace("</head>",
  "<script>try{if(!window.SHOW_TOUR)localStorage.setItem('votr-tour-seen','1')}catch(e){}</script>\n</head>")
open(p, "w").write(s)
PY
