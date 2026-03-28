# Tunnel + Dev Phone Setup

Quick-reference for running real-device SMS/voice tests locally.

## 1. ngrok tunnel

```bash
# Install (one-time)
brew install ngrok

# Start tunnel
ngrok http 3000

# Copy the https URL (e.g., https://abc123.ngrok-free.app)
```

## 2. Twilio webhook config

In [Twilio Console](https://console.twilio.com/) → Phone Numbers → Business Line (#1):

| Webhook | URL                                             | Method |
| ------- | ----------------------------------------------- | ------ |
| SMS     | `https://<ngrok-url>/api/webhooks/twilio/sms`   | POST   |
| Voice   | `https://<ngrok-url>/api/webhooks/twilio/voice` | POST   |

Add to `.dev.vars`:

```
TWILIO_WEBHOOK_BASE_URL=https://<ngrok-url>
```

> **Important:** Only configure webhooks on the **Business Line** (#1).
> Do NOT touch webhook config on Lead, Owner, or Team Member numbers —
> Dev Phone manages those automatically.

## 3. Dev Phone setup

```bash
# Install (one-time)
npm install -g twilio-cli
twilio plugins:install @twilio/plugin-dev-phone

# Start 3 instances in separate terminals:

# Terminal 1 — Lead
twilio dev-phone --port 3001
# Select Lead number (#2), text Business Line to simulate inbound leads

# Terminal 2 — Owner
twilio dev-phone --port 3002
# Select Owner number (#3), send SEND/EDIT/CANCEL commands

# Terminal 3 — Team Member
twilio dev-phone --port 3003
# Select Team Member number (#4), receive escalation SMS + hot transfer calls
```

## 4. Running order

1. `ngrok http 3000` — start tunnel
2. Configure Twilio webhooks (if not already done)
3. `npm run dev` — start app
4. `twilio dev-phone --port 3001` — lead
5. `twilio dev-phone --port 3002` — owner
6. `twilio dev-phone --port 3003` — team member
7. Run `setup-test-env.ts` if not already done

## 5. Troubleshooting

- **Dev Phone won't start:** Ensure `twilio login` has been run with valid credentials
- **Webhooks not firing:** Check ngrok dashboard at http://localhost:4040 for request logs
- **SMS not arriving in Dev Phone:** Verify you selected the correct number in the Dev Phone UI
- **Voice calls flaky in Dev Phone:** WebRTC quality varies — swap to a real phone for voice-specific tests
