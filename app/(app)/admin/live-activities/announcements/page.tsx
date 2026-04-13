import { redirect } from 'next/navigation';

export default function LegacyAdminAnnouncementsPage() {
  redirect('/admin/interactive-sessions/announcements');
}

