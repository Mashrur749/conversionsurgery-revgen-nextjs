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

    console.log('Searching for numbers with params:', { areaCode, country, ...searchParams });

    const numbers = await twilioClient.availablePhoneNumbers(country)
      .local
      .list(searchParams);

    console.log(`Found ${numbers.length} available numbers`);

    if (numbers.length === 0 && process.env.NODE_ENV === 'development') {
      // In development, provide mock numbers for testing if no real results
      console.warn('No numbers found from Twilio. Using mock data for development.');
      return generateMockNumbers(areaCode || '403', country);
    }

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
  } catch (error: any) {
    console.error('Error searching numbers:', error);

    if (process.env.NODE_ENV === 'development') {
      console.warn('Twilio API error. Using mock data for development.');
      return generateMockNumbers(params.areaCode || '403', params.country || 'CA');
    }

    throw new Error(`Twilio search failed: ${error.message}`);
  }
}

function generateMockNumbers(areaCode: string, country: string): AvailableNumber[] {
  // Generate mock numbers for development/testing
  const mockLocalities: { [key: string]: { locality: string; region: string } } = {
    '403': { locality: 'Calgary', region: 'AB' },
    '780': { locality: 'Edmonton', region: 'AB' },
    '604': { locality: 'Vancouver', region: 'BC' },
    '416': { locality: 'Toronto', region: 'ON' },
    '514': { locality: 'Montreal', region: 'QC' },
  };

  const location = mockLocalities[areaCode] || { locality: 'Unknown', region: 'XX' };

  return Array.from({ length: 10 }, (_, i) => ({
    phoneNumber: `+1${areaCode}555${String(i).padStart(4, '0')}`,
    friendlyName: `Available ${location.region}`,
    locality: location.locality,
    region: location.region,
    capabilities: {
      voice: true,
      SMS: true,
      MMS: true,
    },
  }));
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
    // Check if this is a mock number (for development)
    const isMockNumber = isMockPhoneNumber(phoneNumber);
    let purchased: any = null;

    if (!isMockNumber) {
      // Purchase the number from Twilio
      console.log(`[Twilio Purchase] Purchasing real number: ${phoneNumber}`);
      purchased = await twilioClient.incomingPhoneNumbers.create({
        phoneNumber,
        voiceUrl: `${baseUrl}/api/webhooks/twilio/voice`,
        voiceMethod: 'POST',
        smsUrl: `${baseUrl}/api/webhooks/twilio/sms`,
        smsMethod: 'POST',
        friendlyName: `Client: ${clientId}`,
      });
    } else {
      // In development, mock numbers are auto-purchased
      console.log(`[Twilio Purchase] Assigning mock number: ${phoneNumber}`);
      purchased = { sid: `mock-${phoneNumber.replace(/\D/g, '').slice(-6)}` };
    }

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

    console.log(`[Twilio Purchase] Successfully assigned ${phoneNumber} to client ${clientId}`);
    return { success: true, sid: purchased.sid };
  } catch (error: any) {
    console.error('[Twilio Purchase] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to purchase number',
    };
  }
}

function isMockPhoneNumber(phoneNumber: string): boolean {
  // Mock numbers are in format: +1XXX5550000 to +1XXX5559999
  // where XXX is area code
  const mockPattern = /^\+1\d{3}555\d{4}$/;
  return mockPattern.test(phoneNumber) && process.env.NODE_ENV === 'development';
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
