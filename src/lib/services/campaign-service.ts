import {
  clients,
  dailyStats,
  getDb,
  leads,
  quarterlyCampaigns,
  systemSettings,
} from "@/db";
import type { QuarterlyCampaign } from "@/db/schema/quarterly-campaigns";
import type { QuarterlyCampaignType } from "@/lib/constants/quarterly-campaigns";
import { CAMPAIGN_REQUIRED_ASSETS } from "@/lib/constants/quarterly-campaigns";
import {
  deriveMissingQuarterKeys,
  getPlanningQuarterKeys,
  getQuarterStartDate,
  getQuarterKey,
  parseQuarterKey,
  recommendCampaignTypeForAccount,
} from "@/lib/services/quarterly-campaign-rules";
import {
  type QuarterlyCampaignAction,
  validateQuarterlyCampaignTransition,
} from "@/lib/services/quarterly-campaign-transition-guard";
import { toQuarterlyCampaignSummaryDto } from "@/lib/services/quarterly-campaign-summary";
import { sendEmail } from "@/lib/services/resend";
import { and, asc, desc, eq, inArray, lte, or, sql } from "drizzle-orm";

export interface CampaignPlanningResult {
  processedClients: number;
  created: number;
  skipped: number;
}

export interface CampaignDigestResult {
  skipped: boolean;
  reason?: string;
  sent: boolean;
  summary: {
    quarterKey: string;
    total: number;
    planned: number;
    scheduled: number;
    launched: number;
    completed: number;
    overdue: number;
  };
}

interface CampaignMetrics {
  inboundLeads30: number;
  reviewsRequested90: number;
  dormantLeadCount: number;
}

interface CreateCampaignDraftParams {
  clientId: string;
  quarterKey: string;
  campaignType: QuarterlyCampaignType;
  scheduledAt?: Date | null;
  createdBy?: string | null;
  planNotes?: string | null;
  timezone?: string | null;
}

export function getDefaultScheduledAtForQuarter(
  quarterKey: string,
  timezone?: string | null,
): Date {
  const start = getQuarterStartDate(quarterKey);
  // Target two weeks after quarter start at 10:00 local time for the client.
  const launchDate = new Date(start);
  launchDate.setUTCDate(launchDate.getUTCDate() + 14);

  const tz = timezone || 'America/New_York';
  try {
    // Find the UTC time that corresponds to 10:00am in the client's timezone on the target date.
    // Build a date string for "10am on that calendar date" in the target timezone.
    const localDateStr = launchDate.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
    const localAt10am = new Date(`${localDateStr}T10:00:00`);
    // Determine the UTC offset by comparing what the timezone reports for that instant.
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    // Use a known UTC time and resolve the offset for that date in the client's timezone.
    // We construct the target by interpreting the date as local midnight UTC and adjusting.
    const parts = formatter.formatToParts(new Date(`${localDateStr}T00:00:00Z`));
    const partsMap: Record<string, string> = {};
    for (const p of parts) {
      partsMap[p.type] = p.value;
    }
    // The timezone's local time at UTC midnight for that date tells us the UTC offset.
    const localHourAtUTCMidnight = parseInt(partsMap['hour'] ?? '0', 10);
    const localMinuteAtUTCMidnight = parseInt(partsMap['minute'] ?? '0', 10);
    // Minutes since midnight in local time at UTC midnight
    const localMinutesAtUTCMidnight = localHourAtUTCMidnight * 60 + localMinuteAtUTCMidnight;
    // We want 10:00am local = 600 minutes from local midnight
    const targetMinutesFromUTCMidnight = 600 - localMinutesAtUTCMidnight;
    const result = new Date(`${localDateStr}T00:00:00Z`);
    result.setUTCMinutes(result.getUTCMinutes() + targetMinutesFromUTCMidnight);
    return result;
  } catch {
    // Fallback: 10:00 UTC if timezone is invalid
    const fallback = new Date(launchDate);
    fallback.setUTCHours(10, 0, 0, 0);
    return fallback;
  }
}

