import { DependencyState } from "@spotarr/contract";
import pkg from "../../../package.json";
import type { SettingsRepository } from "../../domain/settings/repository";
import { checkDependencies } from "../../domain/settings/use-cases/check-dependencies";
import type { ShareRepository } from "../../domain/shares/repository";
import type { Rpcs } from "./types";

export function statusRpcs(
  settings: SettingsRepository,
  shares: ShareRepository,
): Rpcs<"getStatus" | "checkDependencies"> {
  return {
    getStatus: () => ({ version: pkg.version }),

    checkDependencies: async () => {
      const dependencies = await checkDependencies(await settings.get());
      const llmCost = await shares.llmCostLast30Days();
      return {
        dependencies: dependencies.map((d) => ({ ...d, state: DependencyState[d.state] })),
        llmCost: llmCost.identifications > 0 ? llmCost : undefined,
      };
    },
  };
}
