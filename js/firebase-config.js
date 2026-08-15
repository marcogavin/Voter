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
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_PROJECT",
  storageBucket: "PASTE_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
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
