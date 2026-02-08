# Phase 19b: Review Response AI

## Prerequisites
- Phase 19a (Reputation Monitoring) complete
- Reviews table with AI suggested responses
- Google Business Profile API access

## Goal
AI-powered review response system with one-click posting to Google, response templates, and approval workflows.

---

## Step 1: Add Response Management Fields

**MODIFY** `src/lib/db/schema.ts`:

```typescript
// Add to reviews table or create new table
export const reviewResponses = pgTable('review_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').references(() => reviews.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  
  // Response content
  responseText: text('response_text').notNull(),
  responseType: varchar('response_type', { length: 20 }).default('ai_generated'), // ai_generated, template, custom
  templateId: uuid('template_id').references(() => responseTemplates.id),
  
  // Status
  status: varchar('status', { length: 20 }).default('draft'), // draft, pending_approval, approved, posted, rejected
  
  // Approval workflow
  submittedAt: timestamp('submitted_at'),
  submittedBy: uuid('submitted_by'),
  approvedAt: timestamp('approved_at'),
  approvedBy: uuid('approved_by'),
  rejectionReason: text('rejection_reason'),
  
  // Posting
  postedAt: timestamp('posted_at'),
  postError: text('post_error'),
  
  // Tracking
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const responseTemplates = pgTable('response_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  
  // Template info
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }), // positive, neutral, negative, specific_complaint
  
  // Content
  templateText: text('template_text').notNull(),
  variables: jsonb('variables').$type<string[]>(), // e.g., ['customer_name', 'business_name']
  
  // Settings
  minRating: integer('min_rating'), // Use for rating >= this
  maxRating: integer('max_rating'), // Use for rating <= this
  keywords: jsonb('keywords').$type<string[]>(), // Match if review contains these
  
  // Usage tracking
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
```

Run migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 2: Create Response Generation Service

**CREATE** `src/lib/services/review-response.ts`:

