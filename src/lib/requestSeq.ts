// Tiny guard against out-of-order async results ("last request wins").
// Take a ticket before an async call; after it resolves, only apply the result if
// the ticket is still current. `invalidate()` makes every outstanding ticket stale
// (e.g. the user switched mode, or newer data arrived another way).
export class RequestSeq {
  private current = 0;

  /** Start a new request; any earlier ticket becomes stale. */
  next(): number {
    this.current += 1;
    return this.current;
  }

  /** Make all outstanding tickets stale without starting a request. */
  invalidate(): void {
    this.current += 1;
  }

  isCurrent(ticket: number): boolean {
    return ticket === this.current;
  }

  /** Current value without starting a request (for "has anything changed since?"). */
  peek(): number {
    return this.current;
  }
}
