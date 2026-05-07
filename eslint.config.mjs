import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

// Compliance bypass guard — direct `import twilio from 'twilio'` is forbidden
// outside the narrow whitelist below. New SMS senders MUST go through
// sendCompliantMessage() (lead-facing) or sendInternalSMS() (operator-facing)
// from `@/lib/compliance/compliance-gateway`.
const TWILIO_IMPORT_BAN = {
	rules: {
		"no-restricted-imports": [
			"error",
			{
				paths: [
					{
						name: "twilio",
						message:
							"Direct twilio imports are forbidden. Use sendCompliantMessage() (lead-facing) or sendInternalSMS() (operator) from @/lib/compliance/compliance-gateway.",
					},
				],
			},
		],
	},
};

// Files allowed to import the raw twilio SDK. Each one is intentionally narrow:
// - twilio.ts owns the privileged client (only reachable from compliance-gateway).
// - twilio-provisioning.ts manages phone numbers (admin, no SMS send).
// - ring-group.ts orchestrates Voice (TwiML) which is not the SMS surface.
// - webhooks/twilio/** validates inbound webhook signatures.
// - cron/check-missed-calls reads Call resources (no send).
const TWILIO_IMPORT_ALLOW = {
	files: [
		"src/lib/services/twilio.ts",
		"src/lib/services/twilio-provisioning.ts",
		"src/lib/services/ring-group.ts",
		"src/app/api/webhooks/twilio/**/*.ts",
		"src/app/api/cron/check-missed-calls/route.ts",
	],
	rules: {
		"no-restricted-imports": "off",
	},
};

const eslintConfig = [
	...compat.extends("next/core-web-vitals", "next/typescript"),
	TWILIO_IMPORT_BAN,
	TWILIO_IMPORT_ALLOW,
];

export default eslintConfig;
