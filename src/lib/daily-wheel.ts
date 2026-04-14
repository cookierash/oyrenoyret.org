export const DAILY_WHEEL_REWARDS = [0, 1, 3, 5, 10] as const;
export type DailyWheelReward = (typeof DAILY_WHEEL_REWARDS)[number];

// Weighted probabilities (visual sectors are equal; selection is weighted).
// 0 is most likely, 10 is least likely.
export const DAILY_WHEEL_WEIGHTS = [50, 25, 15, 8, 2] as const;

export function pickDailyWheelReward(random: () => number = Math.random): DailyWheelReward {
  const total = DAILY_WHEEL_WEIGHTS.reduce((acc, weight) => acc + weight, 0);
  const r = random() * total;
  let cursor = 0;
  for (let i = 0; i < DAILY_WHEEL_WEIGHTS.length; i += 1) {
    cursor += DAILY_WHEEL_WEIGHTS[i]!;
    if (r < cursor) return DAILY_WHEEL_REWARDS[i]!;
  }
  return DAILY_WHEEL_REWARDS[DAILY_WHEEL_REWARDS.length - 1]!;
}

export function getDailyWheelSegmentIndex(reward: DailyWheelReward): number {
  const idx = DAILY_WHEEL_REWARDS.indexOf(reward);
  return idx < 0 ? 0 : idx;
}

