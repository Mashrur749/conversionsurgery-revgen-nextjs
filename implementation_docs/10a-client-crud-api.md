# Phase 10a: Client CRUD API

**Estimated Time**: 2-3 hours
**Difficulty**: Medium
**Dependencies**: Phase 7 (Admin auth), Phase 1-6 (Core infrastructure)

## Current State (after Phase 9)
- ✅ Admin system with client selector
- ✅ Team escalation and hot transfers working
- ✅ Database has clients table with all required fields
- ❌ No way to create/edit clients from API or UI
- ❌ No way to manage users as admin
- ❌ No stats/analytics API

## Goal
Build comprehensive admin APIs for client and user management:
1. **Client CRUD**: Create, read, update, delete clients
2. **User Management**: List and update user roles/permissions
3. **Stats API**: Get client performance metrics

## Architecture Overview

```
Admin User (isAdmin=true)
        ↓
NextAuth Session (includes isAdmin flag)
        ↓
API Routes (/api/admin/*)
    ├── GET /api/admin/clients              → List all clients
    ├── POST /api/admin/clients             → Create new client
    ├── GET /api/admin/clients/[id]         → Get single client
    ├── PATCH /api/admin/clients/[id]       → Update client
    ├── DELETE /api/admin/clients/[id]      → Delete (soft) client
    ├── GET /api/admin/clients/[id]/stats   → Get client stats
    ├── GET /api/admin/users                → List all users
    └── PATCH /api/admin/users/[id]         → Update user role
        ↓
Database Operations
    ├── clients table
    ├── users table
    └── daily_stats table
```

## Prerequisites

✅ Phase 7 complete (admin context, isAdmin field)
✅ NextAuth configured (sessions working)
✅ Database schema deployed
✅ `normalizePhoneNumber` utility available
✅ Zod validation library

---

## Step 1: Create Clients API Route

**CREATE** `src/app/api/admin/clients/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const allClients = await db
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt));

  return NextResponse.json({ clients: allClients });
}

const createClientSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Phone number is required'),
  timezone: z.string().default('America/Edmonton'),
  googleBusinessUrl: z.string().url().optional().or(z.literal('')),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createClientSchema.parse(body);

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(clients)
      .where(eq(clients.email, data.email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'A client with this email already exists' },
        { status: 400 }
      );
    }

    const [client] = await db
      .insert(clients)
      .values({
        businessName: data.businessName,
        ownerName: data.ownerName,
        email: data.email,
        phone: normalizePhoneNumber(data.phone),
        timezone: data.timezone,
        googleBusinessUrl: data.googleBusinessUrl || null,
        status: 'pending', // Not active until Twilio number assigned
      })
      .returning();

    return NextResponse.json({ client });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Create client error:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
```

---

## Step 2: Create Single Client API Route

**CREATE** `src/app/api/admin/clients/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  return NextResponse.json({ client });
}

const updateClientSchema = z.object({
  businessName: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  timezone: z.string().optional(),
  googleBusinessUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  twilioNumber: z.string().optional().or(z.null()),
  notificationEmail: z.boolean().optional(),
  notificationSms: z.boolean().optional(),
  monthlyMessageLimit: z.number().min(0).optional(),
  status: z.enum(['pending', 'active', 'paused', 'cancelled']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = updateClientSchema.parse(body);

    // Normalize phone if provided
    if (data.phone) {
      data.phone = normalizePhoneNumber(data.phone);
    }

    const [updated] = await db
      .update(clients)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Update client error:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Soft delete - set status to cancelled
  const [updated] = await db
    .update(clients)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(clients.id, params.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

---

## Step 3: Create Admin Users API Route

**CREATE** `src/app/api/admin/users/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, clients } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      clientId: users.clientId,
      clientName: clients.businessName,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(clients, eq(users.clientId, clients.id))
    .orderBy(desc(users.createdAt));

  return NextResponse.json({ users: allUsers });
}
```

---

## Step 4: Create Single User API Route

**CREATE** `src/app/api/admin/users/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  clientId: z.string().uuid().optional().or(z.null()),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Prevent demoting yourself
  if (params.id === session.user.id) {
    const body = await request.json();
    if (body.isAdmin === false) {
      return NextResponse.json(
        { error: 'Cannot remove your own admin access' },
        { status: 400 }
      );
    }
  }

  try {
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
```

---

## Step 5: Create Client Stats API

**CREATE** `src/app/api/admin/clients/[id]/stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, conversations, dailyStats, teamMembers } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const clientId = params.id;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get lead counts
  const leadCounts = await db
    .select({
      total: sql<number>`count(*)`,
      actionRequired: sql<number>`count(*) filter (where ${leads.actionRequired} = true)`,
    })
    .from(leads)
    .where(eq(leads.clientId, clientId));

  // Get 7-day stats
  const weekStats = await db
    .select({
      missedCalls: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}), 0)`,
      forms: sql<number>`COALESCE(SUM(${dailyStats.formsResponded}), 0)`,
      messages: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
    })
    .from(dailyStats)
    .where(and(
      eq(dailyStats.clientId, clientId),
      gte(dailyStats.date, sevenDaysAgo.toISOString().split('T')[0])
    ));

  // Get team member count
  const teamCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, clientId),
      eq(teamMembers.isActive, true)
    ));

  return NextResponse.json({
    stats: {
      totalLeads: Number(leadCounts[0]?.total || 0),
      actionRequired: Number(leadCounts[0]?.actionRequired || 0),
      leadsThisWeek: Number(weekStats[0]?.missedCalls || 0) + Number(weekStats[0]?.forms || 0),
      messagesThisWeek: Number(weekStats[0]?.messages || 0),
      teamMembers: Number(teamCount[0]?.count || 0),
    },
  });
}
```

