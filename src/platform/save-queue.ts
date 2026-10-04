/** Every requested snapshot gets its own write. Later callers never borrow an older save. */
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    // A failed write is reported to its caller but must not poison future saves.
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  idle(): Promise<void> {
    return this.tail;
  }
}
