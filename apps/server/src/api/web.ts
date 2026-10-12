import { join, normalize } from "node:path";
import type { Handler } from "hono";

// Serves the built web UI (apps/web/dist). A file that exists is sent as is;
// any other path gets index.html, so a link straight to /shares/… opens the app,
// which then shows the right page.
export function serveWebApp(dir: string): Handler {
  return async (c) => {
    const path = normalize(join(dir, c.req.path));
    const file = Bun.file(path);
    if (path.startsWith(dir) && c.req.path !== "/" && (await file.exists())) {
      return new Response(file);
    }
    return new Response(Bun.file(join(dir, "index.html")));
  };
}
