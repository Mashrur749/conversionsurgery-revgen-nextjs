import { describe, expect, it } from 'vitest';
import { buildAppointmentReminderPlan } from './appointment-reminder';

describe('buildAppointmentReminderPlan', () => {
  it('creates four reminders (lead + contractor, day-before + 2-hour) when fully in future', () => {
    const now = new Date('2026-02-10T12:00:00Z');
    const appointment = new Date('2026-02-12T18:00:00Z');

    const plan = buildAppointmentReminderPlan(appointment, now, true);

    expect(plan).toHaveLength(4);
    expect(plan.filter((p) => p.sequenceType === 'appointment_reminder')).toHaveLength(2);
    expect(plan.filter((p) => p.sequenceType === 'appointment_reminder_contractor')).toHaveLength(2);
  });

  it('omits contractor reminders when contractor channel is unavailable', () => {
    const now = new Date('2026-02-10T12:00:00Z');
    const appointment = new Date('2026-02-12T18:00:00Z');

    const plan = buildAppointmentReminderPlan(appointment, now, false);

    expect(plan).toHaveLength(2);
    expect(plan.every((p) => p.sequenceType === 'appointment_reminder')).toBe(true);
  });

  it('does not schedule past reminders', () => {
    const now = new Date('2026-02-12T17:30:00Z');
    const appointment = new Date('2026-02-12T18:00:00Z');

    const plan = buildAppointmentReminderPlan(appointment, now, true);

    expect(plan).toHaveLength(0);
  });
});
