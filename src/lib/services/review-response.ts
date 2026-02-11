import { getDb } from '@/db';
import {
  reviews,
  reviewResponses,
  responseTemplates,
  clients,
  knowledgeBase,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { Review } from '@/db/schema/reviews';
import type { ReviewResponse } from '@/db/schema/review-responses';
import type { ResponseTemplate } from '@/db/schema/response-templates';
import type { Client } from '@/db/schema/clients';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/** Options for AI review response generation. */
interface ResponseGenerationOptions {
  reviewId: string;
  tone?: 'professional' | 'friendly' | 'apologetic' | 'thankful';
  includeOffer?: boolean;
  maxLength?: number;
}

/**
 * Generate an AI response for a review, using the client's knowledge base
 * for business-specific context and tone adjustments.
 *
 * @param options - Generation options including review ID, tone, and length constraints
 * @returns The generated response text
 * @throws Error if the review is not found
 */
export async function generateReviewResponse(
  options: ResponseGenerationOptions
): Promise<string> {
  const { reviewId, tone = 'professional', includeOffer = true, maxLength = 200 } = options;

  const db = getDb();

  // Get review details
  const [review]: Review[] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) throw new Error(`[Reputation] Review not found: ${reviewId}`);

  // Get client info for context
  const [client]: Client[] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, review.clientId))
    .limit(1);

  // Get knowledge base for business context
  let businessContext = '';
  if (client) {
    const knowledge = await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.clientId, client.id));

    businessContext = knowledge
      .map((k) => `${k.title}: ${k.content}`)
      .join('\n');
  }

  // Build prompt based on rating and tone
  const isNegative = review.rating <= 2;
  const isNeutral = review.rating === 3;

  let toneInstructions = '';
  switch (tone) {
    case 'friendly':
      toneInstructions = 'Be warm, conversational, and genuine. Use a friendly tone.';
      break;
    case 'apologetic':
      toneInstructions = 'Lead with a sincere apology. Be empathetic and take responsibility.';
      break;
    case 'thankful':
      toneInstructions = 'Express genuine gratitude. Be enthusiastic but professional.';
      break;
    default:
      toneInstructions = 'Be professional and courteous. Maintain a business-appropriate tone.';
  }

  let contentInstructions = '';
  if (isNegative) {
    contentInstructions = `
This is a negative review. Your response should:
1. Acknowledge their specific concerns
2. Apologize sincerely (without being defensive)
3. ${includeOffer ? 'Offer to make it right - invite them to contact you directly' : 'Express commitment to improvement'}
4. Keep it under ${maxLength} words
5. End with owner's name if available`;
  } else if (isNeutral) {
    contentInstructions = `
This is a 3-star review. Your response should:
1. Thank them for their feedback
2. Acknowledge any concerns mentioned
3. Highlight what you're doing to improve
4. Invite them to give you another try
5. Keep it under ${Math.round(maxLength * 0.75)} words`;
  } else {
    contentInstructions = `
This is a positive review. Your response should:
1. Express genuine gratitude
2. Reference something specific from their review if possible
3. Invite them back / mention you look forward to working with them again
4. Keep it short and sweet - under ${Math.round(maxLength * 0.5)} words`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You write review responses for ${client?.businessName || 'a contractor business'}.

${toneInstructions}

Business context:
${businessContext || 'General contractor services'}

CRITICAL:
- Never use phrases like "We apologize for any inconvenience" - be specific
- Never be defensive or make excuses
- Be authentic and human
- Don't use excessive exclamation points
- Sign with the owner's name: ${client?.ownerName || 'The Team'}`,
      },
      {
        role: 'user',
        content: `${contentInstructions}

Review from ${review.authorName || 'a customer'} (${review.rating} stars):
"${review.reviewText || 'No text provided'}"`,
      },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  return response.choices[0].message.content || '';
}

/**
 * Find the best matching response template for a review based on rating
 * range and keyword overlap scoring.
 *
 * @param clientId - The UUID of the client owning the templates
 * @param rating - The review's star rating (1-5)
 * @param reviewText - The review body text for keyword matching
 * @returns The highest-scoring active template, or null if none match
 */
export async function findMatchingTemplate(
  clientId: string,
  rating: number,
  reviewText: string
): Promise<ResponseTemplate | null> {
  const db = getDb();

  // Get all active templates for client
  const templates = await db
    .select()
    .from(responseTemplates)
    .where(
      and(
        eq(responseTemplates.clientId, clientId),
        eq(responseTemplates.isActive, true)
      )
    );

  // Score each template
  const scored = templates.map((template) => {
    let score = 0;

    // Rating match
    if (template.minRating && rating >= template.minRating) score += 10;
    if (template.maxRating && rating <= template.maxRating) score += 10;

    // Keyword match
    if (template.keywords && reviewText) {
      const lowerText = reviewText.toLowerCase();
      const matchedKeywords = (template.keywords as string[]).filter((kw) =>
        lowerText.includes(kw.toLowerCase())
      );
      score += matchedKeywords.length * 5;
    }

    return { template, score };
  });

  // Return highest scoring template (if any score > 0)
  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? best.template : null;
}

