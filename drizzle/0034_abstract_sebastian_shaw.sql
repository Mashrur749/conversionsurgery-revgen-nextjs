ALTER TABLE "clients"
ADD COLUMN "reminder_routing_policy" jsonb DEFAULT '{
  "appointment_reminder_contractor": {
    "primaryRole": "owner",
    "fallbackRoles": ["assistant", "escalation_team"],
    "secondaryRoles": []
  },
  "booking_notification": {
    "primaryRole": "owner",
    "fallbackRoles": ["assistant", "escalation_team"],
    "secondaryRoles": []
  }
}'::jsonb;
