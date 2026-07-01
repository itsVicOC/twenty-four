import { createClient } from "@supabase/supabase-js";
import type { SolutionStep } from "./twenty-four";

export type DailyPuzzle = {
  puzzle_index: number;
  numbers: [number, number, number, number];
  solved: boolean;
};

export type RunState = {
  run_id: string;
  event_date: string;
  started_at: string;
  completed_at: string | null;
  score_ms: number | null;
  puzzles: DailyPuzzle[];
};

export type TodayLeaderboardRow = {
  rank_position: number;
  nickname: string;
  score_ms: number;
  completed_at: string;
};

export type HistoryLeaderboardRow = {
  rank_position: number;
  nickname: string;
  total_points: number;
  completed_days: number;
  best_score_ms: number;
  last_completed_at: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  supabaseUrl.startsWith("https://") && supabaseAnonKey.length > 20;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : null;

export const ensureAnonymousUser = async () => {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in returned no user");
  return data.user;
};

export const saveProfile = async (nickname: string) => {
  if (!supabase) throw new Error("Supabase is not configured");

  const { error } = await supabase.rpc("set_profile", {
    p_nickname: nickname,
  });
  if (error) throw error;
};

export const startDailyRun = async () => {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.rpc("start_daily_run");
  if (error) throw error;
  return data as RunState;
};

export const resumeDailyRun = async () => {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.rpc("resume_daily_run");
  if (error) throw error;
  return data as RunState | null;
};

export const submitDailySolution = async (
  runId: string,
  puzzleIndex: number,
  steps: readonly SolutionStep[],
) => {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.rpc("submit_solution", {
    p_run_id: runId,
    p_puzzle_index: puzzleIndex,
    p_steps: steps,
  });
  if (error) throw error;
  return data as RunState;
};

export const getTodayLeaderboard = async () => {
  if (!supabase) return [] satisfies TodayLeaderboardRow[];

  const { data, error } = await supabase.rpc("get_today_leaderboard");
  if (error) throw error;
  return (data ?? []) as TodayLeaderboardRow[];
};

export const getHistoryLeaderboard = async () => {
  if (!supabase) return [] satisfies HistoryLeaderboardRow[];

  const { data, error } = await supabase.rpc("get_history_leaderboard");
  if (error) throw error;
  return (data ?? []) as HistoryLeaderboardRow[];
};