async function getClientCampaignMetrics(
  clientId: string,
  now: Date,
): Promise<CampaignMetrics> {
  const db = getDb();
  const date30 = new Date(now);
  date30.setUTCDate(date30.getUTCDate() - 30);
  const date90 = new Date(now);
  date90.setUTCDate(date90.getUTCDate() - 90);

  const [rolling] = await db
    .select({
      inboundLeads30: sql<number>`COALESCE(SUM(CASE WHEN ${dailyStats.date} >= ${date30.toISOString().slice(0, 10)} THEN ${dailyStats.missedCallsCaptured} + ${dailyStats.formsResponded} ELSE 0 END), 0)`,
      reviewsRequested90: sql<number>`COALESCE(SUM(CASE WHEN ${dailyStats.date} >= ${date90.toISOString().slice(0, 10)} THEN ${dailyStats.reviewsRequested} ELSE 0 END), 0)`,
    })
    .from(dailyStats)
    .where(eq(dailyStats.clientId, clientId));

  const [dormant] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leads)
    .where(and(eq(leads.clientId, clientId), eq(leads.status, "dormant")));

  return {
    inboundLeads30: Number(rolling?.inboundLeads30 || 0),
    reviewsRequested90: Number(rolling?.reviewsRequested90 || 0),
    dormantLeadCount: Number(dormant?.count || 0),
  };
}

export async function createQuarterlyCampaignDraft(
  params: CreateCampaignDraftParams,
): Promise<QuarterlyCampaign | null> {
  const db = getDb();
  const [created] = await db
    .insert(quarterlyCampaigns)
    .values({
      clientId: params.clientId,
      quarterKey: params.quarterKey,
      campaignType: params.campaignType,
      status: "planned",
      scheduledAt:
        params.scheduledAt ||
        getDefaultScheduledAtForQuarter(params.quarterKey, params.timezone),
      requiredAssets: CAMPAIGN_REQUIRED_ASSETS[params.campaignType],
      completedAssets: [],
      evidenceLinks: [],
      createdBy: params.createdBy || null,
      updatedBy: params.createdBy || null,
      planNotes: params.planNotes || null,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [quarterlyCampaigns.clientId, quarterlyCampaigns.quarterKey],
    })
    .returning();

  return created || null;
}

export async function planQuarterlyCampaigns(
  now: Date = new Date(),
): Promise<CampaignPlanningResult> {
  const db = getDb();
  const activeClients = await db
    .select({ id: clients.id, timezone: clients.timezone })
    .from(clients)
    .where(eq(clients.status, "active"));

  let created = 0;
  let skipped = 0;

  for (const client of activeClients) {
    const targetQuarterKeys = getPlanningQuarterKeys(now);
    const existing = await db
      .select({ quarterKey: quarterlyCampaigns.quarterKey })
      .from(quarterlyCampaigns)
      .where(
        and(
          eq(quarterlyCampaigns.clientId, client.id),
          inArray(quarterlyCampaigns.quarterKey, targetQuarterKeys),
        ),
      );

    const missingQuarterKeys = deriveMissingQuarterKeys(
      existing.map((entry) => entry.quarterKey),
      targetQuarterKeys,
    );

    if (missingQuarterKeys.length === 0) {
      skipped++;
      continue;
    }

    const metrics = await getClientCampaignMetrics(client.id, now);

    for (const quarterKey of missingQuarterKeys) {
      const { quarter } = parseQuarterKey(quarterKey);
      const campaignType = recommendCampaignTypeForAccount(metrics, quarter);
      const draft = await createQuarterlyCampaignDraft({
        clientId: client.id,
        quarterKey,
        campaignType,
        timezone: client.timezone,
      });
      if (draft) {
        created++;
      } else {
        skipped++;
      }
    }
  }

  return {
    processedClients: activeClients.length,
    created,
    skipped,
  };
}

export async function listClientQuarterlyCampaigns(
  clientId: string,
): Promise<QuarterlyCampaign[]> {
  const db = getDb();
  return db
    .select()
    .from(quarterlyCampaigns)
    .where(eq(quarterlyCampaigns.clientId, clientId))
    .orderBy(
      desc(quarterlyCampaigns.quarterKey),
      desc(quarterlyCampaigns.createdAt),
    )
    .limit(8);
}

export async function getCurrentQuarterlyCampaignSummary(
  clientId: string,
  now: Date = new Date(),
) {
  const db = getDb();
  const currentQuarterKey = getQuarterKey(now);

  const [current] = await db
    .select()
    .from(quarterlyCampaigns)
    .where(
      and(
        eq(quarterlyCampaigns.clientId, clientId),
        eq(quarterlyCampaigns.quarterKey, currentQuarterKey),
      ),
    )
    .limit(1);

  if (current) {
    return toQuarterlyCampaignSummaryDto(current);
  }

  const [latest] = await db
    .select()
    .from(quarterlyCampaigns)
    .where(eq(quarterlyCampaigns.clientId, clientId))
    .orderBy(desc(quarterlyCampaigns.quarterKey))
    .limit(1);

  if (!latest) {
    return null;
  }

  return toQuarterlyCampaignSummaryDto(latest);
}

