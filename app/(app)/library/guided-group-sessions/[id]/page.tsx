import { redirect } from 'next/navigation';

export default async function LibraryGuidedGroupSessionRoomRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/my-library/guided-group-sessions/${id}`);
}

