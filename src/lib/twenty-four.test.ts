import { describe, expect, it } from "vitest";
import {
  applyOperator,
  findSolutionExpression,
  formatFraction,
  isSolvablePuzzle,
  isTarget,
  replaySteps,
  type SolutionStep,
} from "./twenty-four";

describe("twenty-four arithmetic", () => {
  it("uses exact fractions for division and subtraction", () => {
    const threeQuarters = applyOperator({ n: 3, d: 1 }, { n: 4, d: 1 }, "/");
    const oneQuarter = applyOperator({ n: 1, d: 1 }, threeQuarters, "-");

    expect(formatFraction(threeQuarters)).toBe("3/4");
    expect(formatFraction(oneQuarter)).toBe("1/4");
  });

  it("replays a valid three-step solution to 24", () => {
    const steps: SolutionStep[] = [
      { left_id: "n1", right_id: "n2", operator_code: "/", result_id: "r0" },
      { left_id: "n0", right_id: "r0", operator_code: "-", result_id: "r1" },
      { left_id: "n3", right_id: "r1", operator_code: "/", result_id: "r2" },
    ];

    const tiles = replaySteps([1, 3, 4, 6], steps);

    expect(tiles).toHaveLength(1);
    expect(isTarget(tiles[0])).toBe(true);
  });

  it("finds solutions for seeded puzzles", () => {
    expect(isSolvablePuzzle([3, 8, 12, 13])).toBe(true);
    expect(findSolutionExpression([2, 3, 7, 8])).not.toBeNull();
  });

  it("rejects division by zero", () => {
    expect(() => applyOperator({ n: 8, d: 1 }, { n: 0, d: 1 }, "/")).toThrow(
      "Division by zero",
    );
  });
});
