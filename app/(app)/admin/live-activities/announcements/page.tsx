import { permanentRedirect } from 'next/navigation';

export default function LegacyAdminAnnouncementsPage() {
  permanentRedirect('/admin/events/announcements');
}

