import { SpotarrError } from "../../errors";
import { sameSecret, tokenCookie } from "../auth";
import type { Rpcs } from "./types";

export function authRpcs(apiToken: () => string): Rpcs<"login"> {
  return {
    login(req, context) {
      if (!sameSecret(req.token.trim(), apiToken())) {
        throw new SpotarrError("unauthenticated", "wrong API token");
      }
      // Behind the Cloudflare tunnel the page is served over https: mark the cookie Secure.
      const https = context.requestHeader.get("X-Forwarded-Proto") === "https";
      context.responseHeader.append("Set-Cookie", tokenCookie(req.token.trim(), https));
      return {};
    },
  };
}
