// ─── Firebase project settings ───────────────────────────────────────────────
//
// To change projects, replace these with the config from:
//   Firebase console → gear icon (Project settings) → Your apps → Web app
//
// This is NOT a password. The web config identifies your project; it does not
// grant access to it. Access is controlled by database.rules.json. Every Firebase
// web app ships this config publicly — committing it here is normal and expected.
//
// Note the europe-west1 region: this project's database lives on
// firebasedatabase.app, not the older firebaseio.com domain.
export const firebaseConfig = {
  apiKey: "AIzaSyDGJKunlT6PMT-aLa7D9tSAL2zKH9_KbIw",
  appId: "1:1064961832465:web:7d69bfc46c4f8c20e763b0",
  databaseURL: "https://voter-72d36-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "voter-72d36",
  authDomain: "voter-72d36.firebaseapp.com",
};

// Which event this deployment reads and writes. An event holds the whole set of
// questions plus a pointer to whichever one is currently on screen.
// Change it to run a second, separate event without disturbing the first.
export const EVENT_ID = "live";

// How long a question accepts votes before closing itself. The host sets this
// in Setup and it's stored with the event; this is only what an event that has
// never had it set falls back to. Zero means no time limit at all.
export const DEFAULT_SECONDS = 30;

// What the Setup picker offers. Zero is "no time limit" — a question then stays
// open until the host closes it, which is how the app worked before the clock.
export const SECONDS_CHOICES = [0, 10, 15, 20, 30, 45, 60, 90, 120];

// Version of the Firebase JS SDK loaded from Google's CDN.
// Bump this if you ever need a newer release.
export const FIREBASE_VERSION = "12.17.1";

// True once the placeholders above have actually been replaced.
export function isConfigured() {
  return !Object.values(firebaseConfig).some(
    (value) => typeof value === "string" && value.includes("PASTE_"),
  );
}
