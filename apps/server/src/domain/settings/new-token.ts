// 32 random bytes, URL-safe: 43 characters, fit for a header or a URL.
export function newToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}
