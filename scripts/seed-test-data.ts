// Load .env.local
import 'dotenv/config';
import { getDb } from '@/db';
import { users, teamMembers, businessHours, clients } from '@/db/schema';
import { randomUUID } from 'crypto';

/**
 * Seed test data for testing Phases 7-9
 * Run with: npx tsx scripts/seed-test-data.ts
 */
async function seedTestData() {
  const db = getDb();

  console.log('🌱 Seeding test data for Phases 7-9...\n');

  try {
    // Generate UUIDs
    const adminId = randomUUID();
    const userId = randomUUID();
    const clientId = randomUUID();
    const tm1Id = randomUUID();
    const tm2Id = randomUUID();
    const tm3Id = randomUUID();

    // 1. Create test client first
    console.log('✓ Creating test client...');
    await db.insert(clients).values({
      id: clientId,
      businessName: 'Test Company',
      ownerName: 'Test Owner',
      email: 'test-client@test.local',
      phone: '+1555000000',
      timezone: 'America/Edmonton',
      isTest: true,
    }).onConflictDoNothing();

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
      { day: 0, isOpen: false, openTime: null, closeTime: null },    // Sunday
      { day: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Monday
      { day: 2, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Tuesday
      { day: 3, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Wednesday
      { day: 4, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Thursday
      { day: 5, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Friday
      { day: 6, isOpen: false, openTime: null, closeTime: null },    // Saturday
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
    console.log('');
    console.log('👥 Team Members:');
    console.log('   • John Doe (+1555000001) - Priority 1');
    console.log('   • Sarah Smith (+1555000002) - Priority 2');
    console.log('   • Mike Johnson (+1555000003) - Priority 3 (supervisor)');
    console.log('');
    console.log('⏰ Business Hours:');
    console.log('   • Monday-Friday: 09:00 - 17:00');
    console.log('   • Saturday-Sunday: Closed');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Go to http://localhost:3000/login');
    console.log('   2. Enter: admin@test.local');
    console.log('   3. Check your email for magic link');
    console.log('   4. Click link and start testing');
    console.log('   5. Follow TESTING_GUIDE.md for comprehensive tests');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  }
}

seedTestData();
