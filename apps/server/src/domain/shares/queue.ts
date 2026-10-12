import { log } from "../../log";
import type { ShareRepository } from "./repository";
import type { IdentificationResult, ShareInput } from "./types";

export type Identify = (shareId: string, input: ShareInput) => Promise<IdentificationResult>;

// Runs Identifications in the background, at most `concurrency()` at a time.
// The queue itself is the shares table (status QUEUED): nothing is lost on a
// restart, and start() puts interrupted Identifications back in line.
export class ShareQueue {
  private running = 0;

  constructor(
    private readonly shares: ShareRepository,
    private readonly identify: Identify,
    private readonly concurrency: () => Promise<number>,
  ) {}

  async start(): Promise<void> {
    await this.shares.requeueInterrupted();
    this.wake();
  }

  // Call after queuing a Share. Returns at once; the work happens in the background.
  wake(): void {
    void this.fillFreeSlots();
  }

  // Starts Identifications until every slot is busy or nothing is queued.
  private async fillFreeSlots(): Promise<void> {
    const slots = await this.concurrency();
    while (this.running < slots) {
      // Take the slot before the next await, so two calls cannot both take it.
      this.running++;
      const id = await this.shares.claimNext();
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
  }
}