export async function toggleCampaignAsset(params: {
  clientId: string;
  campaignId: string;
  assetKey: string;
  completed: boolean;
  actorUserId?: string | null;
}): Promise<QuarterlyCampaign> {
  const db = getDb();
  const [campaign] = await db
    .select()
    .from(quarterlyCampaigns)
    .where(
      and(
        eq(quarterlyCampaigns.id, params.campaignId),
        eq(quarterlyCampaigns.clientId, params.clientId),
      ),
    )
    .limit(1);

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (!campaign.requiredAssets.includes(params.assetKey)) {
    throw new Error("Asset is not required for this campaign");
  }

  const current = new Set(campaign.completedAssets || []);
  if (params.completed) {
    current.add(params.assetKey);
  } else {
    current.delete(params.assetKey);
  }

  const [updated] = await db
    .update(quarterlyCampaigns)
    .set({
      completedAssets: Array.from(current.values()).sort(),
      updatedBy: params.actorUserId || null,
      updatedAt: new Date(),
    })
    .where(eq(quarterlyCampaigns.id, campaign.id))
    .returning();

  return updated;
}

export async function addCampaignEvidence(params: {
  clientId: string;
  campaignId: string;
  evidence: string;
  actorUserId?: string | null;
}): Promise<QuarterlyCampaign> {
  const db = getDb();
  const [campaign] = await db
    .select()
    .from(quarterlyCampaigns)
    .where(
      and(
        eq(quarterlyCampaigns.id, params.campaignId),
        eq(quarterlyCampaigns.clientId, params.clientId),
      ),
    )
    .limit(1);

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const evidence = params.evidence.trim();
  if (!evidence) {
    throw new Error("Evidence cannot be empty");
  }

  const links = Array.isArray(campaign.evidenceLinks)
    ? [...campaign.evidenceLinks]
    : [];
  links.push(evidence);

  const [updated] = await db
    .update(quarterlyCampaigns)
    .set({
      evidenceLinks: links.slice(-20),
      updatedBy: params.actorUserId || null,
      updatedAt: new Date(),
    })
    .where(eq(quarterlyCampaigns.id, campaign.id))
    .returning();

  return updated;
}

