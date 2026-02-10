import { getDb } from '@/db';
import { escalationRules } from '@/db/schema';

export async function seedDefaultEscalationRules(clientId: string) {
  const db = getDb();

  const defaultRules = [
    {
      clientId,
      name: 'Explicit Human Request',
      description:
        'Customer asks to speak with a human, manager, or owner',
      conditions: {
        triggers: [
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'speak to human',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'talk to someone',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'real person',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'manager',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'owner',
            caseSensitive: false,
          },
        ],
      },
      action: {
        priority: 1,
        assignTo: 'owner',
        notifyVia: ['sms' as const, 'push' as const],
        autoResponse:
          "I'm connecting you with a member of our team right now. They'll be with you shortly!",
        pauseAi: true,
      },
      priority: 10,
    },
    {
      clientId,
      name: 'Legal/Complaint Threat',
      description:
        'Customer mentions lawyer, BBB, complaint, or legal action',
      conditions: {
        triggers: [
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'lawyer',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'attorney',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'BBB',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'better business',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'sue',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'legal action',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'file a complaint',
            caseSensitive: false,
          },
        ],
      },
      action: {
        priority: 1,
        assignTo: 'owner',
        notifyVia: ['sms' as const, 'email' as const, 'push' as const],
        autoResponse:
          'I understand you have serious concerns. Let me get the owner on the line to address this personally.',
        pauseAi: true,
      },
      priority: 5,
    },
    {
      clientId,
      name: 'Frustrated Customer',
      description: 'Detected negative/frustrated sentiment',
      conditions: {
        triggers: [
          {
            type: 'sentiment' as const,
            operator: 'equals' as const,
            value: 'frustrated',
          },
        ],
      },
      action: {
        priority: 2,
        assignTo: 'round_robin',
        notifyVia: ['push' as const],
        pauseAi: false,
      },
      priority: 50,
    },
    {
      clientId,
      name: 'High Value Lead',
      description: 'Estimated project value over $10,000',
      conditions: {
        triggers: [
          {
            type: 'value_threshold' as const,
            operator: 'greater_than' as const,
            value: 10000,
          },
        ],
      },
      action: {
        priority: 2,
        assignTo: 'owner',
        notifyVia: ['sms' as const, 'push' as const],
        pauseAi: false,
      },
      priority: 60,
    },
    {
      clientId,
      name: 'Emergency/Safety',
      description:
        'Customer mentions emergency, flood, fire, safety issue',
      conditions: {
        triggers: [
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'emergency',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'flooding',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'fire damage',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'gas leak',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'dangerous',
            caseSensitive: false,
          },
          {
            type: 'keyword' as const,
            operator: 'contains' as const,
            value: 'urgent',
            caseSensitive: false,
          },
        ],
      },
      action: {
        priority: 1,
        assignTo: 'owner',
        notifyVia: ['sms' as const, 'push' as const],
        autoResponse:
          "This sounds urgent. I'm alerting our team immediately and someone will contact you right away.",
        pauseAi: true,
      },
      priority: 1,
    },
  ];

  await db.insert(escalationRules).values(defaultRules);
}
