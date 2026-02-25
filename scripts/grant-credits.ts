/**
 * Grant credits to a user by email.
 * Run: npx tsx scripts/grant-credits.ts <email> <amount>
 * Example: npx tsx scripts/grant-credits.ts devrashad29@outlook.com 10
 */

import 'dotenv/config';
import { prisma } from '../src/db/client';
import { roundCredits } from '../src/modules/credits';

async function main() {
  const email = process.argv[2];
  const amount = parseFloat(process.argv[3] ?? '0');

  if (!email || amount <= 0) {
    console.error('Usage: npx tsx scripts/grant-credits.ts <email> <amount>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, credits: true },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const amountRounded = roundCredits(amount);
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { credits: { increment: amountRounded } },
      select: { credits: true },
    });
    await tx.creditTransaction.create({
      data: {
        userId: user.id,
        amount: amountRounded,
        balanceAfter: updated.credits,
        type: 'SPECIAL_EVENT',
        metadata: { reason: 'manual_grant', grantedBy: 'script' },
      },
    });
    return updated.credits;
  });

  console.log(`Granted ${amountRounded} credits to ${email}`);
  console.log(`New balance: ${roundCredits(result)}`);
}

main()
  .catch((err) => {
    if (err?.code === 'ECONNREFUSED') {
      console.error(
        'Database connection refused. Ensure PostgreSQL is running and DATABASE_URL in .env is correct.'
      );
    }
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
