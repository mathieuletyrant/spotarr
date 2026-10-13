import { log } from "../../log";
import { runIdentification } from "../identification/use-cases/run-identification";
import type { SettingsRepository } from "../settings/repository";
import type { Emit } from "./events";
import type { ShareRepository } from "./repository";
import type { IdentificationResult, ShareInput } from "./types";
import { endIdentification } from "./use-cases/end-identification";

export type Identify = (shareId: string, input: ShareInput) => Promise<IdentificationResult>;

// Runs Identifications in the background. The queue itself is the shares
// table: a Share is waiting while its status is QUEUED, so nothing is lost on a
// restart. `concurrency` workers each loop: take the next QUEUED Share,
// identify it, start over; with nothing waiting, look again a second later.
//
// A Share's whole lifecycle happens here: claimed, identified, finished or
// failed, then ended (its Event emitted, then auto add).
export class ShareQueue {
  private readonly shares: ShareRepository;
  private readonly settings: SettingsRepository;
  private readonly emit: Emit;
  private readonly identify: Identify;
  private readonly idleMs: number;

  constructor(deps: {
    shares: ShareRepository;
    settings: SettingsRepository;
    emit: Emit;
    // The Identification itself. Tests replace it, so no LLM is called.
    identify?: Identify;
    // How long a worker waits when nothing is queued. Tests shorten it.
    idleMs?: number;
  }) {
    this.shares = deps.shares;
    this.settings = deps.settings;
    this.emit = deps.emit;
    this.identify =
      deps.identify ?? ((shareId, input) => runIdentification(shareId, input, deps.settings));
    this.idleMs = deps.idleMs ?? 1000;
  }

  // Puts the Identifications a restart interrupted back in line, then starts
  // the workers. The concurrency setting applies at the next start.
  async start(): Promise<void> {
    await this.shares.requeueInterrupted();
    const { concurrency } = (await this.settings.get()).extraction;
    for (let i = 0; i < concurrency; i++) void this.work();
  }

  // One worker. Never stops: a database error only means trying again later.
  private async work(): Promise<void> {
    while (true) {
      const id = await this.shares.claimNext().catch((error) => {
        log({ step: "queue", error: String(error) });
        return undefined;
      });
      if (id) await this.process(id);
      else await Bun.sleep(this.idleMs);
    }
  }

  private async process(id: string): Promise<void> {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    try {
      const result = await this.identify(id, await this.shares.input(id));
      await this.shares.finish(id, result, elapsed());
      log({ shareId: id, step: "identification", durationMs: elapsed(), status: result.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log({ shareId: id, step: "identification", durationMs: elapsed(), error: message });
      await this.shares.fail(id, message, elapsed());
    }
    // Outside the try: what follows never changes the Share's outcome.
    const deps = { shares: this.shares, settings: this.settings, emit: this.emit };
    await endIdentification(id, deps).catch((error) =>
      log({ shareId: id, step: "ended", error: String(error) }),
    );
  }
}
