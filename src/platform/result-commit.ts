/** A replayable battle remains until its profile and route have both committed. */
export class ResultCommit {
  private checkpointSaved = false;
  private profileSaved = false;
  private routeSaved = false;
  private complete = false;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly snapshot: {
      battle: unknown;
      profile: unknown;
      expedition: unknown | null;
    },
    private readonly storage: {
      saveRecord(key: string, value: unknown): Promise<void>;
      writeLocal(key: string, value: unknown): boolean;
      removeRecord(key: string): Promise<void>;
    },
  ) {
    this.snapshot = structuredClone(snapshot);
  }

  get recoverable(): boolean {
    return this.checkpointSaved;
  }

  commit(): Promise<void> {
    if (this.complete) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.write().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async write(): Promise<void> {
    if (!this.checkpointSaved) {
      await this.storage.saveRecord("battle", this.snapshot.battle);
      this.checkpointSaved = true;
    }
    if (!this.profileSaved) {
      if (!this.storage.writeLocal("profile", this.snapshot.profile))
        throw new Error(
          "Could not save your command record. Free browser storage, then retry saving this result.",
        );
      this.profileSaved = true;
    }
    if (!this.routeSaved) {
      if (this.snapshot.expedition)
        await this.storage.saveRecord("expedition", this.snapshot.expedition);
      this.routeSaved = true;
    }
    await this.storage.removeRecord("battle");
    this.complete = true;
  }
}
