import pkg from "../../../package.json";
import type { Rpcs } from "./types";

export function statusRpcs(): Rpcs<"getStatus"> {
  return {
    getStatus: () => ({ version: pkg.version }),
  };
}
