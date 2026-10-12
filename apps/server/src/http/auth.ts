import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

export const TOKEN_COOKIE = "spotarr_token";

// Accepts the API token as `Authorization: Bearer <token>` (iPhone, scripts)
// or as an HttpOnly cookie (web UI). Answers like Connect does, so every
// client sees one error shape: {"code":"unauthenticated","message":"…"}.
export function requireToken(getToken: () => string): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    const given = header?.startsWith("Bearer ") ? header.slice(7) : getCookie(c, TOKEN_COOKIE);
    if (!given || !sameSecret(given, getToken())) {
      return c.json({ code: "unauthenticated", message: "missing or invalid API token" }, 401);
    }
    await next();
  };
}

// Constant-time comparison, so response timing reveals nothing about the token.
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
