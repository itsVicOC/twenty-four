export const DAILY_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

export const pointsForRank = (rank: number) => {
  if (rank < 1) return 0;
  return DAILY_POINTS[rank - 1] ?? 1;
};

export const formatDuration = (valueMs: number | null | undefined) => {
  if (valueMs === null || valueMs === undefined || !Number.isFinite(valueMs)) {
    return "--";
  }

  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((Math.max(0, valueMs) % 1000) / 100);

  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
};

export const formatDate = (isoDate: string | null | undefined) => {
  if (!isoDate) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
};
