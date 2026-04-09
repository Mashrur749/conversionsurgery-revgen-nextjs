import { redirect } from 'next/navigation';

/**
 * Template Performance page — merged into Flow Analytics.
 * Redirect to preserve bookmarks and deep links.
 */
export default function TemplatePerformancePage() {
  redirect('/admin/analytics?view=variants');
}
