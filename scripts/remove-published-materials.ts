/**
 * Remove all published materials (soft delete).
 * Run: npx tsx scripts/remove-published-materials.ts
 */

import { prisma } from '../src/db/client';

async function main() {
  const result = await prisma.material.updateMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });

  console.log(`Soft-deleted ${result.count} published materials`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
