import { getDb } from '@/db';
import { emailTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Render an email template by slug, with {{variable}} interpolation.
 * Falls back to null if no DB template found (caller uses hardcoded fallback).
 */
export async function renderTemplate(
  slug: string,
  variables: Record<string, string>
): Promise<{ subject: string; html: string } | null> {
  const db = getDb();

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.slug, slug))
    .limit(1);

  if (!template) return null;

  let subject = template.subject;
  let html = template.htmlBody;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  }

  return { subject, html };
}
