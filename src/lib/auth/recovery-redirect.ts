/**
 * Password-recovery landing.
 *
 * A reset email returns the member with a recovery token in the URL. If the
 * backend cannot honour the requested redirect target it falls back to the site
 * URL, and the token then lands on a route that has no way to act on it.
 *
 * This forwards that token to /reset-password while preserving it, so the member
 * always reaches the screen that can set a new password. It has no effect on any
 * other URL.
 *
 * Imported for its side effect by the app entry, so it runs before the first
 * render while the token is still in the hash.
 */
const hash = window.location.hash;

const carriesRecoveryToken =
  hash.includes("type=recovery") || hash.includes("error_description");

if (carriesRecoveryToken && !window.location.pathname.startsWith("/reset-password")) {
  window.location.replace(
    `/reset-password${window.location.search}${window.location.hash}`,
  );
}

export {};
