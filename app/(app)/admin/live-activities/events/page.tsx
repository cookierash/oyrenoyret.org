import { redirect } from 'next/navigation';

export default function LegacyAdminEventsPage() {
  redirect('/admin/interactive-sessions/events');
}

