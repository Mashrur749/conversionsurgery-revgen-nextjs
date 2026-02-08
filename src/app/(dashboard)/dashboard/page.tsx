import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getDb,
  leads,
  conversations,
  dailyStats,
  scheduledMessages,
  clients,
} from "@/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const clientId = (session as any).client?.id;
  const isAdmin = (session as any).user?.isAdmin;

  // Redirect admins to Agency Dashboard
  if (isAdmin) {
    redirect("/admin");
  }

  if (!clientId) {
    return <div>No client linked to account</div>;
  }

  const db = getDb();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const stats = await db
    .select({
      messagesSent: (await import("drizzle-orm"))
        .sql`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, clientId),
        gte(dailyStats.date, sevenDaysAgoStr),
      ),
    );

  const weekStats = stats[0] || { messagesSent: 0 };

  const actionLeads = await db
    .select()
    .from(leads)
    .where(and(eq(leads.clientId, clientId), eq(leads.actionRequired, true)))
    .orderBy(desc(leads.updatedAt))
    .limit(5);

  const recentConvos = await db
    .select({
      conversation: conversations,
      lead: leads,
    })
    .from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id))
    .where(eq(conversations.clientId, clientId))
    .orderBy(desc(conversations.createdAt))
    .limit(10);

  const pendingCount = await db
    .select()
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.clientId, clientId),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false),
      ),
    );

  const totalLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.clientId, clientId));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Last 7 days overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(weekStats.messagesSent) || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount.length}</div>
            <p className="text-xs text-muted-foreground">Messages pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{actionLeads.length}</div>
            <p className="text-xs text-muted-foreground">
              Leads need attention
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Action Required
              {actionLeads.length > 0 && (
                <Badge variant="destructive">{actionLeads.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {actionLeads.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No actions needed 👍
              </p>
            ) : (
              <div className="space-y-3">
                {actionLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{lead.name || lead.phone}</p>
                        <p className="text-sm text-muted-foreground">
                          {lead.actionRequiredReason || "Action needed"}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatDistanceToNow(new Date(lead.updatedAt!), {
                          addSuffix: true,
                        })}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentConvos.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No conversations yet
                </p>
              ) : (
                recentConvos.map(({ conversation, lead }) => (
                  <Link
                    key={conversation.id}
                    href={`/leads/${lead.id}`}
                    className="block p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {lead.name || lead.phone}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.direction === "inbound" ? "← " : "→ "}
                          {conversation.content.substring(0, 60)}
                          {conversation.content.length > 60 ? "..." : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          conversation.direction === "inbound"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {conversation.direction}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
