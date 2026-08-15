// ─── PASTE YOUR FIREBASE CONFIG BELOW ────────────────────────────────────────
//
// Where to get it:
//   Firebase console → your project → gear icon (Project settings)
//   → scroll to "Your apps" → Web app → "SDK setup and configuration" → Config
//
// This is NOT a password. The web config identifies your project; it does not
// grant access to it. Access is controlled by database.rules.json. Every Firebase
// web app ships this config publicly — committing it here is normal and expected.
//
// Until you replace the placeholders, the app shows a setup message instead of
// crashing.

export const firebaseConfig = {
  // Still needed — copy these two from the console.
  apiKey: "PASTE_API_KEY_HERE",
  appId: "PASTE_APP_ID",

  // Already confirmed. Note the europe-west1 region: this project's database
  // lives on firebasedatabase.app, not the older firebaseio.com domain.
  databaseURL: "https://voter-72d36-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "voter-72d36",
  authDomain: "voter-72d36.firebaseapp.com",
};

// Which poll this deployment reads and writes. One event = one id is fine.
// Change it to run a second, separate poll without disturbing the first.
export const POLL_ID = "live";

// Version of the Firebase JS SDK loaded from Google's CDN.
// Bump this if you ever need a newer release.
export const FIREBASE_VERSION = "12.17.1";

// True once the placeholders above have actually been replaced.
export function isConfigured() {
  return !Object.values(firebaseConfig).some(
    (value) => typeof value === "string" && value.includes("PASTE_"),
  );
}
