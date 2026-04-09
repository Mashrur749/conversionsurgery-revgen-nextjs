import { redirect } from 'next/navigation';

/** Roles page — now a tab within Team. Redirect for bookmarks/deep links. */
export default function RolesPage() {
  redirect('/admin/team?tab=roles');
}