```typescript
import { db } from '@/lib/db';
import { 
  reviews, 
  reviewResponses, 
  responseTemplates, 
  clients,
  knowledgeBase // from Phase 15
} from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ResponseGenerationOptions {
  reviewId: string;
  tone?: 'professional' | 'friendly' | 'apologetic' | 'thankful';
  includeOffer?: boolean; // Offer to make it right
  maxLength?: number;
}

/**
 * Generate AI response for a review
 */
export async function generateReviewResponse(
  options: ResponseGenerationOptions
): Promise<string> {
  const { reviewId, tone = 'professional', includeOffer = true, maxLength = 200 } = options;
  
  // Get review details
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  
  if (!review) throw new Error('Review not found');
  
  // Get client info for context
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, review.clientId!))
    .limit(1);
  
  // Get knowledge base for business context
  let businessContext = '';
  if (client) {
    const knowledge = await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.clientId, client.id));
    
    businessContext = knowledge
      .map(k => `${k.category}: ${k.content}`)
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
 * Find matching template for a review
 */
export async function findMatchingTemplate(
  clientId: string,
  rating: number,
  reviewText: string
): Promise<typeof responseTemplates.$inferSelect | null> {
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
  const scored = templates.map(template => {
    let score = 0;
    
    // Rating match
    if (template.minRating && rating >= template.minRating) score += 10;
    if (template.maxRating && rating <= template.maxRating) score += 10;
    
    // Keyword match
    if (template.keywords && reviewText) {
      const lowerText = reviewText.toLowerCase();
      const matchedKeywords = (template.keywords as string[]).filter(
        kw => lowerText.includes(kw.toLowerCase())
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
 * Apply template with variable substitution
 */
export function applyTemplate(
  templateText: string,
  variables: Record<string, string>
): string {
  let result = templateText;
  
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  return result;
}

/**
 * Create draft response for a review
 */
export async function createDraftResponse(
  reviewId: string,
  options: { useTemplate?: boolean; templateId?: string; tone?: string } = {}
): Promise<typeof reviewResponses.$inferSelect> {
  const { useTemplate = true, templateId, tone } = options;
  
  // Get review
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  
  if (!review) throw new Error('Review not found');
  
  let responseText: string;
  let responseType: 'ai_generated' | 'template' | 'custom' = 'ai_generated';
  let usedTemplateId: string | null = null;
  
  // Try template first
  if (useTemplate && !templateId) {
    const template = await findMatchingTemplate(
      review.clientId!,
      review.rating,
      review.reviewText || ''
    );
    
    if (template) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, review.clientId!))
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
  if (!responseText!) {
    responseText = await generateReviewResponse({
      reviewId,
      tone: (tone as any) || 'professional',
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
 * Regenerate response with different parameters
 */
export async function regenerateResponse(
  responseId: string,
  options: { tone?: string; shorter?: boolean; custom?: string }
): Promise<string> {
  const [response] = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.id, responseId))
    .limit(1);
  
  if (!response) throw new Error('Response not found');
  
  const { tone = 'professional', shorter = false, custom } = options;
  
  if (custom) {
    // User provided custom instructions
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, response.reviewId!))
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
"${response.responseText}"

Original review (${review?.rating} stars):
"${review?.reviewText || 'No text'}"`,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });
    
    const newText = aiResponse.choices[0].message.content || response.responseText;
    
    await db
      .update(reviewResponses)
      .set({ responseText: newText, updatedAt: new Date() })
      .where(eq(reviewResponses.id, responseId));
    
    return newText;
  }
  
  // Generate new response with different tone
  const newText = await generateReviewResponse({
    reviewId: response.reviewId!,
    tone: tone as any,
    maxLength: shorter ? 100 : 200,
  });
  
  await db
    .update(reviewResponses)
    .set({ responseText: newText, updatedAt: new Date() })
    .where(eq(reviewResponses.id, responseId));
  
  return newText;
}
```

---

## Step 3: Create Google Business Profile Posting Service

**CREATE** `src/lib/services/google-business.ts`:

```typescript
import { db } from '@/lib/db';
import { reviews, reviewResponses, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Note: Google Business Profile API requires OAuth 2.0
// This is a simplified version - full implementation needs OAuth flow

interface GoogleAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Post response to Google Business Profile
 * 
 * Note: This requires the Google Business Profile API and OAuth setup
 * See: https://developers.google.com/my-business/content/review-data
 */
export async function postResponseToGoogle(
  responseId: string
): Promise<{ success: boolean; error?: string }> {
  const [response] = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.id, responseId))
    .limit(1);
  
  if (!response) {
    return { success: false, error: 'Response not found' };
  }
  
  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, response.reviewId!))
    .limit(1);
  
  if (!review || review.source !== 'google') {
    return { success: false, error: 'Not a Google review' };
  }
  
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, response.clientId!))
    .limit(1);
  
  if (!client?.googleAccessToken) {
    return { success: false, error: 'Google Business not connected' };
  }
  
  try {
    // Refresh token if needed
    let accessToken = client.googleAccessToken;
    if (client.googleTokenExpiresAt && new Date(client.googleTokenExpiresAt) < new Date()) {
      accessToken = await refreshGoogleToken(client.id, client.googleRefreshToken!);
    }
    
    // Post reply via Google Business Profile API
    // The review name format is: accounts/{account_id}/locations/{location_id}/reviews/{review_id}
    const reviewName = review.externalId; // Should store full resource name
    
    const apiUrl = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;
    
    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: response.responseText,
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || 'Failed to post response');
    }
    
    // Update response status
    await db
      .update(reviewResponses)
      .set({
        status: 'posted',
        postedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId));
    
    // Update review
    await db
      .update(reviews)
      .set({
        hasResponse: true,
        responseText: response.responseText,
        responseDate: new Date(),
      })
      .where(eq(reviews.id, response.reviewId!));
    
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    await db
      .update(reviewResponses)
      .set({
        postError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId));
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Refresh Google access token
 */
