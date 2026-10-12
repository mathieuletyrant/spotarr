import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { z } from "zod";

// Runs around every RPC. A ZodError means the client sent an invalid value:
// answer invalid_argument with the field path, instead of a generic internal error.
export const validationErrors: Interceptor = (next) => async (req) => {
  try {
    return await next(req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConnectError(z.prettifyError(error), Code.InvalidArgument);
    }
    throw error;
  }
};
