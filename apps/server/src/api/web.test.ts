import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { serveWebApp } from "./web";

test("serves files as they are, and index.html for every other path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "spotarr-web-"));
  try {
    await Bun.write(join(dir, "index.html"), "<html>app</html>");
    await Bun.write(join(dir, "assets/app.js"), "console.log(1)");
    const app = new Hono().get("*", serveWebApp(dir));

    expect(await (await app.request("/assets/app.js")).text()).toBe("console.log(1)");
    expect(await (await app.request("/")).text()).toBe("<html>app</html>");
    expect(await (await app.request("/shares/shr_123")).text()).toBe("<html>app</html>");
    expect(await (await app.request("/../../etc/passwd")).text()).toBe("<html>app</html>");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
