import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { serialize } from "hono/utils/cookie";

const TOKEN_COOKIE = "spotarr_token";

// The only RPC callable without the token: the web UI's sign-in.
const LOGIN_PATH = "/api/spotarr.v1.SpotarrService/Login";

// Accepts the API token as `Authorization: Bearer <token>` (iPhone, scripts)
// or as an HttpOnly cookie (web UI). Answers like Connect does, so every
// client sees one error shape: {"code":"unauthenticated","message":"…"}.
export function requireToken(getToken: () => string): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.path === LOGIN_PATH) return next();

    const header = c.req.header("Authorization");
    const given = header?.startsWith("Bearer ") ? header.slice(7) : getCookie(c, TOKEN_COOKIE);
    if (!given || !sameSecret(given, getToken())) {
      return c.json({ code: "unauthenticated", message: "missing or invalid API token" }, 401);
    }
    await next();
  };
}

// The MCP token, in the URL's `token` parameter: some MCP clients send no
// header of ours, only the URL they were given. Read at each request,
// so a regenerated token applies at once. The API token is refused here,
// as the MCP token is refused by requireToken.
export function requireMcpToken(getToken: () => Promise<string>): MiddlewareHandler {
  return async (c, next) => {
    const given = c.req.query("token");
    if (!given || !sameSecret(given, await getToken())) {
      return c.json({ code: "unauthenticated", message: "missing or invalid MCP token" }, 401);
    }
    await next();
  };
}

// The Seerr token, in the Authorization header as Seerr's Webhook agent sends
// it: the token alone, no "Bearer". Read at each request, so a regenerated
// token applies at once. The other tokens are refused here, and it is refused
// everywhere else.
export function requireSeerrToken(getToken: () => Promise<string>): MiddlewareHandler {
  return async (c, next) => {
    const given = c.req.header("Authorization");
    if (!given || !sameSecret(given, await getToken())) {
      return c.json({ code: "unauthenticated", message: "missing or invalid Seerr token" }, 401);
    }
    await next();
  };
}

// Constant-time comparison, so response timing reveals nothing about the token.
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// The cookie the browser keeps after Login, sent with every call afterwards;
// page scripts cannot read it (HttpOnly).
export function tokenCookie(token: string, https: boolean): string {
  return serialize(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "Strict",
    secure: https,
    path: "/",
    maxAge: 60 * 60 * 24 * 400, // the longest browsers allow
  });
}

// The same cookie, already expired: the browser drops it (Logout).
export function expiredTokenCookie(): string {
  return serialize(TOKEN_COOKIE, "", { httpOnly: true, sameSite: "Strict", path: "/", maxAge: 0 });
}
