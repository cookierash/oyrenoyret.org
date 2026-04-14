/**
 * Legacy Problem Sprints Admin Page
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyInteractiveSessionsProblemSprintsAdminPage() {
  permanentRedirect('/admin/events?tab=sprints');
}
