/**
 * Credits Module Types
 */

import type { CreditTransactionType } from '@prisma/client';

export type { CreditTransactionType };

export interface CreditResult {
  success: boolean;
  amount: number;
  balanceAfter: number;
  transactionId?: string;
  error?: string;
}

export interface MaterialCreditParams {
  materialType: 'TEXTUAL' | 'PRACTICE_TEST';
  questionCount?: number;
  wordCount?: number;
  alignmentScore?: number;
}
