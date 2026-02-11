# Module: media-storage
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Media attachment handling — processing incoming MMS media from Twilio, storing files, serving media via API, and displaying in lead detail views.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/media-attachments.ts` | `mediaAttachments` table — stored media metadata |
| `src/lib/services/media.ts` | Media processing service — download, store, acknowledge |
| `src/lib/services/storage.ts` | Storage abstraction — file upload/download |
| `src/app/api/media/[id]/route.ts` | GET — serve media by ID |
| `src/app/api/leads/[id]/media/route.ts` | POST — upload media for a lead |
| `src/components/media/media-gallery.tsx` | Media gallery display component |
| `src/components/leads/lead-media-tab.tsx` | Lead detail media tab component |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/media.ts
export async function processIncomingMedia(
  messageId: string,
  mediaItems: Array<{ url: string; contentType: string; sid?: string }>,
  db: ReturnType<typeof getDb>
): Promise<MediaAttachment[]>

export function generatePhotoAcknowledgment(
  mediaItems: Array<{ url: string; contentType: string }>
): string
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `leads`, `conversations` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`

## REFACTORING GOALS

1. **Type safety** — Add proper TypeScript interfaces for media items, storage config
2. **Storage service cleanup** — Ensure storage.ts has consistent API (upload, download, delete)
3. **Error handling** — Robust error handling in processIncomingMedia for failed downloads
4. **Media serving** — Ensure media/[id] route has proper auth and content-type headers
5. **Component types** — Typed props for media-gallery and lead-media-tab

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] All files have proper TypeScript types
- [ ] Media serving route has proper auth
- [ ] Error handling for failed media downloads
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(media-storage): ...` format
- [ ] `.refactor-complete` sentinel created
