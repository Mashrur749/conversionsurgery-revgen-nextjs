#!/bin/bash

# ConversionSurgery Spec Renaming Script
# Renames all spec files sequentially and copies to new folder

set -e

SOURCE_DIR="/mnt/user-data/outputs"
TARGET_DIR="/mnt/user-data/outputs/specs-final"

# Create target directory
mkdir -p "$TARGET_DIR"

echo "=========================================="
echo "ConversionSurgery Spec Renaming Script"
echo "=========================================="
echo ""
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo ""

# Counter for new file numbers
counter=1

# Function to copy and rename
rename_spec() {
  local old_name="$1"
  local new_name="$2"
  local padded=$(printf "%02d" $counter)
  
  if [ -f "$SOURCE_DIR/$old_name" ]; then
    cp "$SOURCE_DIR/$old_name" "$TARGET_DIR/${padded}-${new_name}"
    echo "✓ $padded: $old_name → ${padded}-${new_name}"
    ((counter++))
  else
    echo "⚠ MISSING: $old_name"
  fi
}

echo "--- PHASE 1: Admin Foundation (Executed) ---"
rename_spec "07a-admin-schema-auth.md" "admin-schema-auth.md"
rename_spec "07b-admin-ui-components.md" "admin-ui-components.md"
rename_spec "07c-admin-dashboard-pages.md" "admin-dashboard-pages.md"

echo ""
echo "--- PHASE 2: Team Management (Executed) ---"
rename_spec "08a-team-schema-service.md" "team-schema-service.md"
rename_spec "08b-claim-pages-sms-update.md" "claim-pages-sms-update.md"
rename_spec "08c-team-members-ui.md" "team-members-ui.md"

echo ""
echo "--- PHASE 3: Hot Transfer (Executed) ---"
rename_spec "09a-hot-transfer-schema-services.md" "hot-transfer-schema-services.md"
rename_spec "09b-hot-transfer-webhooks-ui.md" "hot-transfer-webhooks-ui.md"

echo ""
echo "--- PHASE 4: Client Management (Executed) ---"
rename_spec "10a-client-crud-api.md" "client-crud-api.md"
rename_spec "10b-client-management-ui.md" "client-management-ui.md"

echo ""
echo "--- PHASE 5: Twilio Provisioning (Executed) ---"
rename_spec "11a-twilio-provisioning-service.md" "twilio-provisioning-service.md"
rename_spec "11b-phone-number-ui.md" "phone-number-ui.md"

echo ""
echo "--- PHASE 6: Setup Wizard (Executed) ---"
rename_spec "13a-setup-wizard-flow.md" "setup-wizard-flow.md"
rename_spec "13b-setup-wizard-steps.md" "setup-wizard-steps.md"

echo ""
echo "--- PHASE 7: Usage Tracking (NEW) ---"
rename_spec "06b-usage-tracking.md" "usage-tracking.md"

echo ""
echo "--- PHASE 8: Client Dashboard & CRM ---"
rename_spec "12a-client-dashboard.md" "client-dashboard.md"
rename_spec "12b-crm-conversations.md" "crm-conversations.md"
rename_spec "12c-weekly-sms-summary.md" "weekly-sms-summary.md"

echo ""
echo "--- PHASE 9: Flow System ---"
rename_spec "14a-flow-schema.md" "flow-schema-templates.md"
rename_spec "14b-flow-builder-ui.md" "flow-builder-ui.md"
rename_spec "14c-ai-flow-triggering.md" "ai-flow-triggering.md"
rename_spec "14d-flow-metrics.md" "flow-metrics.md"

echo ""
echo "--- PHASE 10: Knowledge Base ---"
rename_spec "15a-knowledge-schema.md" "knowledge-schema.md"
rename_spec "15b-knowledge-ui.md" "knowledge-ui.md"
rename_spec "15c-ai-integration.md" "knowledge-ai-integration.md"

echo ""
echo "--- PHASE 11: Notifications & Cancellation ---"
rename_spec "16a-notification-preferences.md" "notification-preferences.md"
rename_spec "16b-cancellation-flow.md" "cancellation-flow.md"

echo ""
echo "--- PHASE 12: Revenue & Lead Scoring ---"
rename_spec "17a-revenue-attribution.md" "revenue-attribution.md"
rename_spec "17b-lead-scoring.md" "lead-scoring.md"

echo ""
echo "--- PHASE 13: Media & Payments ---"
rename_spec "18a-photo-handling.md" "photo-handling.md"
rename_spec "18b-payment-links.md" "payment-links.md"

echo ""
echo "--- PHASE 14: Reputation Management ---"
rename_spec "19a-reputation-monitoring.md" "reputation-monitoring.md"
rename_spec "19b-review-response-ai.md" "review-response-ai.md"

echo ""
echo "--- PHASE 15: Calendar Integration ---"
rename_spec "21-calendar-sync.md" "calendar-sync.md"

echo ""
echo "--- PHASE 16: Voice AI ---"
rename_spec "22-voice-ai.md" "voice-ai.md"

echo ""
echo "--- SKIPPED ---"
echo "⊘ 20-multi-language.md (skipped for now)"

echo ""
echo "=========================================="
echo "COMPLETE!"
echo "=========================================="
echo ""
echo "Total specs renamed: $((counter - 1))"
echo ""
echo "Files are now in: $TARGET_DIR"
echo ""

# List the new directory
echo "--- New Directory Contents ---"
ls -la "$TARGET_DIR"
