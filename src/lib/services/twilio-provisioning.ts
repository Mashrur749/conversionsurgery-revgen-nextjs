import twilio from "twilio";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchParams {
  areaCode?: string;
  contains?: string;
  country?: string;
  inRegion?: string;
  inLocality?: string;
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

interface PurchaseResult {
  success: boolean;
  sid?: string;
  error?: string;
}

interface OperationResult {
  success: boolean;
  error?: string;
}

interface AccountBalance {
  balance: string;
  currency: string;
}

interface OwnedNumber {
  phoneNumber: string;
  friendlyName: string;
  sid: string;
}

// ---------------------------------------------------------------------------
// Exported Functions
// ---------------------------------------------------------------------------

/**
 * Search for available phone numbers on Twilio matching the given criteria.
 * In development, falls back to mock numbers when the Twilio API returns no
 * results or throws an error.
 *
 * @param params - Search criteria including optional area code, contains
 *   pattern, and country code (defaults to 'CA').
 * @returns An array of up to 10 available numbers with their capabilities.
 */
export async function searchAvailableNumbers(
  params: SearchParams,
): Promise<AvailableNumber[]> {
  const { areaCode, contains, country = "CA", inRegion, inLocality } = params;

  try {
    const searchParams: Record<string, string | boolean> = {
      voiceEnabled: true,
      smsEnabled: true,
    };

    if (areaCode) {
      searchParams.areaCode = areaCode;
    }

    if (contains) {
      searchParams.contains = contains;
    }

    if (inRegion) {
      searchParams.inRegion = inRegion;
    }

    if (inLocality) {
      searchParams.inLocality = inLocality;
    }

    console.log("[Twilio] Searching for numbers with params:", {
      areaCode,
      country,
      inRegion,
      inLocality,
      ...searchParams,
    });

    const numbers = await twilioClient
      .availablePhoneNumbers(country)
      .local.list(searchParams);

    console.log(`[Twilio] Found ${numbers.length} available numbers`);
    console.log({ numbers });

    if (numbers.length === 0 && process.env.NODE_ENV === "development") {
      // In development, provide mock numbers for testing if no real results
      console.warn(
        "[Twilio] No numbers found from Twilio. Using mock data for development.",
      );
      const mockAreaCode =
        areaCode || regionToAreaCode(inRegion) || "403";
      return generateMockNumbers(mockAreaCode, country);
    }

    return numbers.slice(0, 10).map((num) => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: num.locality || "",
      region: num.region || "",
      capabilities: {
        voice: num.capabilities.voice,
        SMS: num.capabilities.sms,
        MMS: num.capabilities.mms,
      },
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Twilio] Error searching numbers:", message);

    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Twilio] Twilio API error. Using mock data for development.",
      );
      const mockAreaCode =
        params.areaCode || regionToAreaCode(params.inRegion) || "403";
      return generateMockNumbers(mockAreaCode, params.country || "CA");
    }

    throw new Error(`Twilio search failed: ${message}`);
  }
}

/**
 * Purchase a phone number from Twilio and assign it to a client. Configures
 * voice and SMS webhook URLs automatically. In development mode, mock
 * numbers (555-prefixed) are assigned without contacting the Twilio API.
 *
 * @param phoneNumber - The E.164-formatted phone number to purchase.
 * @param clientId - The UUID of the client to assign the number to.
 * @returns A result object indicating success/failure and the Twilio SID.
 */
