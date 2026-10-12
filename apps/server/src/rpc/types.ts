import type { ServiceImpl } from "@connectrpc/connect";
import type { SpotarrService } from "@spotarr/contract";

// The handlers of some RPCs of SpotarrService, typed from the contract: a field
// renamed in the .proto becomes a type error in the handler that returns it.
export type Rpcs<Method extends keyof ServiceImpl<typeof SpotarrService>> = Pick<
  ServiceImpl<typeof SpotarrService>,
  Method
>;
