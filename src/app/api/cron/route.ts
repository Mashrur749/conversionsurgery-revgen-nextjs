import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  
  // Get cron identifier from Cloudflare
  const cronId = request.headers.get('cf-cron');
  
  if (!cronId) {
    return NextResponse.json({ error: 'Not a cron request' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    // Every 5 minutes - process scheduled messages
    const processResponse = await fetch(`${baseUrl}/api/cron/process-scheduled`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    const processResult = await processResponse.json();

    // Check if this is Monday 7am UTC for weekly summary
    const now = new Date();
    if (now.getUTCDay() === 1 && now.getUTCHours() === 7 && now.getUTCMinutes() < 10) {
      const summaryResponse = await fetch(`${baseUrl}/api/cron/weekly-summary`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const summaryResult = await summaryResponse.json();
      
      return NextResponse.json({
        scheduled: processResult,
        weeklySummary: summaryResult,
      });
    }

    return NextResponse.json({ scheduled: processResult });
  } catch (error) {
    console.error('Cron handler error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
