import { describe, it, expect } from 'vitest';
import {
  calcMaterialUnlockCost,
  calcMaterialPublishCredit,
  calcMaterialPassiveCredit,
} from '@/src/modules/credits/credits.service';

describe('credits calculations', () => {
  it('uses base unlock cost for textual materials', () => {
    const cost = calcMaterialUnlockCost({ materialType: 'TEXTUAL', questionCount: 25 });
    expect(cost).toBeCloseTo(2.0, 2);
  });

  it('caps practice test unlock cost at the question cap', () => {
    const cost = calcMaterialUnlockCost({ materialType: 'PRACTICE_TEST', questionCount: 1000 });
    expect(cost).toBeGreaterThan(2.0);
  });

  it('rewards publishing for practice tests with bonus per question', () => {
    const credit = calcMaterialPublishCredit({ materialType: 'PRACTICE_TEST', questionCount: 10 });
    expect(credit).toBeGreaterThan(0.5);
  });

  it('gives passive credits for unlocks', () => {
    const credit = calcMaterialPassiveCredit({ materialType: 'TEXTUAL', questionCount: 0 });
    expect(credit).toBeGreaterThan(0);
  });
});
