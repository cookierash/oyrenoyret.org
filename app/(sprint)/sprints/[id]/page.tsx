/**
 * Legacy Problem Sprint Workspace Route
 *
 * Redirects to /cms/sprint/[id].
 */

import { redirect } from 'next/navigation';

export default async function SprintWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/cms/sprint/${id}`);
}