export async function updateCampaignNotes(params: {
  clientId: string;
  campaignId: string;
  planNotes?: string | null;
  outcomeSummary?: string | null;
  actorUserId?: string | null;
}): Promise<QuarterlyCampaign> {
  const db = getDb();
  const [updated] = await db
    .update(quarterlyCampaigns)
    .set({
      ...(params.planNotes !== undefined
        ? { planNotes: params.planNotes }
        : {}),
      ...(params.outcomeSummary !== undefined
        ? { outcomeSummary: params.outcomeSummary }
        : {}),
      updatedBy: params.actorUserId || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quarterlyCampaigns.id, params.campaignId),
        eq(quarterlyCampaigns.clientId, params.clientId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Campaign not found");
  }

  return updated;
}

export async function applyCampaignAction(params: {
  clientId: string;
  campaignId: string;
  action: QuarterlyCampaignAction;
  actorUserId?: string | null;
  outcomeSummary?: string | null;
}): Promise<QuarterlyCampaign> {
  const db = getDb();
  const [campaign] = await db
    .select()
    .from(quarterlyCampaigns)
    .where(
      and(
        eq(quarterlyCampaigns.id, params.campaignId),
        eq(quarterlyCampaigns.clientId, params.clientId),
      ),
    )
    .limit(1);

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const transition = validateQuarterlyCampaignTransition(
    campaign.status,
    params.action,
    {
      completedAssets: campaign.completedAssets || [],
      requiredAssets: campaign.requiredAssets || [],
      outcomeSummary: params.outcomeSummary ?? campaign.outcomeSummary,
    },
  );

  if (!transition.ok || !transition.nextStatus) {
    throw new Error(transition.error || "Invalid transition");
  }

  const now = new Date();
  const patch: Partial<QuarterlyCampaign> = {
    status: transition.nextStatus,
    updatedBy: params.actorUserId || null,
    updatedAt: now,
  };

  if (params.action === "approve_plan") {
    patch.scheduledAt = campaign.scheduledAt || now;
  }
  if (params.action === "launch_campaign") {
    patch.launchedAt = now;
  }
  if (params.action === "complete_campaign") {
    patch.completedAt = now;
    patch.outcomeSummary = params.outcomeSummary || campaign.outcomeSummary;
  }

  const [updated] = await db
    .update(quarterlyCampaigns)
    .set(patch)
    .where(eq(quarterlyCampaigns.id, campaign.id))
    .returning();

  return updated;
}

export async function getQuarterlyCampaignPortfolioSummary(
  now: Date = new Date(),
) {
  const db = getDb();
  const quarterKey = getQuarterKey(now);

  const rows = await db
    .select({
      id: quarterlyCampaigns.id,
      clientId: quarterlyCampaigns.clientId,
      businessName: clients.businessName,
      status: quarterlyCampaigns.status,
      campaignType: quarterlyCampaigns.campaignType,
      scheduledAt: quarterlyCampaigns.scheduledAt,
      quarterKey: quarterlyCampaigns.quarterKey,
    })
    .from(quarterlyCampaigns)
    .innerJoin(clients, eq(quarterlyCampaigns.clientId, clients.id))
    .where(
      and(
        eq(clients.status, "active"),
        eq(quarterlyCampaigns.quarterKey, quarterKey),
      ),
    )
    .orderBy(asc(clients.businessName));

  const counts = {
    total: rows.length,
    planned: rows.filter((row) => row.status === "planned").length,
    scheduled: rows.filter((row) => row.status === "scheduled").length,
    launched: rows.filter((row) => row.status === "launched").length,
    completed: rows.filter((row) => row.status === "completed").length,
  };

  const overdue = rows.filter(
    (row) =>
      (row.status === "planned" || row.status === "scheduled") &&
      !!row.scheduledAt &&
      row.scheduledAt < now,
  );

  return {
    quarterKey,
    counts: {
      ...counts,
      overdue: overdue.length,
    },
    overdue,
  };
}

function getIsoWeekKey(now: Date): string {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function getSettingValue(key: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return row?.value || null;
}

async function setSettingValue(
  key: string,
  value: string,
  description: string,
): Promise<void> {
  const db = getDb();
  await db
    .insert(systemSettings)
    .values({ key, value, description })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function sendQuarterlyCampaignAdminDigest(params?: {
  now?: Date;
  alertsOnly?: boolean;
}): Promise<CampaignDigestResult> {
  const now = params?.now || new Date();
  const alertsOnly = params?.alertsOnly ?? false;
  const adminEmail = process.env.ADMIN_EMAIL || "rmashrur749@gmail.com";
  const summary = await getQuarterlyCampaignPortfolioSummary(now);

  if (alertsOnly && summary.counts.overdue === 0) {
    return {
      skipped: true,
      reason: "No overdue campaigns",
      sent: false,
      summary: {
        quarterKey: summary.quarterKey,
        ...summary.counts,
      },
    };
  }

  const idempotencyKey = alertsOnly
    ? `quarterly_campaign_alert_digest_${now.toISOString().slice(0, 10)}`
    : `quarterly_campaign_weekly_digest_${getIsoWeekKey(now)}`;
  const settingKey = alertsOnly
    ? "last_quarterly_campaign_alert_digest_key"
    : "last_quarterly_campaign_weekly_digest_key";

  const lastKey = await getSettingValue(settingKey);
  if (lastKey === idempotencyKey) {
    return {
      skipped: true,
      reason: "Digest already sent for this run key",
      sent: false,
      summary: {
        quarterKey: summary.quarterKey,
        ...summary.counts,
      },
    };
  }

  const overdueListHtml = summary.overdue
    .slice(0, 20)
    .map(
      (item) =>
        `<li><strong>${item.businessName}</strong> — ${item.campaignType} (${item.status}) target ${item.scheduledAt?.toISOString().slice(0, 10) || "n/a"}</li>`,
    )
    .join("");

  const subjectPrefix = alertsOnly ? "[Alert]" : "[Digest]";

  await sendEmail({
    to: adminEmail,
    subject: `${subjectPrefix} Quarterly Campaign Progress — ${summary.quarterKey}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Quarterly Campaign Progress (${summary.quarterKey})</h2>
        <p>Total: <strong>${summary.counts.total}</strong></p>
        <ul>
          <li>Planned: ${summary.counts.planned}</li>
          <li>Scheduled: ${summary.counts.scheduled}</li>
          <li>Launched: ${summary.counts.launched}</li>
          <li>Completed: ${summary.counts.completed}</li>
          <li>Overdue: ${summary.counts.overdue}</li>
        </ul>
        ${
          summary.counts.overdue > 0
            ? `<h3>Missed-quarter alert candidates</h3><ul>${overdueListHtml}</ul>`
            : "<p>No overdue campaigns at this time.</p>"
        }
      </div>
    `,
  });

  await setSettingValue(
    settingKey,
    idempotencyKey,
    alertsOnly
      ? "Last quarterly campaign alert digest key"
      : "Last quarterly campaign weekly digest key",
  );

  return {
    skipped: false,
    sent: true,
    summary: {
      quarterKey: summary.quarterKey,
      ...summary.counts,
    },
  };
}
