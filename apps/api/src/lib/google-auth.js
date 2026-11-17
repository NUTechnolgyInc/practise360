// Google sign-in: the browser gets an ID token from Google Identity Services and posts it here.
// This module only turns that token into a verified email — RBAC never learns how someone signed in.
const { OAuth2Client } = require("google-auth-library");

const clientId = () => (process.env.GOOGLE_CLIENT_ID || "").trim();
const allowedDomains = () =>
  (process.env.GOOGLE_ALLOWED_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

const isGoogleEnabled = () => Boolean(clientId());

/**
 * Checks the claims of an already signature-verified ID token. Kept pure so it is testable without Google.
 * Returns { email, name } or { error }.
 */
function identityFromClaims(claims, domains = allowedDomains()) {
  const email = String(claims?.email || "").toLowerCase().trim();
  if (!email || claims.email_verified !== true) return { error: "Your Google account's email isn't verified" };
  if (domains.length) {
    // `hd` is only set for Google Workspace accounts. Requiring it stops a personal Google account that was
    // registered with a company address from passing as a company account.
    const hd = String(claims.hd || "").toLowerCase();
    if (!domains.includes(hd)) return { error: `Sign in with your ${domains.join(" or ")} Google account` };
  }
  return { email, name: claims.name || null };
}

let client;
/** Verifies signature, issuer, expiry and that the token was issued for our Client ID, then checks the claims. */
async function verifyGoogleCredential(credential) {
  client ||= new OAuth2Client(clientId());
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken: credential, audience: clientId() });
  } catch {
    return { error: "Google sign-in failed. Try again." };
  }
  return identityFromClaims(ticket.getPayload());
}

module.exports = { clientId, isGoogleEnabled, identityFromClaims, verifyGoogleCredential };
