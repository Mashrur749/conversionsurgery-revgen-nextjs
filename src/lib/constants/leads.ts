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
  { value: 'hot', label: 'Hot', color: 'bg-red-100 text-red-800' },
  { value: 'warm', label: 'Warm', color: 'bg-orange-100 text-orange-800' },
  { value: 'cold', label: 'Cold', color: 'bg-blue-100 text-blue-800' },
] as const;

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  estimate_sent: 'bg-purple-100 text-purple-800',
  appointment_scheduled: 'bg-indigo-100 text-indigo-800',
  action_required: 'bg-red-100 text-red-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800',
  opted_out: 'bg-gray-100 text-gray-800',
};

export const TEMPERATURE_COLORS: Record<string, string> = {
  hot: 'bg-red-100 text-red-800',
  warm: 'bg-orange-100 text-orange-800',
  cold: 'bg-blue-100 text-blue-800',
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
