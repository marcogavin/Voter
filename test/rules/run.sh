#!/bin/sh
# Runs live.mjs against real Realtime Database + Auth emulators, loaded with
# the real database.rules.json — the one thing npm test can't check, because
# it needs a JVM and a few seconds to spin up, which the fast suite
# deliberately never requires.
#
# Needs: a JDK on PATH, and `npm install` run once in here (firebase,
# firebase-admin, firebase-tools). First run needs network access to fetch
# the emulator binaries; after that they're cached under ~/.cache/firebase.
#
# Usage: sh test/rules/run.sh
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
TEST="$HERE/.."

sh "$TEST/lib/build.sh"

cd "$HERE"
if [ ! -d node_modules ]; then
  echo "test/rules/node_modules is missing — run 'npm install' in test/rules/ first." >&2
  exit 1
fi

# firebase-tools refuses a rules file outside its project directory, and this
# one has to be the real repo root's, not a hand-kept copy that can go stale —
# so it's copied in fresh on every run, not committed here.
cp "$TEST/../database.rules.json" "$HERE/database.rules.json"
trap 'rm -f "$HERE/database.rules.json"' EXIT

# firebase-tools' own HTTP client proxies every request it makes, including
# the one that loads these rules into the emulator on 127.0.0.1 — which this
# sandbox's outbound proxy then refuses, having nothing to do with the actual
# rules. Nothing here needs to leave the machine (the emulator binaries are
# already cached), so the proxy is dropped for this command alone.
exec env -u https_proxy -u HTTPS_PROXY -u GLOBAL_AGENT_HTTPS_PROXY \
       -u YARN_HTTPS_PROXY -u DOCKER_HTTPS_PROXY -u npm_config_https_proxy \
  npx firebase-tools emulators:exec \
  --project votr-rules-test \
  --only database,auth \
  "node live.mjs"
