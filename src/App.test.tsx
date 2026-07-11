import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyPuzzle, RunState } from "./lib/supabase";
import App from "./App";

const createPuzzles = (solvedCount = 0): DailyPuzzle[] =>
  Array.from({ length: 10 }, (_, index) => ({
    puzzle_index: index + 1,
    numbers: [1, 3, 4, 6],
    solved: index < solvedCount,
  }));

const createRun = (solvedCount = 0): RunState => ({
  run_id: "run-1",
  event_date: "2026-07-01",
  started_at: "2026-07-01T00:00:00.000Z",
  completed_at: null,
  score_ms: null,
  puzzles: createPuzzles(solvedCount),
});

const supabaseMocks = vi.hoisted(() => ({
  ensureAnonymousUser: vi.fn(),
  getHistoryLeaderboard: vi.fn(),
  getTodayLeaderboard: vi.fn(),
  resumeDailyRun: vi.fn(),
  restartDailyRun: vi.fn(),
  saveProfile: vi.fn(),
  startDailyRun: vi.fn(),
  submitDailySolution: vi.fn(),
}));

vi.mock("./lib/supabase", () => ({
  ensureAnonymousUser: supabaseMocks.ensureAnonymousUser,
  getHistoryLeaderboard: supabaseMocks.getHistoryLeaderboard,
  getTodayLeaderboard: supabaseMocks.getTodayLeaderboard,
  isSupabaseConfigured: true,
  resumeDailyRun: supabaseMocks.resumeDailyRun,
  restartDailyRun: supabaseMocks.restartDailyRun,
  saveProfile: supabaseMocks.saveProfile,
  startDailyRun: supabaseMocks.startDailyRun,
  submitDailySolution: supabaseMocks.submitDailySolution,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, "requestAnimationFrame", {
  configurable: true,
  value: (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  },
});
HTMLElement.prototype.scrollIntoView = vi.fn();

const renderApp = async () => {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);

  await act(async () => {
    root.render(<App />);
  });

  return { element, root };
};

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const clickButton = async (element: HTMLElement, text: string) => {
  const button = Array.from(element.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );

  expect(button, `button containing "${text}"`).toBeTruthy();

  await act(async () => {
    button?.click();
  });
};

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    supabaseMocks.ensureAnonymousUser.mockResolvedValue({ id: "user-1" });
    supabaseMocks.getHistoryLeaderboard.mockResolvedValue([]);
    supabaseMocks.getTodayLeaderboard.mockResolvedValue([]);
    supabaseMocks.resumeDailyRun.mockResolvedValue(null);
    supabaseMocks.restartDailyRun.mockResolvedValue(createRun());
    supabaseMocks.saveProfile.mockResolvedValue({});
    supabaseMocks.startDailyRun.mockResolvedValue(createRun());
    supabaseMocks.submitDailySolution.mockResolvedValue(createRun(1));
  });

  it("renders the playable shell", async () => {
    const { element, root } = await renderApp();
    await flushEffects();

    expect(element.textContent).toContain("24 点竞技场");
    expect(element.textContent).toContain("排行榜");

    await act(async () => {
      root.unmount();
    });
  });

  it("can switch from practice back to the current daily run", async () => {
    supabaseMocks.resumeDailyRun.mockResolvedValue(createRun(2));
    const { element, root } = await renderApp();
    await flushEffects();

    expect(element.textContent).toContain("今日固定赛");
    expect(element.textContent).toContain("2/10 题");
    expect(
      element
        .querySelector('[role="progressbar"][aria-label="今日赛完成进度"]')
        ?.getAttribute("aria-valuenow"),
    ).toBe("20");

    await clickButton(element, "练习");

    expect(element.textContent).toContain("练习场");
    expect(element.textContent).toContain("回正式赛");

    await clickButton(element, "回正式赛");

    expect(element.textContent).toContain("今日固定赛");
    expect(element.textContent).toContain("2/10 题");

    await act(async () => {
      root.unmount();
    });
  });

  it("enters practice without skipping the first puzzle and labels later skips clearly", async () => {
    const { element, root } = await renderApp();
    await flushEffects();

    await clickButton(element, "练习");

    expect(element.textContent).toContain("第 1 题");
    expect(element.textContent).toContain("1  ·  3  ·  4  ·  6");
    expect(element.textContent).toContain("换一题");

    await clickButton(element, "换一题");

    expect(element.textContent).toContain("第 2 题");
    expect(element.textContent).toContain("2  ·  3  ·  8  ·  8");

    await act(async () => {
      root.unmount();
    });
  });

  it("shows staged guidance and readable equations", async () => {
    const { element, root } = await renderApp();
    await flushEffects();
    await clickButton(element, "练习");

    expect(element.textContent).toContain("先选择第一个数字。");

    const clickByAriaLabel = async (label: string) => {
      const button = element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(button, `button labelled "${label}"`).toBeTruthy();
      await act(async () => {
        button?.click();
      });
    };

    await clickByAriaLabel("数字 3，第 2 张，算式 3");
    expect(element.textContent).toContain("现在选择运算符");

    await clickButton(element, "÷");
    expect(element.textContent).toContain("现在选择第二个数字");

    await clickByAriaLabel("数字 4，第 3 张，算式 4");
    expect(element.textContent).toContain("3 ÷ 4 = 3/4");

    await act(async () => {
      root.unmount();
    });
  });

  it("can restart an active daily run from the daily board", async () => {
    supabaseMocks.resumeDailyRun.mockResolvedValue(createRun(3));
    supabaseMocks.restartDailyRun.mockResolvedValue(createRun(0));
    const { element, root } = await renderApp();
    await flushEffects();

    expect(element.textContent).toContain("3/10 题");

    await clickButton(element, "重开");

    expect(document.body.textContent).toContain("重新开始正式赛？");

    await clickButton(document.body, "重新开始");
    await flushEffects();

    expect(supabaseMocks.restartDailyRun).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain("0/10 题");
    expect(element.textContent).toContain("正式赛已重新开始。");

    await act(async () => {
      root.unmount();
    });
  });

  it("closes the finish dialog and focuses the leaderboard", async () => {
    supabaseMocks.resumeDailyRun.mockResolvedValue({
      ...createRun(10),
      completed_at: "2026-07-01T00:05:00.000Z",
      score_ms: 300_000,
    });
    const { element, root } = await renderApp();
    await flushEffects();

    expect(document.body.textContent).toContain("今日赛完成");

    await clickButton(document.body, "查看榜单");

    const leaderboard = element.querySelector<HTMLElement>(
      'aside[aria-labelledby="leaderboard-heading"]',
    );
    expect(document.body.textContent).not.toContain("今日赛完成");
    expect(leaderboard?.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    await act(async () => {
      root.unmount();
    });
  });
});
