// Load .env.local
import 'dotenv/config';
import { getDb } from '@/db';
import {
  users,
  teamMembers,
  businessHours,
  clients,
  dailyStats,
  abTests,
  reports,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Seed comprehensive test data for all features
 * Includes: users, clients, team members, business hours, daily stats, A/B tests, reports
 * Run with: npx tsx scripts/seed-test-data.ts
 */
async function seedTestData() {
  const db = getDb();

  console.log('🌱 Seeding comprehensive test data...\n');

  try {
    // Generate UUIDs
    const adminId = randomUUID();
    const userId = randomUUID();
    let clientId: string;
    const tm1Id = randomUUID();
    const tm2Id = randomUUID();
    const tm3Id = randomUUID();
    const testId = randomUUID();
    const reportId = randomUUID();

    // 1. Create test client first
    console.log('✓ Creating test client...');

    // Check if test client already exists
    const existingClient = await db
      .select()
      .from(clients)
      .where(eq(clients.email, 'test-client@test.local'))
      .limit(1);

    if (existingClient.length > 0) {
      clientId = existingClient[0].id;
      console.log('   (Using existing test client)');
    } else {
      clientId = randomUUID();
      await db.insert(clients).values({
        id: clientId,
        businessName: 'Test Company',
        ownerName: 'Test Owner',
        email: 'test-client@test.local',
        phone: '+1555000000',
        timezone: 'America/Edmonton',
        status: 'active',
        isTest: true,
      });
    }

    // 2. Create admin user
    console.log('✓ Creating admin user...');
    await db.insert(users).values({
      id: adminId,
      email: 'admin@test.local',
      isAdmin: true,
      createdAt: new Date(),
    }).onConflictDoNothing();

    // 3. Create regular user
    console.log('✓ Creating regular user...');
    await db.insert(users).values({
      id: userId,
      email: 'user@test.local',
      isAdmin: false,
      createdAt: new Date(),
    }).onConflictDoNothing();

    // 4. Create team members for test client
    console.log('✓ Creating team members...');
    await db.insert(teamMembers).values([
      {
        id: tm1Id,
        clientId: clientId,
        name: 'John Doe',
        phone: '+1555000001',
        email: 'john@test.local',
        role: 'agent',
        receiveEscalations: true,
        receiveHotTransfers: true,
        priority: 1,
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: tm2Id,
        clientId: clientId,
        name: 'Sarah Smith',
        phone: '+1555000002',
        email: 'sarah@test.local',
        role: 'agent',
        receiveEscalations: true,
        receiveHotTransfers: true,
        priority: 2,
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: tm3Id,
        clientId: clientId,
        name: 'Mike Johnson',
        phone: '+1555000003',
        email: 'mike@test.local',
        role: 'supervisor',
        receiveEscalations: true,
        receiveHotTransfers: false,
        priority: 3,
        isActive: true,
        createdAt: new Date(),
      },
    ]).onConflictDoNothing();

    // 5. Initialize business hours (Mon-Fri 9AM-5PM)
    console.log('✓ Creating business hours...');
    const businessHoursData = [
      { day: 0, isOpen: false, openTime: null, closeTime: null }, // Sunday
      { day: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Monday
      { day: 2, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Tuesday
      { day: 3, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Wednesday
      { day: 4, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Thursday
      { day: 5, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Friday
      { day: 6, isOpen: false, openTime: null, closeTime: null }, // Saturday
    ];

    for (const { day, isOpen, openTime, closeTime } of businessHoursData) {
      await db.insert(businessHours).values({
        clientId: clientId,
        dayOfWeek: day,
        openTime,
        closeTime,
        isOpen,
        createdAt: new Date(),
      }).onConflictDoNothing();
    }

    // 6. Create daily stats for last 14 days (for reports and dashboard)
    console.log('✓ Creating daily stats...');
    const today = new Date();
    const dailyStatsData = [];

    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      dailyStatsData.push({
        clientId: clientId,
        date: dateStr as any,
        messagesSent: Math.floor(Math.random() * 50) + 10,
        conversationsStarted: Math.floor(Math.random() * 20) + 3,
        appointmentsReminded: Math.floor(Math.random() * 8) + 1,
        formsResponded: Math.floor(Math.random() * 15) + 2,
        estimatesFollowedUp: Math.floor(Math.random() * 10) + 1,
        reviewsRequested: Math.floor(Math.random() * 5),
        referralsRequested: Math.floor(Math.random() * 3),
        paymentsReminded: Math.floor(Math.random() * 5) + 1,
        missedCallsCaptured: Math.floor(Math.random() * 3),
        createdAt: new Date(),
      });
    }

    await db.insert(dailyStats).values(dailyStatsData).onConflictDoNothing();

    // 7. Create A/B test for agency dashboard
    try {
      console.log('✓ Creating A/B test...');
      const testStartDate = new Date();
      testStartDate.setDate(testStartDate.getDate() - 7);

      await db
        .insert(abTests)
        .values({
          id: testId,
          clientId: clientId,
          name: 'Messaging Template Test',
          description: 'Testing template A vs template B for engagement',
          testType: 'messaging',
          status: 'active',
          variantA: {
            name: 'Template A',
            description: 'Friendly tone',
            messageTemplate: 'Hi {name}, how are you?',
          },
          variantB: {
            name: 'Template B',
            description: 'Professional tone',
            messageTemplate: 'Hello {name}, following up on...',
          },
          startDate: testStartDate,
          endDate: null,
          winner: null,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    } catch (e) {
      console.log('   (Skipped - A/B test table not yet migrated)');
    }

    // 8. Create generated report for bi-weekly period
    try {
      console.log('✓ Creating sample report...');
      const reportStartDate = new Date(today);
      reportStartDate.setDate(reportStartDate.getDate() - 14);
      const reportEndDate = new Date(today);

      const reportMetrics = {
        messagesSent: 312,
        conversationsStarted: 65,
        appointmentsReminded: 28,
        formsResponded: 42,
        estimatesFollowedUp: 18,
        reviewsRequested: 12,
        referralsRequested: 5,
        paymentsReminded: 21,
        missedCallsCaptured: 8,
        days: 14,
      };

      const roiSummary = {
        messagesSent: 312,
        appointmentsReminded: 28,
        conversionRate: 8.97,
        engagementRate: 20.83,
        daysInPeriod: 14,
        averagePerDay: '22.3',
      };

      const teamPerformance = {
        totalMembers: 3,
        activeMembers: 3,
      };

      await db
        .insert(reports)
        .values({
          id: reportId,
          clientId: clientId,
          title: 'Bi-Weekly Report - Test Company',
          reportType: 'bi-weekly',
          startDate: reportStartDate.toISOString().split('T')[0] as any,
          endDate: reportEndDate.toISOString().split('T')[0] as any,
          metrics: reportMetrics as any,
          performanceData: dailyStatsData as any,
          testResults: null,
          teamPerformance: teamPerformance as any,
          roiSummary: roiSummary as any,
          notes: 'Sample bi-weekly report for testing dashboard and reporting features.',
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    } catch (e) {
      console.log('   (Skipped - Reports table not yet migrated)');
    }

    console.log('\n✅ Test data seeded successfully!\n');
    console.log('📋 Test Credentials:');
    console.log('   Admin User:');
    console.log('     • Email: admin@test.local');
    console.log('     • isAdmin: true');
    console.log('');
    console.log('   Regular User:');
    console.log('     • Email: user@test.local');
    console.log('     • isAdmin: false');
    console.log('');
    console.log('🏢 Test Client:');
    console.log('     • Business Name: Test Company');
    console.log('     • Email: test-client@test.local');
    console.log('     • Status: active');
    console.log('');
    console.log('👥 Team Members:');
    console.log('   • John Doe (+1555000001) - Priority 1 (agent)');
    console.log('   • Sarah Smith (+1555000002) - Priority 2 (agent)');
    console.log('   • Mike Johnson (+1555000003) - Priority 3 (supervisor)');
    console.log('');
    console.log('⏰ Business Hours:');
    console.log('   • Monday-Friday: 09:00 - 17:00');
    console.log('   • Saturday-Sunday: Closed');
    console.log('');
    console.log('📊 Dashboard Data:');
    console.log('   • Daily stats for last 14 days');
    console.log('   • 312 messages sent with 8.97% conversion rate');
    console.log('   • 28 appointments reminded from conversations');
    console.log('');
    console.log('🧪 A/B Testing:');
    console.log('   • Messaging Template Test (active)');
    console.log('   • Variant A: Friendly tone');
    console.log('   • Variant B: Professional tone');
    console.log('');
    console.log('📈 Reports:');
    console.log('   • Bi-weekly report generated');
    console.log('   • Period: Last 14 days');
    console.log('   • ROI Summary included');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Go to http://localhost:3000/login');
    console.log('   2. Enter: admin@test.local');
    console.log('   3. Check your email for magic link');
    console.log('   4. Visit /admin to see Agency Dashboard');
    console.log('   5. Visit /admin/reports to see generated reports');
    console.log('   6. Visit /admin/ab-tests to see A/B test');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  }
}

seedTestData();
