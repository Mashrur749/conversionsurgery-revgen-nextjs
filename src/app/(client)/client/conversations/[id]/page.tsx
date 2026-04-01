import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Backward-compatible redirect: old /client/conversations/[id] URLs
 * now resolve to the split-pane shell with ?lead= param.
 */
export default async function ConversationDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/client/conversations?lead=${encodeURIComponent(id)}`);
}
