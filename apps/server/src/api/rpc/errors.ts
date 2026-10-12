import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { z } from "zod";
import { type ErrorCode, SpotarrError } from "../../errors";

// Each error code becomes the Connect code the UI and the iPhone receive,
// as JSON: {"code": "unavailable", "message": "TMDB answered 401"}.
const CONNECT_CODES: Record<ErrorCode, Code> = {
  unauthenticated: Code.Unauthenticated,
  invalid_input: Code.InvalidArgument,
  not_found: Code.NotFound,
  busy: Code.FailedPrecondition,
  not_configured: Code.FailedPrecondition,
  unavailable: Code.Unavailable,
  timeout: Code.DeadlineExceeded,
};

// Runs around every RPC and turns whatever it throws into a Connect error.
export const errorsToConnect: Interceptor = (next) => async (req) => {
  try {
    return await next(req);
  } catch (error) {
    if (error instanceof SpotarrError) {
      throw new ConnectError(error.message, CONNECT_CODES[error.code]);
    }
    if (error instanceof z.ZodError) {
      throw new ConnectError(z.prettifyError(error), Code.InvalidArgument);
    }
    if (error instanceof ConnectError) throw error;

    // A bug: logged in full, answered as internal.
    console.error(
      JSON.stringify({ step: "rpc", error: String(error), stack: (error as Error).stack }),
    );
    throw new ConnectError(String(error), Code.Internal);
  }
};
