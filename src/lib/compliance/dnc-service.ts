import { getDb, doNotContactList } from '@/db';
import { ComplianceService } from './compliance-service';
import { eq, and, or, isNull, inArray } from 'drizzle-orm';

export interface DncImportResult {
  total: number;
  added: number;
  duplicates: number;
  errors: number;
}

export class DncService {
  /**
   * Add a single number to DNC list
   */
  static async addToDnc(
    phoneNumber: string,
    source: string,
    clientId?: string,
    sourceReference?: string,
    expiresAt?: Date
  ): Promise<void> {
    const db = getDb();
    const normalizedPhone =
      ComplianceService.normalizePhoneNumber(phoneNumber);
    const phoneHash = ComplianceService.hashPhoneNumber(normalizedPhone);

    // Check if already exists
    const existing = await db.query.doNotContactList.findFirst({
      where: and(
        eq(doNotContactList.phoneNumberHash, phoneHash),
        clientId
          ? eq(doNotContactList.clientId, clientId)
          : isNull(doNotContactList.clientId),
        eq(doNotContactList.isActive, true)
      ),
    });

    if (existing) {
      return; // Already on list
    }

    await db.insert(doNotContactList).values({
      clientId,
      phoneNumber: normalizedPhone,
      phoneNumberHash: phoneHash,
      source,
      sourceReference,
      expiresAt,
      isActive: true,
    });

    await ComplianceService.logComplianceEvent(
      clientId || null,
      'dnc_added',
      {
        phoneNumber: normalizedPhone,
        phoneHash,
        source,
      }
    );
  }

  /**
   * Remove from DNC list
   */
  static async removeFromDnc(
    phoneNumber: string,
    clientId?: string,
    reason?: string
  ): Promise<void> {
    const db = getDb();
    const normalizedPhone =
      ComplianceService.normalizePhoneNumber(phoneNumber);
    const phoneHash = ComplianceService.hashPhoneNumber(normalizedPhone);

    await db
      .update(doNotContactList)
      .set({
        isActive: false,
        removedAt: new Date(),
        removeReason: reason,
      })
      .where(
        and(
          eq(doNotContactList.phoneNumberHash, phoneHash),
          clientId
            ? eq(doNotContactList.clientId, clientId)
            : isNull(doNotContactList.clientId),
          eq(doNotContactList.isActive, true)
        )
      );

    await ComplianceService.logComplianceEvent(
      clientId || null,
      'dnc_removed',
      {
        phoneNumber: normalizedPhone,
        phoneHash,
        reason,
      }
    );
  }

  /**
   * Bulk import DNC list (e.g., from national registry)
   */
  static async bulkImport(
    phoneNumbers: string[],
    source: string,
    clientId?: string
  ): Promise<DncImportResult> {
    const db = getDb();
    const result: DncImportResult = {
      total: phoneNumbers.length,
      added: 0,
      duplicates: 0,
      errors: 0,
    };

    // Batch process in chunks of 1000
    const chunkSize = 1000;
    for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
      const chunk = phoneNumbers.slice(i, i + chunkSize);

      const records = chunk
        .map((phone) => {
          try {
            const normalizedPhone =
              ComplianceService.normalizePhoneNumber(phone);
            const phoneHash =
              ComplianceService.hashPhoneNumber(normalizedPhone);
            return {
              clientId,
              phoneNumber: normalizedPhone,
              phoneNumberHash: phoneHash,
              source,
              isActive: true as const,
            };
          } catch {
            result.errors++;
            return null;
          }
        })
        .filter(
          (r): r is NonNullable<typeof r> => r !== null
        );

      // Get existing hashes
      const hashes = records.map((r) => r.phoneNumberHash);
      if (hashes.length === 0) continue;

      const existing = await db
        .select({ phoneNumberHash: doNotContactList.phoneNumberHash })
        .from(doNotContactList)
        .where(
          and(
            inArray(doNotContactList.phoneNumberHash, hashes),
            eq(doNotContactList.isActive, true)
          )
        );

      const existingSet = new Set(existing.map((e) => e.phoneNumberHash));

      const newRecords = records.filter(
        (r) => !existingSet.has(r.phoneNumberHash)
      );
      result.duplicates += records.length - newRecords.length;

      if (newRecords.length > 0) {
        await db.insert(doNotContactList).values(newRecords);
        result.added += newRecords.length;
      }
    }

    await ComplianceService.logComplianceEvent(
      clientId || null,
      'dnc_bulk_import',
      {
        source,
        ...result,
      }
    );

    return result;
  }

  /**
   * Check if number is on DNC list
   */
  static async isOnDnc(
    phoneNumber: string,
    clientId?: string
  ): Promise<boolean> {
    const db = getDb();
    const phoneHash = ComplianceService.hashPhoneNumber(
      ComplianceService.normalizePhoneNumber(phoneNumber)
    );

    const entry = await db.query.doNotContactList.findFirst({
      where: and(
        eq(doNotContactList.phoneNumberHash, phoneHash),
        eq(doNotContactList.isActive, true),
        or(
          isNull(doNotContactList.clientId),
          clientId
            ? eq(doNotContactList.clientId, clientId)
            : undefined
        )
      ),
    });

    return !!entry;
  }
}
