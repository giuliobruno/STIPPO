export function randomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function vaultOAuthRedirectUri(): string {
  return `${window.location.origin}/app/vault`;
}

export function cleanOAuthParamsFromUrl() {
  const clean = new URL(window.location.href);
  clean.searchParams.delete("code");
  clean.searchParams.delete("state");
  clean.searchParams.delete("session_state");
  clean.searchParams.delete("error");
  clean.searchParams.delete("error_description");
  window.history.replaceState({}, "", clean.pathname + clean.search);
}
