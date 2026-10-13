import { log } from "../../log";
import { runIdentification } from "../identification/use-cases/run-identification";
import type { SettingsRepository } from "../settings/repository";
import type { WebhookSender } from "../webhooks/sender";
import type { ShareRepository } from "./repository";
import type { IdentificationResult, ShareInput } from "./types";
import { endIdentification } from "./use-cases/end-identification";

export type Identify = (shareId: string, input: ShareInput) => Promise<IdentificationResult>;

// Runs Identifications in the background, at most `concurrency()` at a time.
// The queue itself is the shares table (status QUEUED): nothing is lost on a
// restart, and start() puts interrupted Identifications back in line.
//
// A Share's whole lifecycle happens here: claimed, identified, finished or
// failed, then ended (Webhooks, then auto add).
export class ShareQueue {
  private running = 0;
  private readonly shares: ShareRepository;
  private readonly settings: SettingsRepository;
  private readonly sender: WebhookSender;
  private readonly identify: Identify;

  constructor(deps: {
    shares: ShareRepository;
    settings: SettingsRepository;
    sender: WebhookSender;
    // The Identification itself. Tests replace it, so no LLM is called.
    identify?: Identify;
  }) {
    this.shares = deps.shares;
    this.settings = deps.settings;
    this.sender = deps.sender;
    this.identify =
      deps.identify ?? ((shareId, input) => runIdentification(shareId, input, deps.settings));
  }

  async start(): Promise<void> {
    await this.shares.requeueInterrupted();
    this.wake();
  }

  // Call after queuing a Share. Returns at once; the work happens in the background.
  wake(): void {
    // A database error here must not stop the queue: the next wake() retries.
    void this.fillFreeSlots().catch((error) => log({ step: "queue", error: String(error) }));
  }

  // Starts Identifications until every slot is busy or nothing is queued.
  private async fillFreeSlots(): Promise<void> {
    const slots = (await this.settings.get()).extraction.concurrency;
    while (this.running < slots) {
      // Take the slot before the next await, so two calls cannot both take it.
      this.running++;
      let id: string | undefined;
      try {
        id = await this.shares.claimNext();
      } catch (error) {
        this.running--; // give the slot back, or it is lost until a restart
        throw error;
      }
      if (!id) {
        this.running--;
        return;
      }
      void this.process(id).finally(() => {
        this.running--;
        this.wake(); // a slot just freed up: start the next queued Share
      });
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
    const deps = { shares: this.shares, settings: this.settings, sender: this.sender };
    await endIdentification(id, deps).catch((error) =>
      log({ shareId: id, step: "ended", error: String(error) }),
    );
  }
}
