import twilio from 'twilio';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
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
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
