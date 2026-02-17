export const LEAD_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'estimate_sent', label: 'Estimate Sent' },
  { value: 'appointment_scheduled', label: 'Appointment' },
  { value: 'action_required', label: 'Action Required' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'opted_out', label: 'Opted Out' },
] as const;

export const LEAD_SOURCES = [
  { value: 'missed_call', label: 'Missed Call' },
  { value: 'form', label: 'Form' },
  { value: 'sms', label: 'SMS' },
  { value: 'manual', label: 'Manual' },
] as const;

export const LEAD_TEMPERATURES = [
  { value: 'hot', label: 'Hot', color: 'bg-[#FDEAE4] text-sienna' },
  { value: 'warm', label: 'Warm', color: 'bg-[#FFF3E0] text-terracotta-dark' },
  { value: 'cold', label: 'Cold', color: 'bg-sage-light text-forest' },
] as const;

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-sage-light text-forest',
  contacted: 'bg-[#FFF3E0] text-sienna',
  estimate_sent: 'bg-moss-light text-olive',
  appointment_scheduled: 'bg-[#E8F0E8] text-forest',
  action_required: 'bg-[#FDEAE4] text-sienna',
  won: 'bg-[#E8F5E9] text-[#3D7A50]',
  lost: 'bg-muted text-muted-foreground',
  opted_out: 'bg-muted text-muted-foreground',
};

export const TEMPERATURE_COLORS: Record<string, string> = {
  hot: 'bg-[#FDEAE4] text-sienna',
  warm: 'bg-[#FFF3E0] text-terracotta-dark',
  cold: 'bg-sage-light text-forest',
};

/** Bulk update targets — statuses that make sense for bulk operations. */
export const BULK_UPDATE_STATUSES = [
  'contacted', 'estimate_sent', 'appointment_scheduled', 'won', 'lost',
] as const;

/** Quick reply templates for the lead detail reply form. */
export const QUICK_REPLY_TEMPLATES = [
  { label: 'Thanks for reaching out', value: "Thanks for reaching out! We'd love to help. What can we do for you?" },
  { label: 'Check availability', value: "Let me check our availability and get back to you shortly!" },
  { label: 'Request more info', value: "Thanks for your interest! Could you tell me a bit more about what you're looking for?" },
  { label: 'Send estimate follow-up', value: "Just wanted to follow up on the estimate we discussed. Any questions or ready to move forward?" },
  { label: 'Confirm appointment', value: "Just confirming your upcoming appointment. See you then! Let us know if anything changes." },
  { label: 'Thank you', value: "Thank you so much! We really appreciate your business. Don't hesitate to reach out if you need anything." },
] as const;
