import { describe, expect, it } from "vitest";
import { formatDuration, pointsForRank } from "./leaderboard";

describe("leaderboard helpers", () => {
  it("uses the official daily points table", () => {
    expect(pointsForRank(1)).toBe(25);
    expect(pointsForRank(2)).toBe(18);
    expect(pointsForRank(10)).toBe(1);
    expect(pointsForRank(11)).toBe(1);
    expect(pointsForRank(0)).toBe(0);
  });

  it("formats score milliseconds for ranking display", () => {
    expect(formatDuration(0)).toBe("0:00.0");
    expect(formatDuration(64_321)).toBe("1:04.3");
  });
});
