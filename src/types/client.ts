export interface ClientFeatureFlags {
  // Core SMS
  missedCallSmsEnabled: boolean;
  aiResponseEnabled: boolean;

  // AI Agent
  aiAgentEnabled: boolean;
  aiAgentMode: 'off' | 'assist' | 'autonomous';
  autoEscalationEnabled: boolean;

  // Voice
  voiceEnabled: boolean;
  voiceMode: 'always' | 'after_hours' | 'overflow';

  // Automation
  flowsEnabled: boolean;
  leadScoringEnabled: boolean;

  // Integrations
  calendarSyncEnabled: boolean;
  hotTransferEnabled: boolean;
  paymentLinksEnabled: boolean;

  // Reputation
  reputationMonitoringEnabled: boolean;
  autoReviewResponseEnabled: boolean;

  // Communication
  photoRequestsEnabled: boolean;
  multiLanguageEnabled: boolean;
  preferredLanguage: string;

  // Notifications (existing)
  notificationEmail: boolean;
  notificationSms: boolean;
  weeklySummaryEnabled: boolean;
}
