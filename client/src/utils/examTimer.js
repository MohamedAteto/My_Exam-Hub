export function getExamTimeRemainingSeconds(durationMinutes, endDate, now = new Date()) {
  const requestedDuration = Number(durationMinutes);
  const durationSeconds = Number.isFinite(requestedDuration) && requestedDuration > 0
    ? Math.floor(requestedDuration * 60)
    : 60 * 60;
  const deadline = endDate ? new Date(endDate).getTime() : Number.NaN;

  if (!Number.isFinite(deadline)) return durationSeconds;
  return Math.min(durationSeconds, Math.max(0, Math.floor((deadline - now.getTime()) / 1000)));
}