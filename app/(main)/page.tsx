import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';

export default async function HomePage() {
  const userId = await getCurrentSession();
  if (userId) {
    redirect('/dashboard');
  }
  return <main className="min-h-screen" />;
}
