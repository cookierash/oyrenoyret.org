import 'dotenv/config';
import { prisma } from '@/src/db/client';
import { generatePublicId } from '@/src/lib/public-id';

async function main() {
  const users = await prisma.user.findMany({
    where: { publicId: null, deletedAt: null },
    select: { id: true },
  });

  let updated = 0;

  for (const user of users) {
    let success = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generatePublicId();
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { publicId: candidate },
        });
        success = true;
        updated += 1;
        break;
      } catch (error) {
        const isUnique =
          error instanceof Error &&
          'code' in error &&
          (error as { code?: string }).code === 'P2002';
        if (!isUnique) throw error;
      }
    }
    if (!success) {
      console.warn(`Failed to assign publicId for user ${user.id}`);
    }
  }

  console.log(`Updated ${updated} users.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
