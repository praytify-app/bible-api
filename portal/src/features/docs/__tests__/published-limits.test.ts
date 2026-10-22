import { describe, expect, it } from "vitest";
import { clientShareSentence, PUBLISHED_CLIENT_SHARE } from "../published-limits";

describe("clientShareSentence", () => {
  it("states the published per-visitor share as percentages", () => {
    expect(clientShareSentence(PUBLISHED_CLIENT_SHARE)).toBe(
      "A publishable key is shared by every visitor of the site it is on, so one visitor (one IP address) " +
        "can use at most 25% of its per-minute limit and 10% of its per-day limit."
    );
  });

  it("follows whatever share the gateway reports", () => {
    expect(clientShareSentence({ perMinute: 0.5, perDay: 0.125 })).toContain("at most 50% of its per-minute limit and 12.5% of its per-day limit");
  });
});
