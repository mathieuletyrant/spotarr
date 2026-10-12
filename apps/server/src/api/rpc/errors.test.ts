import { expect, test } from "bun:test";
import { Code, type ConnectError } from "@connectrpc/connect";
import { z } from "zod";
import { SpotarrError } from "../../errors";
import { errorsToConnect } from "./errors";

// Runs the interceptor around a fake RPC that throws `error`, returns what comes out.
async function connectErrorFor(error: unknown): Promise<ConnectError> {
  const rpc = errorsToConnect(async () => {
    throw error;
  });
  try {
    await rpc({} as never);
  } catch (thrown) {
    return thrown as ConnectError;
  }
  throw new Error("the interceptor swallowed the error");
}

test.each([
  ["invalid_input", Code.InvalidArgument],
  ["not_found", Code.NotFound],
  ["busy", Code.FailedPrecondition],
  ["not_configured", Code.FailedPrecondition],
  ["unavailable", Code.Unavailable],
  ["timeout", Code.DeadlineExceeded],
] as const)("%s becomes Connect code %i, message kept", async (code, connectCode) => {
  const error = await connectErrorFor(new SpotarrError(code, "TMDB answered 401"));
  expect(error.code).toBe(connectCode);
  expect(error.rawMessage).toBe("TMDB answered 401");
});

test("a zod error becomes invalid_argument naming the field", async () => {
  const zodError = z.object({ year: z.int() }).safeParse({ year: "x" }).error;
  const error = await connectErrorFor(zodError);
  expect(error.code).toBe(Code.InvalidArgument);
  expect(error.rawMessage).toContain("year");
});

test("anything else is internal", async () => {
  expect((await connectErrorFor(new TypeError("x is undefined"))).code).toBe(Code.Internal);
});