async function refreshGoogleToken(
  clientId: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  const data = await res.json();
  
  if (!data.access_token) {
    throw new Error('Failed to refresh token');
  }
  
  // Save new token
  await db
    .update(clients)
    .set({
      googleAccessToken: data.access_token,
      googleTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    })
    .where(eq(clients.id, clientId));
  
  return data.access_token;
}
```

---

## Step 4: Add Google OAuth Fields to Clients

**MODIFY** `src/lib/db/schema.ts` - ADD to clients table:

```typescript
// In clients table, ADD:
googleAccessToken: varchar('google_access_token', { length: 500 }),
googleRefreshToken: varchar('google_refresh_token', { length: 500 }),
googleTokenExpiresAt: timestamp('google_token_expires_at'),
googleBusinessAccountId: varchar('google_business_account_id', { length: 100 }),
googleLocationId: varchar('google_location_id', { length: 100 }),
```

---

## Step 5: Create Response API Routes

**CREATE** `src/app/api/reviews/[id]/responses/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { reviewResponses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createDraftResponse, regenerateResponse } from '@/lib/services/review-response';

// GET - Get responses for a review
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const responses = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.reviewId, params.id))
    .orderBy(desc(reviewResponses.createdAt));

  return NextResponse.json(responses);
}

// POST - Create new draft response
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { useTemplate, templateId, tone } = body;

  const draft = await createDraftResponse(params.id, {
    useTemplate,
    templateId,
    tone,
  });

  return NextResponse.json(draft);
}
```

**CREATE** `src/app/api/responses/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { reviewResponses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { regenerateResponse } from '@/lib/services/review-response';

// GET - Get single response
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [response] = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.id, params.id))
    .limit(1);

  if (!response) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(response);
}

// PATCH - Update response text
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { responseText, status } = body;

  const updates: any = { updatedAt: new Date() };
  if (responseText) updates.responseText = responseText;
  if (status) updates.status = status;

  await db
    .update(reviewResponses)
    .set(updates)
    .where(eq(reviewResponses.id, params.id));

  return NextResponse.json({ success: true });
}

// DELETE - Delete draft response
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.delete(reviewResponses).where(eq(reviewResponses.id, params.id));

  return NextResponse.json({ success: true });
}
```

**CREATE** `src/app/api/responses/[id]/regenerate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { regenerateResponse } from '@/lib/services/review-response';

// POST - Regenerate response
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tone, shorter, custom } = body;

  const newText = await regenerateResponse(params.id, {
    tone,
    shorter,
    custom,
  });

  return NextResponse.json({ responseText: newText });
}
```

**CREATE** `src/app/api/responses/[id]/post/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { postResponseToGoogle } from '@/lib/services/google-business';

// POST - Post response to Google
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await postResponseToGoogle(params.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
```

---

## Step 6: Create Response Templates API

**CREATE** `src/app/api/clients/[id]/templates/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { responseTemplates } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET - List templates
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templates = await db
    .select()
    .from(responseTemplates)
    .where(eq(responseTemplates.clientId, params.id))
    .orderBy(desc(responseTemplates.usageCount));

  return NextResponse.json(templates);
}

// POST - Create template
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    category,
    templateText,
    variables,
    minRating,
    maxRating,
    keywords,
  } = body;

  const [template] = await db
    .insert(responseTemplates)
    .values({
      clientId: params.id,
      name,
      category,
      templateText,
      variables,
      minRating,
      maxRating,
      keywords,
    })
    .returning();

  return NextResponse.json(template);
}
```

---

## Step 7: Review Response Editor Component

**CREATE** `src/components/reviews/response-editor.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Send,
  Copy,
  Check,
  Wand2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface Review {
  id: string;
  rating: number;
  authorName: string;
  reviewText: string;
  source: string;
}

interface ResponseEditorProps {
  review: Review;
  initialResponse?: string;
  onSave?: (text: string) => void;
  onPost?: () => void;
}

