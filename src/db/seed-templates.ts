import { getDb } from '@/db';
import { responseTemplates } from '@/db/schema';

const defaultTemplates = [
  {
    name: '5-Star Thank You',
    category: 'positive',
    minRating: 5,
    maxRating: 5,
    templateText: `Thank you so much for the wonderful review, {{customer_name}}! We're thrilled that you had a great experience with our team. We truly appreciate you taking the time to share your feedback. Looking forward to working with you again!

- {{owner_name}}`,
  },
  {
    name: '4-Star Appreciation',
    category: 'positive',
    minRating: 4,
    maxRating: 4,
    templateText: `Thank you for the great review, {{customer_name}}! We're glad you were happy with our work. If there's anything we could have done to earn that 5th star, we'd love to hear about it. Thanks again for choosing {{business_name}}!

- {{owner_name}}`,
  },
  {
    name: '3-Star Follow Up',
    category: 'neutral',
    minRating: 3,
    maxRating: 3,
    templateText: `Thank you for your feedback, {{customer_name}}. We appreciate you sharing your experience. We're always looking to improve, and we'd love to hear more about how we could have better served you. Please feel free to reach out to us directly.

- {{owner_name}}`,
  },
  {
    name: 'Negative Review - Quality Issue',
    category: 'negative',
    maxRating: 2,
    keywords: ['quality', 'poor', 'bad work', 'terrible', 'disappointed'],
    templateText: `{{customer_name}}, I'm truly sorry to hear about your experience. This is not the standard of work we strive for, and I take full responsibility. I would really appreciate the chance to make this right. Please reach out to me directly at your earliest convenience so we can discuss how to resolve this.

Sincerely,
{{owner_name}}`,
  },
  {
    name: 'Negative Review - Communication Issue',
    category: 'negative',
    maxRating: 2,
    keywords: ['communication', 'response', 'call', 'return', 'ignored', 'never heard'],
    templateText: `{{customer_name}}, I sincerely apologize for the communication issues you experienced. There's no excuse for not keeping you informed throughout the process. I've personally reviewed what happened and am implementing changes to ensure this doesn't happen again. I'd like to make this right - please give me a call when you have a moment.

- {{owner_name}}`,
  },
  {
    name: 'Negative Review - Timing/Delays',
    category: 'negative',
    maxRating: 2,
    keywords: ['late', 'delay', 'time', 'schedule', 'waiting', 'took forever'],
    templateText: `{{customer_name}}, I'm sorry about the delays you experienced. I understand how frustrating it is when projects take longer than expected. While there were circumstances we had to navigate, I know we could have communicated better about the timeline. I'd appreciate the opportunity to discuss this with you and see how we can make things right.

- {{owner_name}}`,
  },
];

export async function seedDefaultTemplates(clientId: string) {
  const db = getDb();

  for (const template of defaultTemplates) {
    await db.insert(responseTemplates).values({
      clientId,
      ...template,
      variables: ['customer_name', 'business_name', 'owner_name'],
    });
  }
}
