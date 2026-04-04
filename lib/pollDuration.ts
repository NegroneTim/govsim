/** Serialize duration for API; supports legacy polls without durationSeconds. */
export function getPollDurationSeconds(poll: {
  durationSeconds?: number;
  startedAt: Date;
  endsAt: Date;
}): number {
  if (typeof poll.durationSeconds === "number" && poll.durationSeconds > 0) {
    return poll.durationSeconds;
  }
  const ms = new Date(poll.endsAt).getTime() - new Date(poll.startedAt).getTime();
  return Math.max(1, Math.round(ms / 1000));
}