export function ResponseEditor({
  review,
  initialResponse,
  onSave,
  onPost,
}: ResponseEditorProps) {
  const [responseText, setResponseText] = useState(initialResponse || '');
  const [tone, setTone] = useState('professional');
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);

  const generateResponse = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone }),
      });
      const data = await res.json();
      setResponseText(data.responseText);
      setResponseId(data.id);
      toast.success('Response generated!');
    } catch {
      toast.error('Failed to generate response');
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = async (options: { tone?: string; shorter?: boolean }) => {
    if (!responseId) {
      await generateResponse();
      return;
    }
    
    setGenerating(true);
    try {
      const res = await fetch(`/api/responses/${responseId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      setResponseText(data.responseText);
      toast.success('Response updated!');
    } catch {
      toast.error('Failed to regenerate');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(responseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const postResponse = async () => {
    if (!responseId) {
      toast.error('Generate a response first');
      return;
    }
    
    setPosting(true);
    try {
      const res = await fetch(`/api/responses/${responseId}/post`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to post');
      }
      
      toast.success('Response posted to Google!');
      onPost?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const wordCount = responseText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Response Editor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tone selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tone:</span>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="apologetic">Apologetic</SelectItem>
              <SelectItem value="thankful">Thankful</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={generateResponse}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            <span className="ml-1">Generate</span>
          </Button>
        </div>

        {/* Response textarea */}
        <div className="relative">
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Your response will appear here..."
            rows={6}
            className="resize-none pr-16"
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {wordCount} words
          </div>
        </div>

        {/* Quick actions */}
        {responseText && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerate({ shorter: true })}
              disabled={generating}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Make shorter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerate({ tone: 'friendly' })}
              disabled={generating}
            >
              More friendly
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerate({ tone: 'apologetic' })}
              disabled={generating}
            >
              More apologetic
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={copyToClipboard} disabled={!responseText}>
            {copied ? (
              <Check className="h-4 w-4 mr-1 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-1" />
            )}
            Copy
          </Button>
          
          {review.source === 'google' && (
            <Button
              onClick={postResponse}
              disabled={!responseText || posting}
              className="flex-1"
            >
              {posting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Post to Google
            </Button>
          )}
          
          {review.source !== 'google' && (
            <Button
              variant="secondary"
              onClick={copyToClipboard}
              disabled={!responseText}
              className="flex-1"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Copy & Reply on {review.source}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Step 8: Default Templates Seeder

**CREATE** `src/lib/db/seed-templates.ts`:

```typescript
import { db } from '@/lib/db';
import { responseTemplates } from '@/lib/db/schema';

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
  for (const template of defaultTemplates) {
    await db.insert(responseTemplates).values({
      clientId,
      ...template,
      variables: ['customer_name', 'business_name', 'owner_name'],
    });
  }
}
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add response tables |
| `src/lib/services/review-response.ts` | Created |
| `src/lib/services/google-business.ts` | Created |
| `src/app/api/reviews/[id]/responses/route.ts` | Created |
| `src/app/api/responses/[id]/route.ts` | Created |
| `src/app/api/responses/[id]/regenerate/route.ts` | Created |
| `src/app/api/responses/[id]/post/route.ts` | Created |
| `src/app/api/clients/[id]/templates/route.ts` | Created |
| `src/components/reviews/response-editor.tsx` | Created |
| `src/lib/db/seed-templates.ts` | Created |

---

## Google Business Profile API Setup

1. Create Google Cloud project
2. Enable Google Business Profile API
3. Create OAuth 2.0 credentials
4. Add callback URL: `https://yourdomain.com/api/auth/callback/google-business`
5. Request these scopes:
   - `https://www.googleapis.com/auth/business.manage`

Add to `.env.local`:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Seed default templates
npx tsx src/lib/db/seed-templates.ts [CLIENT_ID]

# 3. Generate response for a review
curl -X POST http://localhost:3000/api/reviews/[REVIEW_ID]/responses \
  -H "Content-Type: application/json" \
  -d '{"tone": "friendly"}'

# 4. Regenerate with different tone
curl -X POST http://localhost:3000/api/responses/[RESPONSE_ID]/regenerate \
  -H "Content-Type: application/json" \
  -d '{"tone": "apologetic"}'

# 5. Post to Google (requires OAuth)
curl -X POST http://localhost:3000/api/responses/[RESPONSE_ID]/post
```

## Success Criteria
- [ ] AI generates appropriate responses for different ratings
- [ ] Responses can be regenerated with different tones
- [ ] Templates auto-match based on rating and keywords
- [ ] Manual editing works
- [ ] Copy to clipboard works
- [ ] Google posting works (when OAuth connected)
