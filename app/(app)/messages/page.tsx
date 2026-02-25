/**
 * Messages Page
 *
 * Lists credit transactions: usage (spending) and gain (earning).
 */

import { redirect } from 'next/navigation';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { roundCredits } from '@/src/modules/credits';
import type { CreditTransactionType } from '@prisma/client';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const TRANSACTION_LABELS: Record<CreditTransactionType, string> = {
  REGISTRATION: 'Registration bonus',
  MATERIAL_PUBLISH: 'Material published',
  MATERIAL_PASSIVE: 'Earned from material unlock',
  MATERIAL_UNLOCK: 'Unlocked material',
  DISCUSSION_CREATE: 'Created discussion',
  DISCUSSION_HELP: 'Helpful reply reward',
  GROUP_SESSION_PARTICIPATE: 'Group session participation',
  GROUP_SESSION_FACILITATE: 'Group session facilitation',
  SPRINT_ENTRY: 'Sprint entry',
  SPRINT_PAYOUT: 'Sprint payout',
  SPECIAL_EVENT: 'Special event',
};

export default async function MessagesPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      amount: true,
      balanceAfter: true,
      type: true,
      createdAt: true,
      metadata: true,
    },
  });

  return (
    <DashboardShell>
      <PageHeader
        title="Messages"
        description="Your credit usage and earnings history."
      />

      <main className="space-y-4">
        {transactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No credit activity yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Earn credits by publishing materials, helping in discussions, and more.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {transactions.map((tx) => {
                  const isGain = tx.amount > 0;
                  const absAmount = Math.abs(tx.amount);
                  const label = TRANSACTION_LABELS[tx.type];
                  return (
                    <li
                      key={tx.id}
                      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          isGain ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                        }`}
                      >
                        {isGain ? (
                          <ArrowDownCircle className="h-4 w-4" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`text-sm font-medium ${
                            isGain ? 'text-success' : 'text-destructive'
                          }`}
                        >
                          {isGain ? '+' : '−'}
                          {roundCredits(absAmount).toFixed(2)} credits
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          Balance: {roundCredits(tx.balanceAfter).toFixed(2)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>
    </DashboardShell>
  );
}
