/**
 * Default message templates for various automation scenarios
 */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  // Automation 1: Missed Call
  missed_call: 'Hey, this is {{ownerName}} from {{businessName}}. Sorry I missed your call — I\'m with a customer right now. Call me back at {{businessPhone}} or reply and I\'ll get back to you. Reply STOP to opt out.',

  // Automation 2: Form Response
  form_response: 'Hey {{name}}, this is {{ownerName}} from {{businessName}}. Just got your request — thanks for reaching out! What can I help you with? Reply STOP to opt out.',

  // Automation 3: AI couldn't help — escalation ack
  escalation_ack: 'Thanks for your message. Let me get {{ownerName}} to personally follow up with you shortly.',

  // Appointment Reminders (Phase 4)
  appointment_day_before: 'Hi {{name}}, just a reminder about your estimate appointment tomorrow at {{time}} with {{businessName}}. See you at {{address}}. Reply CONFIRM to confirm or let me know if you need to reschedule.',
  appointment_2hr: 'Hi {{name}}, {{ownerName}} from {{businessName}} here. Just confirming I\'m heading your way for our {{time}} appointment. See you soon!',

  // Estimate Follow-up (Phase 4) — default templates
  estimate_day_2: 'Hi {{name}}, just checking in on the estimate I sent over. Any questions I can answer?',
  estimate_day_5: 'Hey {{name}}, wanted to make sure my estimate didn\'t get buried. I\'m booking for next month — let me know if you\'d like to get on the schedule.',
  estimate_day_10: 'Hi {{name}}, circling back one more time. If the project is on hold, no worries — just let me know. If you\'re ready to move forward, I\'ve got availability opening up. Or call us at {{businessPhone}} — happy to chat.',
  estimate_day_14: 'Hi {{name}}, last check-in on the estimate. If you\'ve decided to go another direction, no hard feelings. If you\'re still thinking about it, I\'m here when you\'re ready. Or call us at {{businessPhone}} — happy to chat.',

  // Estimate Follow-up — price comparison variants (lead is comparing quotes)
  estimate_day_2_price_comparison: 'Hi {{name}}, know you\'re comparing quotes — {{businessName}} can walk you through exactly what\'s included in the estimate. Happy to answer anything.',
  estimate_day_5_price_comparison: 'Hey {{name}}, just a follow-up on the estimate. {{businessName}} can walk you through exactly what\'s included if you\'re still comparing options.',
  estimate_day_10_price_comparison: 'Hi {{name}}, circling back on the estimate. If you\'re still comparing quotes, {{businessName}} is happy to break down what\'s included — just reply or call {{businessPhone}}.',
  estimate_day_14_price_comparison: 'Hi {{name}}, last check-in. If comparing quotes is still the hold-up, {{businessName}} can walk you through every line item. Here if you need us — {{businessPhone}}.',

  // Estimate Follow-up — timeline concern variants (lead is worried about timing)
  estimate_day_2_timeline_concern: 'Hi {{name}}, wanted to follow up — {{businessName}} has availability coming up if timing works for you.',
  estimate_day_5_timeline_concern: 'Hey {{name}}, just checking in. {{businessName}} has some openings coming up — happy to work around your schedule if timing is still the question.',
  estimate_day_10_timeline_concern: 'Hi {{name}}, circling back on the estimate. If timing is still uncertain, no rush — just let me know when you\'re ready and we\'ll find a slot. Or call {{businessPhone}}.',
  estimate_day_14_timeline_concern: 'Hi {{name}}, last follow-up. {{businessName}} can be flexible on timing — whenever you\'re ready, reach out or call {{businessPhone}}.',

  // Estimate Follow-up — partner approval variants (lead needs to consult someone)
  estimate_day_2_partner_approval: 'Hi {{name}}, just checking if you had a chance to discuss the estimate with your partner.',
  estimate_day_5_partner_approval: 'Hey {{name}}, just following up — have you had a chance to go over the estimate together? Happy to answer any questions either of you have.',
  estimate_day_10_partner_approval: 'Hi {{name}}, circling back in case you\'re still reviewing the estimate together. No rush — just reply or call {{businessPhone}} when you\'re ready.',
  estimate_day_14_partner_approval: 'Hi {{name}}, last check-in. Whenever you and your partner have had a chance to look it over, I\'m here. Feel free to call {{businessPhone}} too.',

  // Payment Reminders (Phase 4)
  payment_due: 'Hi {{name}}, friendly reminder that invoice #{{invoiceNumber}} for {{currencySymbol}}{{amount}} is due today. Here\'s a quick link to pay: {{paymentLink}}. To pay by phone, call {{businessPhone}}. Thanks!',
  payment_day_3: 'Hi {{name}}, following up on invoice #{{invoiceNumber}} for {{currencySymbol}}{{amount}}, now a few days past due. Please let me know if you have any questions. Pay here: {{paymentLink}} To pay by phone, call {{businessPhone}}.',
  payment_day_7: 'Hi {{name}}, just a reminder that invoice #{{invoiceNumber}} for {{currencySymbol}}{{amount}} is now 7 days past due. If there\'s an issue, let me know. Otherwise, here\'s the link: {{paymentLink}} To pay by phone, call {{businessPhone}}.',
  payment_day_14: 'Hi {{name}}, final reminder on invoice #{{invoiceNumber}} for {{currencySymbol}}{{amount}}, now 14 days past due. Please reach out if we need to discuss. Pay here: {{paymentLink}} To pay by phone, call {{businessPhone}}.',

  // Review & Referral (Phase 4)
  review_request: 'Hi {{name}}, thanks for trusting us with your {{projectType}}! If you were happy with the work, a quick Google review helps us a ton: {{googleBusinessUrl}}. Thanks so much!',
  referral_request: 'Thanks so much for trusting {{businessName}}! If you know anyone else who could use our services, we\'d love to help them out too. Referrals mean the world to a small business like ours.',

  // System
  opt_out_confirmation: 'You\'ve been unsubscribed. You won\'t receive further messages from {{businessName}}.',
  help_response: '{{businessName}}: For help, call {{ownerPhone}}. Reply STOP to opt out.',
};

/**
 * Render a message template with variable substitution
 * @param template - Template string or template type key
 * @param data - Variables to substitute in the template
 * @returns Rendered template with variables replaced
 */
export function renderTemplate(template: string, data: Record<string, any>): string {
  // If template is a key in DEFAULT_TEMPLATES, use that template
  let templateString = DEFAULT_TEMPLATES[template] || template;

  // Replace all {{variable}} placeholders with actual values
  for (const [key, value] of Object.entries(data)) {
    templateString = templateString.replace(
      new RegExp(`{{${key}}}`, 'g'),
      String(value ?? '')
    );
  }

  return templateString;
}
