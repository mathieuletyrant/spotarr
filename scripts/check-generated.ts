// Fails when generated code differs from what is committed, which means
// someone changed a source (.proto, tokens.json, a migration) and forgot
// `pnpm generate`. Runs right after `pnpm generate` inside `pnpm check`.
import { $ } from "bun";

const changed = (await $`git status --porcelain -- ${"**/gen/**"}`.text()).trim();

if (changed) {
  console.error(`Generated code is stale: run pnpm generate and commit the result.\n${changed}`);
  process.exit(1);
}