---

## 🔒 Security Considerations

### Authentication
- ✅ All routes check `!session?.user?.isAdmin` first
- ✅ 403 Unauthorized returned for non-admins
- ✅ Session validated via `auth()` from NextAuth

### Authorization
- ✅ Admin-only routes prevent privilege escalation
- ✅ Users cannot demote themselves (prevents lockout)
- ✅ Soft deletes preserve data integrity

### Input Validation
- ✅ Zod schemas validate all inputs
- ✅ Email format validation prevents invalid emails
- ✅ Phone number normalization prevents duplicate formats
- ✅ UUID validation for IDs
- ✅ Status enum restricts valid states

### Data Protection
- ⚠️ **Important**: Ensure SSL/HTTPS in production
- ⚠️ **Important**: Rate limit admin endpoints to prevent brute force
- ⚠️ **Important**: Audit log all admin actions (optional enhancement)

---

## 📊 Database Schema Requirements

These tables must exist and have the correct schema:

```sql
-- Check clients table
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'clients'
ORDER BY ordinal_position;

-- Should have columns:
-- id (UUID), businessName (varchar), ownerName (varchar),
-- email (varchar), phone (varchar), timezone (varchar),
-- googleBusinessUrl (varchar, nullable), twilioNumber (varchar, nullable),
-- status (varchar), createdAt (timestamp), updatedAt (timestamp)

-- Check users table
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Should have columns:
-- id (UUID), email (varchar), isAdmin (boolean),
-- clientId (UUID, nullable), createdAt (timestamp), updatedAt (timestamp)
```

---

## 🧪 Testing & Verification

### Step 1: Setup

```bash
# Start development server
npm run dev

# In another terminal, create test data
npx tsx scripts/seed-test-data.ts
```

### Step 2: Get Auth Cookie

Create `scripts/test-admin-api.ts`:

```typescript
import 'dotenv/config';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function getTestAdmin() {
  const db = getDb();

  const [admin] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.isAdmin, true))
    .limit(1);

  if (!admin) {
    console.error('No admin user found! Run seed-test-data.ts first');
    process.exit(1);
  }

  console.log('Admin ID:', admin.id);
  console.log('Admin Email:', admin.email);
  console.log('\nUse this email to login and get a session cookie');
}

getTestAdmin();
```

### Step 3: Test Each Endpoint

**Login and get session**:
1. Go to http://localhost:3000/login
2. Enter: admin@test.local
3. Check email for magic link
4. Click link to login
5. In browser console: `document.cookie` to see session cookie

**Test GET /api/admin/clients**:
```bash
curl -X GET http://localhost:3000/api/admin/clients \
  -H "Cookie: [your-session-cookie]" \
  -v
```

Expected response:
```json
{
  "clients": [
    {
      "id": "uuid",
      "businessName": "Test Company",
      "ownerName": "Test Owner",
      "email": "test-client@test.local",
      "phone": "+1-555-0000",
      "timezone": "America/Edmonton",
      "status": "pending",
      "createdAt": "2026-02-08T...",
      "updatedAt": "2026-02-08T..."
    }
  ]
}
```

**Test POST /api/admin/clients**:
```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Cookie: [your-session-cookie]" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "New Business",
    "ownerName": "Jane Smith",
    "email": "jane@newbiz.com",
    "phone": "4035551234",
    "timezone": "America/Toronto"
  }'
```

**Test PATCH /api/admin/clients/[id]**:
```bash
curl -X PATCH http://localhost:3000/api/admin/clients/[client-id] \
  -H "Cookie: [your-session-cookie]" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Updated Name",
    "status": "active"
  }'
```

