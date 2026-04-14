import { permanentRedirect } from 'next/navigation';

export default function LegacyAdminProblemSprintsPage() {
  permanentRedirect('/admin/events/problem-sprints');
}

