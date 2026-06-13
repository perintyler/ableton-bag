import { Ableton } from "ableton-js";

export class AbletonService {
  private ableton: Ableton;
  private started = false;

  constructor() {
    this.ableton = new Ableton({ commandTimeoutMs: 5000 });
  }

  async ensureConnected(): Promise<Ableton> {
    if (!this.started) {
      try {
        await this.ableton.start(5000);
        this.started = true;
      } catch (err) {
        // start() may have partially initialized (UDP socket, file watchers).
        // Close everything so the next attempt starts clean.
        await this.ableton.close().catch(() => {});
        this.ableton = new Ableton({ commandTimeoutMs: 5000 });
        throw err;
      }
    }
    if (!this.ableton.isConnected()) {
      await this.ableton.waitForConnection();
    }
    return this.ableton;
  }

  isConnected(): boolean {
    return this.started && this.ableton.isConnected();
  }

  async close(): Promise<void> {
    if (this.started) {
      await this.ableton.close();
      this.started = false;
    }
  }

  get live(): Ableton {
    return this.ableton;
  }
}

let instance: AbletonService | null = null;

export function getConnection(): AbletonService {
  if (!instance) instance = new AbletonService();
  return instance;
}
