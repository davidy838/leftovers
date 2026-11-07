import { describe, expect, it } from "vitest";
import { RequestSeq } from "../src/lib/requestSeq";

describe("RequestSeq", () => {
  it("only the latest ticket is current", () => {
    const seq = new RequestSeq();
    const a = seq.next();
    const b = seq.next();
    expect(seq.isCurrent(a)).toBe(false);
    expect(seq.isCurrent(b)).toBe(true);
  });

  it("invalidate makes an in-flight ticket stale (e.g. mode switched while AI was loading)", () => {
    const seq = new RequestSeq();
    const t = seq.next();
    seq.invalidate();
    expect(seq.isCurrent(t)).toBe(false);
  });

  it("peek detects that something changed while a poll was in flight", () => {
    const seq = new RequestSeq();
    const before = seq.peek();
    expect(seq.peek()).toBe(before);
    seq.invalidate(); // a signal response landed
    expect(seq.peek()).not.toBe(before);
  });
});
