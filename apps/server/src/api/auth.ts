import { timingSafeEqual } from "node:crypto";
import type { Handler, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";

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

// The web UI's login: checks the token once and keeps it in an HttpOnly cookie,
// which the browser sends with every call and page scripts cannot read.
export function login(getToken: () => string): Handler {
  return async (c) => {
    const { token } = await c.req.json<{ token?: string }>();
    if (!token || !sameSecret(token, getToken())) {
      return c.json({ code: "unauthenticated", message: "wrong API token" }, 401);
    }
    setCookie(c, TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "Strict",
      secure: new URL(c.req.url).protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 400, // the longest browsers allow
    });
    return c.body(null, 204);
  };
}

// Constant-time comparison, so response timing reveals nothing about the token.
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
