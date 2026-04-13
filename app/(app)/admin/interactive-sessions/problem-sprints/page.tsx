/**
 * Legacy Problem Sprints Admin Page
 */

import { redirect } from 'next/navigation';

export default async function ProblemSprintsAdminPage() {
  redirect('/admin/interactive-sessions?tab=sprints');
}
