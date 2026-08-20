#!/bin/sh
# Did anything a user can see change, without a line saying so?
#
# The changelog is the one thing here that no test can check for you: a suite
# can tell you the log is tidy, but not that it is current. This turns the
# habit into a rule.
#
# It fails when a pull request touches the app but leaves js/changes.js alone.
# It cannot judge whether the line is any good — that part is still on whoever
# writes it.
#
# Usage: changelog-check.sh <base-sha> <head-sha>
set -eu
BASE=${1:?base sha}
HEAD=${2:?head sha}

changed=$(git diff --name-only "$BASE" "$HEAD")

# The app as it reaches a browser. Not test/, not the documents — a change to
# either of those is real work that nobody using this would ever notice.
visible=$(printf '%s\n' "$changed" \
  | grep -E '^(js/|css/|img/|[^/]+\.html$|site\.webmanifest$)' \
  | grep -v '^js/changes\.js$' || true)

if [ -z "$visible" ]; then
  echo "Nothing a user can see changed. Nothing to log."
  exit 0
fi

if printf '%s\n' "$changed" | grep -q '^js/changes\.js$'; then
  echo "The app changed, and so did the changelog. Good."
  exit 0
fi

# The escape hatch, for a change that is genuinely invisible — a comment, a
# rename, a test-only import. Say so in a commit message and mean it: an
# escape hatch used lazily turns this check into theatre.
if git log --format=%B "$BASE..$HEAD" | grep -qi 'no-changelog'; then
  echo "Marked no-changelog. Taking your word for it."
  exit 0
fi

cat <<MSG

  This pull request changes the app but says nothing about it in
  js/changes.js.

  Changed:
$(printf '%s\n' "$visible" | sed 's/^/    /')

  Add a line to js/changes.js in the words somebody who uses VOTR would
  use, and bump the version at the top. Leave out anything that changed
  nothing anybody can notice.

  If this really is invisible from the outside, put "no-changelog" in a
  commit message and this will stand aside.

MSG
exit 1