**Test DELETE /api/admin/clients/[id]** (soft delete):
```bash
curl -X DELETE http://localhost:3000/api/admin/clients/[client-id] \
  -H "Cookie: [your-session-cookie]"
```

**Test GET /api/admin/users**:
```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Cookie: [your-session-cookie]"
```

**Test PATCH /api/admin/users/[id]**:
```bash
curl -X PATCH http://localhost:3000/api/admin/users/[user-id] \
  -H "Cookie: [your-session-cookie]" \
  -H "Content-Type: application/json" \
  -d '{
    "isAdmin": true
  }'
```

---

## ⚠️ Common Issues & Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 403 Unauthorized | Not authenticated or not admin | Login as admin user via /login |
| 400 Bad Request | Validation error | Check error message in response, validate JSON |
| Email already exists | Duplicate email | Use different email address |
| Invalid UUID | Phone format issue | Ensure phone starts with + and has digits only |
| 404 Not Found | Client/user doesn't exist | Check ID exists in database first |
| CORS error | Frontend origin not allowed | Check NextAuth allowed origins |
| Phone normalization fails | Invalid phone format | Use format: +1 555 000 0000 |

### Debug Tips

```bash
# Check if clients exist
npx tsx -e "
import { getDb } from './src/db';
import { clients } from './src/db/schema';
const db = getDb();
db.select().from(clients).then(c => console.log('Clients:', c));
"

# Check if user is admin
npx tsx -e "
import { getDb } from './src/db';
import { users } from './src/db/schema';
const db = getDb();
db.select().from(users).then(u => console.log('Users:', u));
"

# Verify auth works
npm run dev
# Go to http://localhost:3000/login
# Check NextAuth session at: http://localhost:3000/api/auth/session
```

---

## ✅ Verification Checklist

### Before Implementation
- [ ] Phase 7 (admin context) is complete
- [ ] NextAuth is configured and working
- [ ] Database migrations are applied
- [ ] clients table exists and has correct schema
- [ ] users table has `isAdmin` field
- [ ] Test data seeded with admin user

### Implementation
- [ ] Step 1: Create `/api/admin/clients/route.ts` (GET, POST)
- [ ] Step 2: Create `/api/admin/clients/[id]/route.ts` (GET, PATCH, DELETE)
- [ ] Step 3: Create `/api/admin/users/route.ts` (GET)
- [ ] Step 4: Create `/api/admin/users/[id]/route.ts` (PATCH)
- [ ] Step 5: Create `/api/admin/clients/[id]/stats/route.ts` (GET)

### Testing
- [ ] Test 401/403 without auth
- [ ] Test GET /api/admin/clients returns array
- [ ] Test POST creates new client
- [ ] Test POST validates email format
- [ ] Test POST prevents duplicate emails
- [ ] Test PATCH updates client fields
- [ ] Test DELETE soft-deletes (status='cancelled')
- [ ] Test GET /api/admin/users returns array with joins
- [ ] Test PATCH prevents self-demotion
- [ ] Test stats endpoint calculates correctly
- [ ] Test all error responses are correct HTTP status
- [ ] Build succeeds: `npm run build`

### Post-Implementation
- [ ] All 5 API routes created
- [ ] All routes authenticated and authorized
- [ ] Zod validation on all inputs
- [ ] Error handling with proper status codes
- [ ] No TypeScript errors
- [ ] Build passes
- [ ] Ready for Phase 10b (UI)

---

## 🚀 Next Steps

1. **Implement**: Follow Steps 1-5 above
2. **Test**: Run verification tests in Testing section
3. **Verify**: Complete verification checklist
4. **Proceed**: Move to Phase 10b for admin UI pages

---

## 📝 Integration Points

### With Previous Phases
- **Phase 7**: Uses admin context for authorization
- **Phase 1-6**: Relies on existing database schema
- **NextAuth**: Session validation on all routes

### With Future Phases
- **Phase 10b**: UI will call these APIs
- **Phase 11**: Twilio provisioning APIs
- **Phase 13**: Setup wizard will use client creation

---

## 📚 Related Files

- `src/app/api/admin/clients/route.ts` ← You'll create this
- `src/app/api/admin/clients/[id]/route.ts` ← You'll create this
- `src/app/api/admin/users/route.ts` ← You'll create this
- `src/app/api/admin/users/[id]/route.ts` ← You'll create this
- `src/app/api/admin/clients/[id]/stats/route.ts` ← You'll create this
- `src/lib/auth.ts` - NextAuth helper (reference)
- `src/db/schema/clients.ts` - Clients table (reference)
