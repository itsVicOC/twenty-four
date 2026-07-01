import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Dumbbell,
  Medal,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Timer,
  Trophy,
  Undo2,
  UserRound,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Progress } from "./components/ui/progress";
import { Separator } from "./components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { cn } from "./lib/utils";
import {
  createInitialTiles,
  displayOperator,
  formatFraction,
  getPracticePuzzle,
  isTarget,
  replaySteps,
  serializeSteps,
  type Operator,
  type SolutionStep,
  type Tile,
} from "./lib/twenty-four";
import {
  ensureAnonymousUser,
  getHistoryLeaderboard,
  getTodayLeaderboard,
  isSupabaseConfigured,
  resumeDailyRun,
  saveProfile,
  startDailyRun,
  submitDailySolution,
  type DailyPuzzle,
  type HistoryLeaderboardRow,
  type RunState,
  type TodayLeaderboardRow,
} from "./lib/supabase";
import { formatDate, formatDuration } from "./lib/leaderboard";

type GameMode = "daily" | "practice";

const NICKNAME_KEY = "twenty_four_nickname";

const operatorOptions: Operator[] = ["+", "-", "*", "/"];

const defaultNickname = () => {
  const stored = window.localStorage.getItem(NICKNAME_KEY);
  if (stored) return stored;
  return `选手${Math.floor(1000 + Math.random() * 9000)}`;
};

const findFirstUnsolvedIndex = (run: RunState) => {
  const index = run.puzzles.findIndex((puzzle) => !puzzle.solved);
  return index === -1 ? Math.max(0, run.puzzles.length - 1) : index;
};

const normalizeSupabaseError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "操作失败";
};

