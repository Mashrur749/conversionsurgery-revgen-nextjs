# Module: review-reputation
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Online review monitoring and response management — syncs reviews from Google Business Profile, generates AI responses, tracks review metrics, and provides admin tools for reputation management.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/reviews.ts` | `reviews` table — individual reviews |
| `src/db/schema/review-sources.ts` | `reviewSources` table — connected review platforms |
| `src/db/schema/review-metrics.ts` | `reviewMetrics` table — aggregated review stats |
| `src/db/schema/response-templates.ts` | `responseTemplates` table — AI response templates |
| `src/db/schema/review-responses.ts` | `reviewResponses` table — generated/posted responses |
| `src/lib/services/review-monitoring.ts` | Review sync and monitoring service |
| `src/lib/services/review-response.ts` | AI review response generation |
| `src/lib/services/google-business.ts` | Google Business Profile API integration |
| `src/lib/services/google-places.ts` | Google Places API for review data |
| `src/app/api/admin/clients/[id]/reviews/route.ts` | GET — reviews for a client |
| `src/app/api/admin/clients/[id]/reviews/sources/route.ts` | GET/POST — review sources management |
| `src/app/api/admin/reviews/[id]/responses/route.ts` | GET — responses for a review |
| `src/app/api/admin/responses/[id]/route.ts` | GET/PUT — view and edit response |
| `src/app/api/admin/responses/[id]/regenerate/route.ts` | POST — regenerate AI response |
| `src/app/api/admin/responses/[id]/post/route.ts` | POST — post response to platform |
| `src/app/(dashboard)/admin/clients/[id]/reviews/page.tsx` | Client reviews management page |
| `src/app/(dashboard)/admin/reputation/page.tsx` | Admin reputation dashboard |
| `src/components/reviews/review-dashboard.tsx` | Review metrics and overview component |
| `src/components/reviews/response-editor.tsx` | Review response editing component |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/review-monitoring.ts
export async function syncAllReviews(clientId: string): Promise<{ synced: number; errors: number }>
export async function checkAndAlertNegativeReviews(clientId: string): Promise<void>
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- `src/lib/services/openai.ts` — belongs to ai-agent module
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients` from `@/db/schema`
- `authOptions` from `@/lib/auth`
- `generateAIResponse` from `@/lib/services/openai`
- `sendEmail` from `@/lib/services/resend`

## REFACTORING GOALS

1. **Type safety** — Define interfaces for review data, source config, response templates
2. **Google API services** — Clean up google-business.ts and google-places.ts with proper error handling
3. **Review sync** — Ensure syncAllReviews handles pagination and rate limits
4. **Response workflow** — Type the generate → edit → approve → post pipeline
5. **Admin routes** — Consistent auth checks, Zod validation, error responses
6. **Component types** — Typed props for review-dashboard and response-editor
7. **Consolidate Google services** — If google-business.ts and google-places.ts overlap, consider merging

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Google API error handling is robust
- [ ] All admin routes check `isAdmin`
- [ ] All routes use Zod validation
- [ ] Response workflow fully typed
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(review-reputation): ...` format
- [ ] `.refactor-complete` sentinel created
