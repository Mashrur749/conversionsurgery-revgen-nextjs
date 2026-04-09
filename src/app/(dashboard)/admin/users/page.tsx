import { redirect } from 'next/navigation';

/** Users page — now a tab within Team. Redirect for bookmarks/deep links. */
export default function UsersPage() {
  redirect('/admin/team?tab=users');
}
