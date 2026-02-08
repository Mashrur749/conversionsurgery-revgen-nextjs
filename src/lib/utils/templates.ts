export const DEFAULT_TEMPLATES: Record<string, string> = {
  // Automation 1: Missed Call
  missed_call: 'Hey, this is {{ownerName}} from {{businessName}}. Sorry I missed your call — I\'m on a job site right now. What can I help you with? Reply STOP to opt out.',

  // Automation 2: Form Response
  form_response: 'Hey {{name}}, this is {{ownerName}} from {{businessName}}. Just got your request — thanks for reaching out! What project are you looking to get done? Reply STOP to opt out.',

  // Automation 3: AI couldn't help — escalation ack
  escalation_ack: 'Thanks for your message. Let me get {{ownerName}} to personally follow up with you shortly.',

  // Appointment Reminders (Phase 4)
  appointment_day_before: 'Hi {{name}}, just a reminder about your estimate appointment tomorrow at {{time}} with {{businessName}}. See you at {{address}}. Reply CONFIRM to confirm or let me know if you need to reschedule.',
  appointment_2hr: 'Hi {{name}}, {{ownerName}} from {{businessName}} here. Just confirming I\'m heading your way for our {{time}} appointment. See you soon!',

  // Estimate Follow-up (Phase 4)
  estimate_day_2: 'Hi {{name}}, just checking in on the estimate I sent over. Any questions I can answer?',
  estimate_day_5: 'Hey {{name}}, wanted to make sure my estimate didn\'t get buried. I\'m booking jobs for next month — let me know if you\'d like to get on the schedule.',
  estimate_day_10: 'Hi {{name}}, circling back one more time. If the project is on hold, no worries — just let me know. If you\'re ready to move forward, I\'ve got availability opening up.',
  estimate_day_14: 'Hi {{name}}, last check-in on the estimate. If you\'ve decided to go another direction, no hard feelings. If you\'re still thinking about it, I\'m here when you\'re ready.',

  // Payment Reminders (Phase 4)
  payment_due: 'Hi {{name}}, friendly reminder that invoice #{{invoiceNumber}} for {{currencySymbol}}{{amount}} is due today. Here\'s a quick link to pay: {{paymentLink}}. Thanks!',
  payment_day_3: 'Hi {{name}}, following up on invoice #{{invoiceNumber}} for {{currencySymbol}}{{amount}}, now a few days past due. Please let me know if you have any questions. Pay here: {{paymentLink}}',
  payment_day_7: 'Hi {{name}}, just a reminder that invoice #{{invoiceNumber}} for {{currencySymbol}}{{amount}} is now 7 days past due. If there\'s an issue, let me know. Otherwise, here\'s the link: {{paymentLink}}',
  payment_day_14: 'Hi {{name}}, final reminder on invoice #{{invoiceNumber}} for {{currencySymbol}}{{amount}}, now 14 days past due. Please reach out if we need to discuss. Pay here: {{paymentLink}}',

  // Review & Referral (Phase 4)
  review_request: 'Hi {{name}}, thanks again for choosing {{businessName}}! If you were happy with the work, a quick Google review helps us a ton: {{googleBusinessUrl}}. Thanks so much!',
  referral_request: 'Thanks so much for trusting us with your project! If you know anyone else who needs renovation work, we\'d love to help them out too. Referrals mean the world to a small business like ours.',

  // System
  opt_out_confirmation: 'You\'ve been unsubscribed. You won\'t receive further messages from {{businessName}}.',
};

export function renderTemplate(
  templateType: string,
  variables: Record<string, string | number | undefined>,
  customTemplate?: string
): string {
  let template = customTemplate || DEFAULT_TEMPLATES[templateType] || '';

  for (const [key, value] of Object.entries(variables)) {
    template = template.replace(
      new RegExp(`{{${key}}}`, 'g'),
      String(value ?? '')
    );
  }

  return template;
}
