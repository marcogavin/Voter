#!/bin/sh
# Runs every suite. `npm test` from test/, or sh test/run.sh from anywhere.
#
# A suite that crashes prints nothing and exits non-zero. That used to read as
# a blank line and count as a pass, which is the one failure a test runner must
# never have — so the exit status is captured on its own line, before any pipe
# can throw it away.
HERE=$(cd "$(dirname "$0")" && pwd)
R="$HERE/.."

sh "$HERE/lib/build.sh"

# The browser suites need both sites served: the repo as it would be deployed,
# and the mirrored copy with the stubbed sync. Started here rather than
# assumed, because a dead server looks exactly like a passing suite.
serve() {
  curl -sf -o /dev/null "http://127.0.0.1:$1/" && return
  ( cd "$2" && setsid nohup python3 -m http.server "$1" >/dev/null 2>&1 & )
  sleep 1
}
serve 8765 "$R"
serve 8766 "$HERE/build/site"

fail=0
run() {
  printf '%-11s ' "$1"
  out=$(cd "$HERE/suites" && eval "$2" "./$1.mjs" 2>&1)
  rc=$?
  last=$(printf '%s\n' "$out" | tail -1)
  if [ "$rc" -ne 0 ]; then
    fail=1
    [ -n "$last" ] && echo "$last" || echo "CRASHED (no output)"
    printf '%s\n' "$out" | tail -6 | sed 's/^/            /'
  else
    echo "$last"
    case "$last" in *FAILED*) fail=1;; esac
  fi
}

# Logic, in jsdom against the real page scripts.
for t in run fresh guards join applause fallbacks startover polls pause badge \
         scores stopwatch signin tour news board wall-unit contrast; do
  run "$t" node
done

# Layout, in a real browser. These need Chromium; see test/README.md.
for t in gate overflow taps touching wall-fit tourfit; do
  run "$t" "node"
done

echo
[ "$fail" = 0 ] && echo "ALL SUITES GREEN" || echo "SOMETHING FAILED"
exit $fail
