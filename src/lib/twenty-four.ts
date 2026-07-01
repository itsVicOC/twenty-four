export type Operator = "+" | "-" | "*" | "/";

export type Fraction = {
  n: number;
  d: number;
};

export type Tile = Fraction & {
  id: string;
  expr: string;
};

export type SolutionStep = {
  left_id: string;
  right_id: string;
  operator_code: Operator;
  result_id: string;
};

export const TARGET_VALUE = 24;

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
};

export const makeFraction = (n: number, d = 1): Fraction => {
  if (d === 0) {
    throw new Error("Division by zero");
  }

  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return {
    n: (n / g) * sign,
    d: Math.abs(d / g),
  };
};

export const formatFraction = ({ n, d }: Fraction) => {
  if (d === 1) return String(n);
  return `${n}/${d}`;
};

export const isTarget = ({ n, d }: Fraction) => n === TARGET_VALUE * d;

export const applyOperator = (
  left: Fraction,
  right: Fraction,
  op: Operator,
): Fraction => {
  switch (op) {
    case "+":
      return makeFraction(left.n * right.d + right.n * left.d, left.d * right.d);
    case "-":
      return makeFraction(left.n * right.d - right.n * left.d, left.d * right.d);
    case "*":
      return makeFraction(left.n * right.n, left.d * right.d);
    case "/":
      if (right.n === 0) {
        throw new Error("Division by zero");
      }
      return makeFraction(left.n * right.d, left.d * right.n);
    default: {
      const unreachable: never = op;
      return unreachable;
    }
  }
};

export const createInitialTiles = (numbers: readonly number[]): Tile[] =>
  numbers.map((value, index) => ({
    id: `n${index}`,
    n: value,
    d: 1,
    expr: String(value),
  }));

export const applyStepToTiles = (
  tiles: readonly Tile[],
  step: SolutionStep,
): Tile[] => {
  const left = tiles.find((tile) => tile.id === step.left_id);
  const right = tiles.find((tile) => tile.id === step.right_id);

  if (!left || !right || left.id === right.id) {
    throw new Error("Invalid operands");
  }

  const result = applyOperator(left, right, step.operator_code);
  const nextTile: Tile = {
    id: step.result_id,
    ...result,
    expr: `(${left.expr} ${displayOperator(step.operator_code)} ${right.expr})`,
  };

  return [...tiles.filter((tile) => tile.id !== left.id && tile.id !== right.id), nextTile];
};

export const replaySteps = (
  numbers: readonly number[],
  steps: readonly SolutionStep[],
): Tile[] => steps.reduce(applyStepToTiles, createInitialTiles(numbers));

export const displayOperator = (op: Operator) => {
  if (op === "*") return "×";
  if (op === "/") return "÷";
  return op;
};

export const serializeSteps = (steps: readonly SolutionStep[]) =>
  steps.map(({ left_id, right_id, operator_code, result_id }) => ({
    left_id,
    right_id,
    operator_code,
    result_id,
  }));

type SearchNode = Fraction & {
  expr: string;
};

export const findSolutionExpression = (numbers: readonly number[]): string | null => {
  const search = (nodes: SearchNode[]): string | null => {
    if (nodes.length === 1) {
      return isTarget(nodes[0]) ? nodes[0].expr : null;
    }

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = 0; j < nodes.length; j += 1) {
        if (i === j) continue;

        const rest = nodes.filter((_, index) => index !== i && index !== j);
        const left = nodes[i];
        const right = nodes[j];
        const ops: Operator[] = ["+", "-", "*", "/"];

        for (const op of ops) {
          if ((op === "+" || op === "*") && j < i) continue;
          if (op === "/" && right.n === 0) continue;

          try {
            const value = applyOperator(left, right, op);
            const found = search([
              ...rest,
              {
                ...value,
                expr: `(${left.expr} ${displayOperator(op)} ${right.expr})`,
              },
            ]);
            if (found) return found;
          } catch {
            continue;
          }
        }
      }
    }

    return null;
  };

  return search(numbers.map((value) => ({ n: value, d: 1, expr: String(value) })));
};

export const isSolvablePuzzle = (numbers: readonly number[]) =>
  findSolutionExpression(numbers) !== null;

export const PRACTICE_PUZZLES: [number, number, number, number][] = [
  [1, 3, 4, 6],
  [2, 3, 8, 8],
  [3, 3, 8, 8],
  [1, 5, 5, 5],
  [4, 4, 7, 7],
  [2, 6, 6, 9],
  [1, 2, 7, 7],
  [5, 5, 5, 1],
  [2, 4, 10, 10],
  [3, 4, 6, 6],
  [1, 6, 6, 8],
  [2, 2, 10, 10],
  [7, 7, 3, 3],
  [1, 4, 5, 6],
  [2, 5, 7, 9],
  [4, 6, 8, 10],
  [1, 8, 8, 9],
  [3, 5, 7, 11],
  [2, 4, 7, 13],
  [6, 6, 6, 6],
];

export const getPracticePuzzle = (seed: number) =>
  PRACTICE_PUZZLES[Math.abs(seed) % PRACTICE_PUZZLES.length];
