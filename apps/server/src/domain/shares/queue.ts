import type { ShareRepository } from "./repository";
import type { IdentificationResult, ShareInput } from "./types";

export type Identify = (input: ShareInput) => Promise<IdentificationResult>;

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
    void this.pump();
  }

  private async pump(): Promise<void> {
    for (;;) {
      const max = await this.concurrency();
      // Check and reserve a slot in the same tick, so two pumps cannot both take it.
      if (this.running >= max) return;
      this.running++;
      const id = await this.shares.claimNext();
      if (!id) {
        this.running--;
        return;
      }
      void this.run(id).finally(() => {
        this.running--;
        this.wake();
      });
    }
  }

  private async run(id: string): Promise<void> {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    try {
      const result = await this.identify(await this.shares.input(id));
      await this.shares.finish(id, result, elapsed());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ shareId: id, step: "identification", error: message }));
      await this.shares.fail(id, message, elapsed());
    }
  }
}