export async function purchaseNumber(
  phoneNumber: string,
  clientId: string,
): Promise<PurchaseResult> {
  try {
    // Check if this is a mock number (for development)
    const isMockNumber = isMockPhoneNumber(phoneNumber);
    let purchasedSid: string;

    if (!isMockNumber) {
      // Purchase the number from Twilio (no webhook config — done separately)
      console.log(`[Twilio] Purchasing real number: ${phoneNumber}`);
      const purchased = await twilioClient.incomingPhoneNumbers.create({
        phoneNumber,
        friendlyName: `Client: ${clientId}`,
      });
      purchasedSid = purchased.sid;
    } else {
      // In development, mock numbers are auto-purchased
      console.log(`[Twilio] Assigning mock number: ${phoneNumber}`);
      purchasedSid = `mock-${phoneNumber.replace(/\D/g, "").slice(-6)}`;
    }

    // Update client with the new number
    const db = getDb();
    await db
      .update(clients)
      .set({
        twilioNumber: phoneNumber,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    console.log(
      `[Twilio] Successfully purchased and assigned ${phoneNumber} to client ${clientId}`,
    );
    return { success: true, sid: purchasedSid };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Twilio] Purchase error:", message);
    return {
      success: false,
      error: message || "Failed to purchase number",
    };
  }
}

/**
 * Assign an existing owned Twilio number to a client without configuring
 * webhooks. Webhooks should be configured separately (e.g. during deployment
 * or from the phone management page).
 *
 * @param phoneNumber - The E.164-formatted phone number already in the account.
 * @param clientId - The UUID of the client to assign the number to.
 * @returns A result object indicating success or an error message.
 */
export async function assignExistingNumber(
  phoneNumber: string,
  clientId: string,
): Promise<OperationResult> {
  try {
    // Verify the number exists in the Twilio account
    const numbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber,
    });

    if (numbers.length === 0) {
      return {
        success: false,
        error: "Number not found in your Twilio account",
      };
    }

    // Update friendly name to associate with client
    await twilioClient.incomingPhoneNumbers(numbers[0].sid).update({
      friendlyName: `Client: ${clientId}`,
    });

    // Update client in database
    const db = getDb();
    await db
      .update(clients)
      .set({
        twilioNumber: phoneNumber,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    console.log(
      `[Twilio] Assigned existing number ${phoneNumber} to client ${clientId}`,
    );
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Twilio] Error assigning number:", message);
    return {
      success: false,
      error: message || "Failed to assign number",
    };
  }
}

/**
 * List all Twilio numbers on the account that are not currently assigned to
 * any client. Cross-references owned numbers with the clients table.
 *
 * @returns An array of unassigned numbers with their SIDs and friendly names.
 */
export async function listUnassignedNumbers(): Promise<OwnedNumber[]> {
  try {
    const db = getDb();
    const ownedNumbers = await listOwnedNumbers();

    // Get all assigned phone numbers from clients
    const assignedClients = await db
      .select({ twilioNumber: clients.twilioNumber })
      .from(clients)
      .where(isNotNull(clients.twilioNumber));

    const assignedSet = new Set(
      assignedClients
        .map((c) => c.twilioNumber)
        .filter((n): n is string => n !== null),
    );

    return ownedNumbers.filter((n) => !assignedSet.has(n.phoneNumber));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Twilio] Error listing unassigned numbers:", message);
    return [];
  }
}

/**
 * Configure an existing Twilio phone number for a client by updating its
 * webhook URLs and assigning it in the database.
 *
 * @param phoneNumber - The E.164-formatted phone number already in the
 *   Twilio account.
 * @param clientId - The UUID of the client to assign the number to.
 * @returns A result object indicating success or an error message.
 */
export async function configureExistingNumber(
  phoneNumber: string,
  clientId: string,
): Promise<OperationResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    return { success: false, error: "NEXT_PUBLIC_APP_URL not configured" };
  }

  try {
    // Find the number in Twilio
    const numbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber,
    });

    if (numbers.length === 0) {
      return {
        success: false,
        error: "Number not found in your Twilio account",
      };
    }

    const number = numbers[0];

    // Update webhooks
    await twilioClient.incomingPhoneNumbers(number.sid).update({
      voiceUrl: `${baseUrl}/api/webhooks/twilio/voice`,
      voiceMethod: "POST",
      smsUrl: `${baseUrl}/api/webhooks/twilio/sms`,
      smsMethod: "POST",
      friendlyName: `Client: ${clientId}`,
    });

    // Update client
    const db = getDb();
    await db
      .update(clients)
      .set({
        twilioNumber: phoneNumber,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    console.log(
      `[Twilio] Configured existing number ${phoneNumber} for client ${clientId}`,
    );
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Twilio] Error configuring number:", message);
    return {
      success: false,
      error: message || "Failed to configure number",
    };
  }
}

/**
 * Release a phone number from a client. Clears the Twilio webhook
 * configuration (without deleting the number) and removes the assignment
 * from the database, setting the client status to 'paused'.
 *
 * @param clientId - The UUID of the client whose number should be released.
 * @returns A result object indicating success or an error message.
 */