function App() {
  const [mode, setMode] = useState<GameMode>("daily");
  const [nickname, setNickname] = useState(defaultNickname);
  const [run, setRun] = useState<RunState | null>(null);
  const [activePuzzleIndex, setActivePuzzleIndex] = useState(0);
  const [practiceSeed, setPracticeSeed] = useState(0);
  const [practiceSolved, setPracticeSolved] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [steps, setSteps] = useState<SolutionStep[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [pendingOp, setPendingOp] = useState<Operator | null>(null);
  const [todayRows, setTodayRows] = useState<TodayLeaderboardRow[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryLeaderboardRow[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [notice, setNotice] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [finishOpen, setFinishOpen] = useState(false);
  const [bootNickname] = useState(nickname);

  const dailySolvedCount = run?.puzzles.filter((puzzle) => puzzle.solved).length ?? 0;
  const totalDailyPuzzles = run?.puzzles.length ?? 10;
  const dailyProgress = (dailySolvedCount / totalDailyPuzzles) * 100;

  const practicePuzzle: DailyPuzzle = useMemo(
    () => ({
      puzzle_index: practiceSeed + 1,
      numbers: getPracticePuzzle(practiceSeed),
      solved: false,
    }),
    [practiceSeed],
  );

  const activePuzzle = mode === "daily" ? run?.puzzles[activePuzzleIndex] : practicePuzzle;
  const canSubmit = tiles.length === 1 && steps.length === 3 && isTarget(tiles[0]);
  const selectedTile = selectedTileId
    ? tiles.find((tile) => tile.id === selectedTileId)
    : null;

  const elapsedMs = useMemo(() => {
    if (!run?.started_at) return 0;
    if (run.score_ms !== null) return run.score_ms;
    return Math.max(0, nowMs - new Date(run.started_at).getTime());
  }, [nowMs, run?.score_ms, run?.started_at]);

  const refreshLeaderboards = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const [today, history] = await Promise.all([
      getTodayLeaderboard(),
      getHistoryLeaderboard(),
    ]);
    setTodayRows(today);
    setHistoryRows(history);
  }, []);

  const resetBoard = useCallback((numbers: readonly number[]) => {
    setTiles(createInitialTiles(numbers));
    setSteps([]);
    setSelectedTileId(null);
    setPendingOp(null);
    setNotice("");
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activePuzzle) {
      resetBoard(activePuzzle.numbers);
    }
  }, [activePuzzle, resetBoard]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setNotice("未配置 Supabase，当前可试玩练习模式。");
      setMode("practice");
      return;
    }

    let alive = true;
    const boot = async () => {
      try {
        setIsBusy(true);
        await ensureAnonymousUser();
        await saveProfile(bootNickname.trim());
        const resumed = await resumeDailyRun();
        if (!alive) return;
        if (resumed) {
          setRun(resumed);
          setActivePuzzleIndex(findFirstUnsolvedIndex(resumed));
          setMode("daily");
          if (resumed.completed_at) setFinishOpen(true);
        }
        await refreshLeaderboards();
      } catch (error) {
        if (alive) setNotice(normalizeSupabaseError(error));
      } finally {
        if (alive) setIsBusy(false);
      }
    };

    void boot();
    return () => {
      alive = false;
    };
  }, [bootNickname, refreshLeaderboards]);

  const handleSaveName = async () => {
    const cleaned = nickname.trim().slice(0, 24);
    if (!cleaned) {
      setNotice("昵称不能为空。");
      return;
    }

    setNickname(cleaned);
    window.localStorage.setItem(NICKNAME_KEY, cleaned);
    if (!isSupabaseConfigured) {
      setNotice("昵称已保存在本地。");
      return;
    }

    try {
      setIsSavingName(true);
      await ensureAnonymousUser();
      await saveProfile(cleaned);
      await refreshLeaderboards();
      setNotice("昵称已保存。");
    } catch (error) {
      setNotice(normalizeSupabaseError(error));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleStartDaily = async () => {
    if (!isSupabaseConfigured) {
      setMode("practice");
      setNotice("连接 Supabase 后即可参加今日正式赛。");
      return;
    }

    try {
      setIsBusy(true);
      await ensureAnonymousUser();
      await saveProfile(nickname.trim());
      const nextRun = await startDailyRun();
      setRun(nextRun);
      setMode("daily");
      setActivePuzzleIndex(findFirstUnsolvedIndex(nextRun));
      setFinishOpen(Boolean(nextRun.completed_at));
      await refreshLeaderboards();
      setNotice(nextRun.completed_at ? "今日成绩已完成。" : "今日正式赛已开始。");
    } catch (error) {
      setNotice(normalizeSupabaseError(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handlePractice = () => {
    setMode("practice");
    setPracticeSeed((value) => value + 1);
    setNotice("");
  };

  const handleSelectTile = (tile: Tile) => {
    if (activePuzzle?.solved) return;

    if (!selectedTileId) {
      setSelectedTileId(tile.id);
      return;
    }

    if (selectedTileId === tile.id) {
      setSelectedTileId(null);
      setPendingOp(null);
      return;
    }

    if (!pendingOp) {
      setSelectedTileId(tile.id);
      return;
    }

    const step: SolutionStep = {
      left_id: selectedTileId,
      right_id: tile.id,
      operator_code: pendingOp,
      result_id: `r${steps.length}`,
    };

    try {
      setTiles(replaySteps(activePuzzle?.numbers ?? [], [...steps, step]));
      setSteps((current) => [...current, step]);
      setSelectedTileId(null);
      setPendingOp(null);
      setNotice("");
    } catch (error) {
      setNotice(normalizeSupabaseError(error));
    }
  };

  const handleUndo = () => {
    if (!activePuzzle || steps.length === 0) return;
    const nextSteps = steps.slice(0, -1);
    setSteps(nextSteps);
    setTiles(replaySteps(activePuzzle.numbers, nextSteps));
    setSelectedTileId(null);
    setPendingOp(null);
  };

  const handleReset = () => {
    if (!activePuzzle) return;
    resetBoard(activePuzzle.numbers);
  };

  const handleSubmit = async () => {
    if (!activePuzzle) return;
    if (!canSubmit) {
      setNotice("需要刚好 3 步算到 24。");
      return;
    }

    if (mode === "practice") {
      setPracticeSolved((value) => value + 1);
      setPracticeSeed((value) => value + 1);
      setNotice("练习题完成。");
      return;
    }

    if (!run) return;

    try {
      setIsBusy(true);
      const nextRun = await submitDailySolution(
        run.run_id,
        activePuzzle.puzzle_index,
        serializeSteps(steps),
      );
      setRun(nextRun);
      setActivePuzzleIndex(findFirstUnsolvedIndex(nextRun));
      await refreshLeaderboards();
      const complete = Boolean(nextRun.completed_at);
      setFinishOpen(complete);
      setNotice(complete ? "今日赛完成，成绩已入榜。" : "本题通过。");
    } catch (error) {
      setNotice(normalizeSupabaseError(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="min-h-screen arena-lines">
      <div className="container flex min-h-screen flex-col gap-5 py-5 md:py-6">
        <header className="flex flex-col gap-4 rounded-lg border bg-card/95 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-normal md:text-3xl">
                24 点竞技场
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  数据库裁判
                </Badge>
                <Badge variant="outline" className="gap-1 bg-background">
                  <Timer className="h-3.5 w-3.5" />
                  {formatDuration(elapsedMs)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto] md:w-[360px]">
            <Label className="sr-only" htmlFor="nickname">
              昵称
            </Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="nickname"
                value={nickname}
                maxLength={24}
                onChange={(event) => setNickname(event.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              onClick={handleSaveName}
              disabled={isSavingName}
              title="保存昵称"
            >
              {isSavingName ? (
                <RefreshCw className="animate-spin" />
              ) : (
                <Save />
              )}
              保存
            </Button>
          </div>
        </header>

        {notice ? (
          <div className="rounded-md border bg-card/95 px-4 py-3 text-sm text-muted-foreground shadow-sm">
            {notice}
          </div>
        ) : null}

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-w-0 flex-col gap-5">
            <Card className="overflow-hidden">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {mode === "daily" ? (
                        <Medal className="h-5 w-5 text-primary" />
                      ) : (
                        <Dumbbell className="h-5 w-5 text-primary" />
                      )}
                      {mode === "daily" ? "今日固定赛" : "练习场"}
                    </CardTitle>
                    <CardDescription>
                      {mode === "daily"
                        ? `${dailySolvedCount}/${totalDailyPuzzles} 题`
                        : `已完成 ${practiceSolved} 题`}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={handleStartDaily}
                      disabled={isBusy}
                      className="min-w-32"
                    >
                      {isBusy ? <RefreshCw className="animate-spin" /> : <Play />}
                      正式赛
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePractice}
                      disabled={isBusy}
                    >
                      <Dumbbell />
                      练习
                    </Button>
                  </div>
                </div>
                <Progress value={mode === "daily" ? dailyProgress : 100} />
              </CardHeader>

              <CardContent className="grid gap-5">
                {mode === "daily" && run ? (
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                    {run.puzzles.map((puzzle, index) => (
                      <Button
                        key={puzzle.puzzle_index}
                        type="button"
                        variant={index === activePuzzleIndex ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-9 px-0",
                          puzzle.solved &&
                            index !== activePuzzleIndex &&
                            "border-primary/30 bg-primary/10 text-primary",
                        )}
                        onClick={() => setActivePuzzleIndex(index)}
                      >
                        {puzzle.solved ? <Check className="h-4 w-4" /> : puzzle.puzzle_index}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-lg border bg-background/80 p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        第 {activePuzzle?.puzzle_index ?? 1} 题
                      </p>
                      <p className="text-lg font-semibold">
                        {activePuzzle?.numbers.join("  ·  ") ?? "等待发题"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleUndo}
                        disabled={steps.length === 0 || activePuzzle?.solved}
                        title="撤销"
                      >
                        <Undo2 />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleReset}
                        disabled={!activePuzzle || activePuzzle.solved}
                        title="重来"
                      >
                        <RotateCcw />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {tiles.map((tile) => (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => handleSelectTile(tile)}
                        disabled={activePuzzle?.solved}
                        className={cn(
                          "number-card flex aspect-[4/3] min-h-24 flex-col items-center justify-center rounded-lg border p-3 text-center shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                          selectedTileId === tile.id
                            ? "border-primary bg-primary/10 ring-2 ring-primary"
                            : "hover:border-primary/60",
                        )}
                      >
                        <span className="text-3xl font-bold tracking-normal sm:text-4xl">
                          {formatFraction(tile)}
                        </span>
                        <span className="mt-1 max-w-full truncate text-xs text-muted-foreground">
                          {tile.expr}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {operatorOptions.map((op) => (
                      <Button
                        key={op}
                        type="button"
                        variant={pendingOp === op ? "default" : "outline"}
                        className="h-12 text-xl"
                        disabled={!selectedTile || activePuzzle?.solved}
                        onClick={() => setPendingOp(op)}
                      >
                        {displayOperator(op)}
                      </Button>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="min-h-16 rounded-md border bg-card p-3">
                      {steps.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {selectedTile
                            ? `已选 ${formatFraction(selectedTile)}`
                            : "选择两张数字牌和一个运算符"}
                        </p>
                      ) : (
                        <ol className="grid gap-1 text-sm">
                          {steps.map((step, index) => (
                            <li key={step.result_id} className="flex items-center gap-2">
                              <span className="text-muted-foreground">{index + 1}.</span>
                              <span>
                                {step.left_id} {displayOperator(step.operator_code)}{" "}
                                {step.right_id}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{step.result_id}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleSubmit}
                      disabled={!canSubmit || isBusy || activePuzzle?.solved}
                      className="min-w-36"
                    >
                      {isBusy ? <RefreshCw className="animate-spin" /> : <Send />}
                      提交
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="min-w-0">
            <Card className="sticky top-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  排行榜
                </CardTitle>
                <CardDescription>
                  {isSupabaseConfigured ? "今日成绩和历史积分" : "等待 Supabase 配置"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="today" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="today">今日</TabsTrigger>
                    <TabsTrigger value="history">历史</TabsTrigger>
                  </TabsList>
                  <TabsContent value="today">
                    <LeaderboardTable
                      emptyText="今日还没有完赛成绩"
                      rows={todayRows.map((row) => ({
                        rank: row.rank_position,
                        name: row.nickname,
                        primary: formatDuration(row.score_ms),
                        secondary: formatDate(row.completed_at),
                      }))}
                    />
                  </TabsContent>
                  <TabsContent value="history">
                    <LeaderboardTable
                      emptyText="历史榜还没有积分"
                      rows={historyRows.map((row) => ({
                        rank: row.rank_position,
                        name: row.nickname,
                        primary: `${row.total_points} 分`,
                        secondary: `${row.completed_days} 天 · 最快 ${formatDuration(
                          row.best_score_ms,
                        )}`,
                      }))}
                    />
                  </TabsContent>
                </Tabs>
                <Separator className="my-4" />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void refreshLeaderboards()}
                  disabled={!isSupabaseConfigured || isBusy}
                >
                  <RefreshCw />
                  刷新
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>今日赛完成</DialogTitle>
            <DialogDescription>
              成绩 {formatDuration(run?.score_ms)}，排行榜已按服务器时间更新。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">完成题数</span>
              <span className="font-medium">
                {dailySolvedCount}/{totalDailyPuzzles}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">计时</span>
              <span className="font-medium">{formatDuration(run?.score_ms)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handlePractice}>
              <Dumbbell />
              去练习
            </Button>
            <Button type="button" onClick={() => setFinishOpen(false)}>
              查看榜单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

type TableRow = {
  rank: number;
  name: string;
  primary: string;
  secondary: string;
};

function LeaderboardTable({
  rows,
  emptyText,
}: {
  rows: TableRow[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      {rows.slice(0, 10).map((row, index) => (
        <div
          key={`${row.rank}-${row.name}-${index}`}
          className="grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b bg-card px-3 py-3 last:border-b-0"
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold",
              row.rank <= 3 ? "bg-secondary text-secondary-foreground" : "bg-muted",
            )}
          >
            {row.rank}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.secondary}</p>
          </div>
          <p className="whitespace-nowrap text-sm font-semibold">{row.primary}</p>
        </div>
      ))}
    </div>
  );
}

export default App;
