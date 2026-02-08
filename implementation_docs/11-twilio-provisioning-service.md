# Phase 11a: Twilio Provisioning Service

## Current State (after Phase 10)
- Client CRUD working from UI
- Can create clients but no way to assign phone numbers
- Twilio numbers must be manually configured

## Goal
Add service to search, purchase, and auto-configure Twilio phone numbers.

---

## Step 1: Create Twilio Provisioning Service

**CREATE** `src/lib/services/twilio-provisioning.ts`:

```typescript
import twilio from 'twilio';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

interface SearchParams {
  areaCode?: string;
  contains?: string;
  country?: string;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
}

export async function searchAvailableNumbers(params: SearchParams): Promise<AvailableNumber[]> {
  const { areaCode, contains, country = 'CA' } = params;

  try {
    const searchParams: any = {
      voiceEnabled: true,
      smsEnabled: true,
    };

    if (areaCode) {
      searchParams.areaCode = areaCode;
    }

    if (contains) {
      searchParams.contains = contains;
    }

    const numbers = await twilioClient.availablePhoneNumbers(country)
      .local
      .list(searchParams);

    return numbers.slice(0, 10).map(num => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: num.locality || '',
      region: num.region || '',
      capabilities: {
        voice: num.capabilities.voice,
        SMS: num.capabilities.sms,
        MMS: num.capabilities.mms,
      },
    }));
  } catch (error) {
    console.error('Error searching numbers:', error);
    throw new Error('Failed to search available numbers');
  }
}

export async function purchaseNumber(phoneNumber: string, clientId: string): Promise<{
  success: boolean;
  sid?: string;
  error?: string;
}> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    return { success: false, error: 'NEXT_PUBLIC_APP_URL not configured' };
  }

  try {
    // Purchase the number
    const purchased = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: `${baseUrl}/api/webhooks/twilio/voice`,
      voiceMethod: 'POST',
      smsUrl: `${baseUrl}/api/webhooks/twilio/sms`,
      smsMethod: 'POST',
      friendlyName: `Client: ${clientId}`,
    });

    // Update client with the new number
    await db
      .update(clients)
      .set({
        twilioNumber: phoneNumber,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    return { success: true, sid: purchased.sid };
  } catch (error: any) {
    console.error('Error purchasing number:', error);
    return {
      success: false,
      error: error.message || 'Failed to purchase number',
    };
  }
}

export async function configureExistingNumber(
  phoneNumber: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    return { success: false, error: 'NEXT_PUBLIC_APP_URL not configured' };
  }

  try {
    // Find the number in Twilio
    const numbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber,
    });

    if (numbers.length === 0) {
      return { success: false, error: 'Number not found in your Twilio account' };
    }

    const number = numbers[0];

    // Update webhooks
    await twilioClient.incomingPhoneNumbers(number.sid).update({
      voiceUrl: `${baseUrl}/api/webhooks/twilio/voice`,
      voiceMethod: 'POST',
      smsUrl: `${baseUrl}/api/webhooks/twilio/sms`,
      smsMethod: 'POST',
      friendlyName: `Client: ${clientId}`,
    });

    // Update client
    await db
      .update(clients)
      .set({
        twilioNumber: phoneNumber,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    return { success: true };
  } catch (error: any) {
    console.error('Error configuring number:', error);
    return {
      success: false,
      error: error.message || 'Failed to configure number',
    };
  }
}

export async function releaseNumber(clientId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client?.twilioNumber) {
      return { success: false, error: 'No number assigned to this client' };
    }

    // Find and release the number
    const numbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber: client.twilioNumber,
    });

    if (numbers.length > 0) {
      // Don't actually delete - just clear webhooks
      await twilioClient.incomingPhoneNumbers(numbers[0].sid).update({
        voiceUrl: '',
        smsUrl: '',
        friendlyName: 'Released',
      });
    }

    // Clear from client
    await db
      .update(clients)
      .set({
        twilioNumber: null,
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    return { success: true };
  } catch (error: any) {
    console.error('Error releasing number:', error);
    return {
      success: false,
      error: error.message || 'Failed to release number',
    };
  }
}

export async function getAccountBalance(): Promise<{
  balance: string;
  currency: string;
} | null> {
  try {
    const balance = await twilioClient.balance.fetch();
    return {
      balance: balance.balance,
      currency: balance.currency,
    };
  } catch (error) {
    console.error('Error fetching balance:', error);
    return null;
  }
}

export async function listOwnedNumbers(): Promise<{
  phoneNumber: string;
  friendlyName: string;
  sid: string;
}[]> {
  try {
    const numbers = await twilioClient.incomingPhoneNumbers.list();
    return numbers.map(num => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      sid: num.sid,
    }));
  } catch (error) {
    console.error('Error listing numbers:', error);
    return [];
  }
}
```

---

## Step 2: Create Phone Numbers API Routes

**CREATE** `src/app/api/admin/twilio/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchAvailableNumbers } from '@/lib/services/twilio-provisioning';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(request.url);
  const areaCode = url.searchParams.get('areaCode') || undefined;
  const contains = url.searchParams.get('contains') || undefined;
  const country = url.searchParams.get('country') || 'CA';

  try {
    const numbers = await searchAvailableNumbers({
      areaCode,
      contains,
      country,
    });

    return NextResponse.json({ numbers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to search' },
      { status: 500 }
    );
  }
}
```

---

## Step 3: Create Purchase API Route

**CREATE** `src/app/api/admin/twilio/purchase/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { purchaseNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const schema = z.object({
  phoneNumber: z.string().min(10),
  clientId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { phoneNumber, clientId } = schema.parse(body);

    const result = await purchaseNumber(phoneNumber, clientId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, sid: result.sid });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to purchase' },
      { status: 500 }
    );
  }
}
```

---

## Step 4: Create Configure Existing Number API

**CREATE** `src/app/api/admin/twilio/configure/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { configureExistingNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const schema = z.object({
  phoneNumber: z.string().min(10),
  clientId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { phoneNumber, clientId } = schema.parse(body);

    const result = await configureExistingNumber(phoneNumber, clientId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to configure' },
      { status: 500 }
    );
  }
}
```

---

## Step 5: Create Release Number API

**CREATE** `src/app/api/admin/twilio/release/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { releaseNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';

const schema = z.object({
  clientId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { clientId } = schema.parse(body);

    const result = await releaseNumber(clientId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to release' },
      { status: 500 }
    );
  }
}
```

---

## Step 6: Create Account Info API

**CREATE** `src/app/api/admin/twilio/account/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAccountBalance, listOwnedNumbers } from '@/lib/services/twilio-provisioning';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const [balance, numbers] = await Promise.all([
    getAccountBalance(),
    listOwnedNumbers(),
  ]);

  return NextResponse.json({
    balance,
    numbers,
  });
}
```

---

## Verify

1. `npm run dev`
2. Test API with curl:
   ```bash
   # Search for numbers
   curl "http://localhost:3000/api/admin/twilio/search?areaCode=403"
   
   # Get account info
   curl "http://localhost:3000/api/admin/twilio/account"
   ```
3. Should return available numbers (requires valid Twilio credentials)

---

## Next
Proceed to **Phase 11b** for phone number management UI.