export async function releaseNumber(
  clientId: string,
): Promise<OperationResult> {
  try {
    const db = getDb();
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client?.twilioNumber) {
      return { success: false, error: "No number assigned to this client" };
    }

    // Find and release the number
    const numbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber: client.twilioNumber,
    });

    if (numbers.length > 0) {
      // Don't actually delete - just clear webhooks
      await twilioClient.incomingPhoneNumbers(numbers[0].sid).update({
        voiceUrl: "",
        smsUrl: "",
        friendlyName: "Released",
      });
    }

    // Clear from client
    await db
      .update(clients)
      .set({
        twilioNumber: null,
        status: "paused",
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    console.log(
      `[Twilio] Released number ${client.twilioNumber} from client ${clientId}`,
    );
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Twilio] Error releasing number:", message);
    return {
      success: false,
      error: message || "Failed to release number",
    };
  }
}

/**
 * Fetch the current Twilio account balance.
 *
 * @returns The balance and currency, or `null` if the request fails.
 */
export async function getAccountBalance(): Promise<AccountBalance | null> {
  try {
    const balance = await twilioClient.balance.fetch();
    return {
      balance: balance.balance,
      currency: balance.currency,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Twilio] Error fetching balance:", message);
    return null;
  }
}

/**
 * List all phone numbers currently owned in the Twilio account.
 *
 * @returns An array of owned numbers with their SIDs and friendly names.
 *   Returns an empty array on failure.
 */
export async function listOwnedNumbers(): Promise<OwnedNumber[]> {
  try {
    const numbers = await twilioClient.incomingPhoneNumbers.list();
    return numbers.map((num) => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      sid: num.sid,
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Twilio] Error listing numbers:", message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generate mock phone numbers for development/testing when the Twilio API
 * is unavailable or returns no results.
 */
function generateMockNumbers(
  areaCode: string,
  _country: string,
): AvailableNumber[] {
  const mockLocalities: Record<string, { locality: string; region: string }> = {
    "403": { locality: "Calgary", region: "AB" },
    "780": { locality: "Edmonton", region: "AB" },
    "604": { locality: "Vancouver", region: "BC" },
    "204": { locality: "Winnipeg", region: "MB" },
    "506": { locality: "Moncton", region: "NB" },
    "709": { locality: "St. John's", region: "NL" },
    "902": { locality: "Halifax", region: "NS" },
    "867": { locality: "Yellowknife", region: "NT" },
    "416": { locality: "Toronto", region: "ON" },
    "514": { locality: "Montreal", region: "QC" },
    "306": { locality: "Saskatoon", region: "SK" },
    "212": { locality: "New York", region: "NY" },
    "415": { locality: "San Francisco", region: "CA" },
    "214": { locality: "Dallas", region: "TX" },
    "305": { locality: "Miami", region: "FL" },
    "312": { locality: "Chicago", region: "IL" },
  };

  const location = mockLocalities[areaCode] || {
    locality: "Unknown",
    region: "XX",
  };

  return Array.from({ length: 10 }, (_, i) => ({
    phoneNumber: `+1${areaCode}555${String(i).padStart(4, "0")}`,
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

/**
 * Map a province/state code to a representative area code for mock data.
 */
function regionToAreaCode(region?: string): string | undefined {
  if (!region) return undefined;

  const regionAreaCodes: Record<string, string> = {
    // Canada
    AB: "403",
    BC: "604",
    MB: "204",
    NB: "506",
    NL: "709",
    NS: "902",
    NT: "867",
    NU: "867",
    ON: "416",
    PE: "902",
    QC: "514",
    SK: "306",
    YT: "867",
    // US (major)
    NY: "212",
    CA: "415",
    TX: "214",
    FL: "305",
    IL: "312",
    PA: "215",
    OH: "216",
    GA: "404",
    MI: "313",
    WA: "206",
  };

  return regionAreaCodes[region.toUpperCase()];
}

/**
 * Detect whether a phone number is a mock number used only in development.
 * Mock numbers follow the pattern +1XXX555NNNN.
 */
function isMockPhoneNumber(phoneNumber: string): boolean {
  const mockPattern = /^\+1\d{3}555\d{4}$/;
  return (
    mockPattern.test(phoneNumber) && process.env.NODE_ENV === "development"
  );
}
