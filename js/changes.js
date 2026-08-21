// What changed, in the words somebody who uses this would use.
//
// Not a commit log. A commit log says "rekeyed the pulsing dot to data-key";
// this says "the red dot only pulses when a poll is actually live", and
// leaves out everything that changed nothing anybody can see.
//
// Newest first. `on` is a real date, formatted per language by Intl rather
// than written out, so a new entry needs no translation to carry its month.
//
// A version that has shipped does not change. Two lines were added to 1.4
// after it was already released, which is how "what is in 1.4?" stops having
// one answer — they are 1.5 now, and one of them is gone entirely for saying
// "nothing you can see here", which is the definition of a line that does not
// belong in this file.
//
// The lines are in English. Everything else in this app is in five languages
// because a room reads it; this is read once, by a host, out of curiosity —
// and a changelog that has to be translated five times is a changelog that
// stops being written.

export const CHANGES = [
  {
    version: "2.0",
    on: "2026-08-21",
    lines: [
      "A Rating question type — pick it in the editor for 1–5 stars instead of writing your own answers, with no right one to mark. The room picks a star count instead of typed answers, and the average shows wherever the results do.",
    ],
  },
  {
    version: "1.9",
    on: "2026-08-21",
    lines: [
      "The guided tour now points out Clear the room, where the last update added it.",
    ],
  },
  {
    version: "1.8",
    on: "2026-08-21",
    lines: [
      "A Clear the room button in Settings — disconnects everyone in the room so old sessions and devices stop counting as present, without touching the poll or its votes.",
    ],
  },
  {
    version: "1.7",
    on: "2026-08-21",
    lines: [
      "A phone in the room can no longer read a question, or its right answer, ahead of the host putting it up — only the one on screen, and the answer only once it's revealed or the run is over.",
    ],
  },
  {
    version: "1.6",
    on: "2026-08-21",
    lines: [
      "A host who was already signed in no longer reads a blank line under Sign out while the page catches up with the database.",
    ],
  },
  {
    version: "1.5",
    on: "2026-08-20",
    lines: [
      "The countdown bar no longer hangs about on the scores or the closing screen, or after a question is taken down.",
    ],
  },
  {
    version: "1.4",
    on: "2026-08-20",
    lines: [
      "A guided tour the first time you sign in. The ? in the top bar brings it back whenever you want it.",
      "The host page now says which version it is running — this box.",
    ],
  },
  {
    version: "1.3",
    on: "2026-08-20",
    lines: [
      "Quiz scores count time as well as right answers, so a tie is broken by whoever was quicker.",
      "The vote count sits at the top of the big screen and counts against the size of the room: Votes 7/12.",
      "Somebody who has closed their phone stops being counted after an hour.",
    ],
  },
  {
    version: "1.2",
    on: "2026-08-20",
    lines: [
      "A big screen for a projector or a TV, with a join code the room can scan from the back.",
      "It shows the question, the clock, the scores and the applause — and never anything you can press by accident.",
    ],
  },
  {
    version: "1.1",
    on: "2026-08-20",
    lines: [
      "A poll with right answers now ends on a leaderboard, with confetti for whoever won.",
      "Hiding the screen stops the clock, so a question you paused comes back with the seconds it had.",
    ],
  },
  {
    version: "1.0",
    on: "2026-08-19",
    lines: [
      "A new look: one colour, cards, dark mode, and everything sized for a thumb.",
      "Polls — keep a separate set of questions for each talk instead of one growing list.",
      "Everyone gives a name when they join, which is what puts them on the leaderboard.",
      "A clock on each question, and a Reveal step for quizzes.",
      "A heart to tap at the end, and everyone in the room sees it fly.",
    ],
  },
];

/** What this build is. Shown on the host page, and the newest entry above. */
export const VERSION = CHANGES[0].version;
