import { describe, expect, it } from 'vitest';
import { DAILY_WHEEL_REWARDS, getDailyWheelSegmentIndex, pickDailyWheelReward } from '@/src/lib/daily-wheel';

describe('daily wheel reward picker', () => {
  it('picks a reward from the allowed set', () => {
    const reward = pickDailyWheelReward(() => 0.123);
    expect(DAILY_WHEEL_REWARDS).toContain(reward);
  });

  it('maps rewards to stable segment indices', () => {
    expect(getDailyWheelSegmentIndex(0)).toBe(0);
    expect(getDailyWheelSegmentIndex(10)).toBe(4);
  });
});