/**
 * Apply variable substitution to a template string.
 * Replaces `{{key}}` placeholders with the corresponding values.
 *
 * @param templateText - The template text containing `{{variable}}` placeholders
 * @param variables - Key-value pairs to substitute into the template
 * @returns The template text with all matched variables replaced
 */
export function applyTemplate(
  templateText: string,
  variables: Record<string, string>
): string {
  let result = templateText;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return result;
}

/**
 * Create a draft response for a review, first attempting template matching
 * and falling back to AI generation.
 *
 * @param reviewId - The UUID of the review to respond to
 * @param options - Optional controls for template use and tone
 * @returns The newly created draft review response
 * @throws Error if the review is not found
 */
export async function createDraftResponse(
  reviewId: string,
  options: { useTemplate?: boolean; templateId?: string; tone?: string } = {}
): Promise<ReviewResponse> {
  const { useTemplate = true, tone } = options;

  const db = getDb();

  // Get review
  const [review]: Review[] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) throw new Error(`[Reputation] Review not found: ${reviewId}`);

  let responseText: string | undefined;
  let responseType: 'ai_generated' | 'template' | 'custom' = 'ai_generated';
  let usedTemplateId: string | null = null;

  // Try template first
  if (useTemplate) {
    const template = await findMatchingTemplate(
      review.clientId,
      review.rating,
      review.reviewText || ''
    );

    if (template) {
      const [client]: Client[] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, review.clientId))
        .limit(1);

      responseText = applyTemplate(template.templateText, {
        customer_name: review.authorName || 'Valued Customer',
        business_name: client?.businessName || 'our team',
        owner_name: client?.ownerName || 'The Team',
      });
      responseType = 'template';
      usedTemplateId = template.id;

      // Update template usage
      await db
        .update(responseTemplates)
        .set({
          usageCount: (template.usageCount || 0) + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(responseTemplates.id, template.id));
    }
  }

  // Fall back to AI generation
  if (!responseText) {
    responseText = await generateReviewResponse({
      reviewId,
      tone: (tone as 'professional' | 'friendly' | 'apologetic' | 'thankful') || 'professional',
    });
  }

  // Save draft
  const [draft] = await db
    .insert(reviewResponses)
    .values({
      reviewId,
      clientId: review.clientId,
      responseText,
      responseType,
      templateId: usedTemplateId,
      status: 'draft',
    })
    .returning();

  return draft;
}

/**
 * Regenerate a review response with different parameters (tone, length, or
 * custom instructions). Updates the existing response record in-place.
 *
 * @param responseId - The UUID of the existing review response to regenerate
 * @param options - Regeneration controls: tone, shorter flag, or custom instructions
 * @returns The regenerated response text
 * @throws Error if the response is not found
 */
export async function regenerateResponse(
  responseId: string,
  options: { tone?: string; shorter?: boolean; custom?: string }
): Promise<string> {
  const db = getDb();

  const [existingResponse]: ReviewResponse[] = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.id, responseId))
    .limit(1);

  if (!existingResponse) throw new Error(`[Reputation] Response not found: ${responseId}`);

  const { tone = 'professional', shorter = false, custom } = options;

  if (custom) {
    // User provided custom instructions
    const [review]: Review[] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, existingResponse.reviewId))
      .limit(1);

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You write review responses. Follow the user instructions exactly.',
        },
        {
          role: 'user',
          content: `Rewrite this response with the following changes: ${custom}

Current response:
"${existingResponse.responseText}"

Original review (${review?.rating} stars):
"${review?.reviewText || 'No text'}"`,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const newText = aiResponse.choices[0].message.content || existingResponse.responseText;

    await db
      .update(reviewResponses)
      .set({ responseText: newText, updatedAt: new Date() })
      .where(eq(reviewResponses.id, responseId));

    return newText;
  }

  // Generate new response with different tone
  const newText = await generateReviewResponse({
    reviewId: existingResponse.reviewId,
    tone: tone as 'professional' | 'friendly' | 'apologetic' | 'thankful',
    maxLength: shorter ? 100 : 200,
  });

  await db
    .update(reviewResponses)
    .set({ responseText: newText, updatedAt: new Date() })
    .where(eq(reviewResponses.id, responseId));

  return newText;
}
