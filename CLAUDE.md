# ConversionSurgery Revenue Recovery

## Stack
- Next.js 16 (App Router), React 19, TypeScript
- Drizzle ORM + Neon Serverless Postgres (`@neondatabase/serverless`)
- NextAuth v4 (email magic links via Resend)
- Twilio (SMS/Voice), Stripe (billing), OpenAI (AI responses)
- shadcn/ui + Tailwind 4 + Radix UI
- Deploy: Cloudflare via OpenNext (`@opennextjs/cloudflare`)

## Key Patterns
- Database: use `getDb()` from `@/db` — creates a Neon HTTP client per request. Never cache the instance.
- Auth: use `auth()` from `@/lib/auth` for server components, `getServerSession(authOptions)` for API routes
- Admin check: `(session as any).user?.isAdmin` — all admin API routes must return 403 if not admin
- API route params: Next.js 16 uses `Promise<{ id: string }>` for async params — always `await` them
- Phone numbers: normalize with `normalizePhoneNumber()` from `@/lib/utils/phone`
- Validation: Zod schemas for all API input, return validation error details on 400
- Schema files: one table per file in `src/db/schema/`, re-exported from `src/db/schema/index.ts`
- UI components: shadcn/ui in `src/components/ui/`, install new ones with `npx shadcn@latest add <component>`
- Services: business logic in `src/lib/services/`, automations in `src/lib/automations/`

## Commands
- `npm run dev` — local dev server (port 3000)
- `npm run build` — production build (must pass with 0 TypeScript errors)
- `npm run lint` — ESLint check (next/core-web-vitals + next/typescript)
- `npm run db:generate` — generate Drizzle migrations after schema changes
- `npm run db:push` — push schema directly to database (use with caution)
- `npm run db:migrate` — run generated migrations
- `npm run db:studio` — open Drizzle Studio for visual database browsing

## Do NOT
- Read or edit `.env` files — they contain production secrets
- Run `db:push` or `db:migrate` without explicit user confirmation
- Modify `package-lock.json` or `node_modules/`
- Skip admin auth checks on `/api/admin/*` routes
