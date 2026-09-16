#!/bin/sh
# The whole app, in a real browser, against the real rules: the host's page
# in one browser profile, an attendee's phone in a second, separate one — an
# incognito window, as far as Firebase can tell — and the projector in a
# third. Real Chromium, the real Firebase SDK, the real database.rules.json
# in a real emulator, and the shipped pages with exactly three seams cut:
# where the SDK is loaded from, where it connects to, and how the host signs
# in (a custom token from the Auth emulator stands in for Google).
#
# This is the test that says whether a room full of phones can vote. The
# node suites prove each piece; this one proves the pieces together, from a
# tap on the host's Next to a row of buttons on somebody else's phone.
#
# Needs: a JDK, `npm install` in test/ (Playwright + Chromium) and in here
# (firebase, firebase-admin, firebase-tools). Usage: sh test/rules/e2e.sh
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
TEST="$HERE/.."
R="$TEST/.."
OUT="$TEST/build/e2e"
SDK="$HERE/node_modules/firebase"

if [ ! -d "$HERE/node_modules" ] || [ ! -d "$TEST/node_modules" ]; then
  echo "run 'npm install' in test/ and in test/rules/ first." >&2
  exit 1
fi

# — the site, mirrored, with its three seams cut ——————————————————————————
rm -rf "$OUT"
mkdir -p "$OUT/js/vendor" "$OUT/css" "$OUT/img"
cp "$R"/*.html "$OUT/"
cp "$R"/css/style.css "$OUT/css/"
cp "$R"/img/* "$OUT/img/"
cp "$R"/js/*.js "$OUT/js/"

# The SDK, from the npm package instead of Google's CDN — the same files, so
# their imports of each other only need pointing next door.
for f in firebase-app.js firebase-auth.js firebase-database.js; do
  sed -E 's|https://www.gstatic.com/firebasejs/[0-9.]+/|./|g' "$SDK/$f" > "$OUT/js/vendor/$f"
done

# sync.js, with the SDK loaded from ./vendor, pointed at the emulators, and
# signing the host in with a token the test mints.
python3 - "$R/js/sync.js" "$OUT/js/sync.js" <<'PY'
import sys
src = open(sys.argv[1]).read()
def cut(old, new):
    global src
    assert src.count(old) == 1, old
    src = src.replace(old, new)
cut('const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;',
    'const CDN = "./vendor";')
cut('  auth = authModule.getAuth(app);\n',
    '  auth = authModule.getAuth(app);\n'
    '  authModule.connectAuthEmulator(auth, "http://127.0.0.1:9111", { disableWarnings: true });\n')
cut('      authModule.signInAnonymously(auth),',
    '      window.VOTR_TOKEN\n'
    '        ? authModule.signInWithCustomToken(auth, window.VOTR_TOKEN)\n'
    '        : authModule.signInAnonymously(auth),')
cut('  db = dbModule.getDatabase(app);\n',
    '  db = dbModule.getDatabase(app);\n'
    '  dbModule.connectDatabaseEmulator(db, "127.0.0.1", 9110);\n')
open(sys.argv[2], "w").write(src)
PY

cat > "$OUT/js/firebase-config.js" <<'JS'
export const firebaseConfig = {
  apiKey: "fake",
  projectId: "votr-rules-test",
  databaseURL: "http://127.0.0.1:9110/?ns=votr-rules-test-default-rtdb",
  authDomain: "127.0.0.1",
  appId: "1:1:web:e2e",
};
export const EVENT_ID = "live";
export const DEFAULT_SECONDS = 30;
export const SECONDS_CHOICES = [0, 10, 15, 20, 30, 45, 60, 90, 120];
export const FIREBASE_VERSION = "vendored";
export const FEEDBACK_EMAIL = "feedback@example.test";
export function isConfigured() { return true; }
JS

# The tour opens itself once per browser; this browser has seen it.
python3 - "$OUT/host.html" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace("</head>",
  "<script>try{localStorage.setItem('votr-tour-seen','1')}catch(e){}</script>\n</head>")
open(p, "w").write(s)
PY

# — the emulators, then the browser —————————————————————————————————————
cd "$HERE"
cp "$R/database.rules.json" "$HERE/database.rules.json"
trap 'rm -f "$HERE/database.rules.json"' EXIT

# See run.sh for why the proxy is dropped: nothing here leaves the machine.
exec env -u https_proxy -u HTTPS_PROXY -u GLOBAL_AGENT_HTTPS_PROXY \
       -u YARN_HTTPS_PROXY -u DOCKER_HTTPS_PROXY -u npm_config_https_proxy \
  npx firebase-tools emulators:exec \
  --project votr-rules-test \
  --only database,auth \
  "node e2e.mjs"
