import { describe, it, expect } from 'vitest';
import { preventEscalation, validateOverrides } from './escalation-guard';
import { AGENCY_PERMISSIONS } from './constants';

describe('preventEscalation', () => {
  it('succeeds when granter holds all target permissions', () => {
    const granter = new Set([
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CLIENTS_EDIT,
      AGENCY_PERMISSIONS.FLOWS_VIEW,
    ]);
    expect(() =>
      preventEscalation(granter, [
        AGENCY_PERMISSIONS.CLIENTS_VIEW,
        AGENCY_PERMISSIONS.CLIENTS_EDIT,
      ])
    ).not.toThrow();
  });

  it('throws when granter lacks one target permission', () => {
    const granter = new Set([AGENCY_PERMISSIONS.CLIENTS_VIEW]);
    expect(() =>
      preventEscalation(granter, [
        AGENCY_PERMISSIONS.CLIENTS_VIEW,
        AGENCY_PERMISSIONS.CLIENTS_EDIT,
      ])
    ).toThrow('Permission escalation denied');
  });

  it('includes missing permissions in error message', () => {
    const granter = new Set([AGENCY_PERMISSIONS.CLIENTS_VIEW]);
    expect(() =>
      preventEscalation(granter, [AGENCY_PERMISSIONS.CLIENTS_EDIT])
    ).toThrow(AGENCY_PERMISSIONS.CLIENTS_EDIT);
  });

  it('succeeds with empty target permissions', () => {
    const granter = new Set([AGENCY_PERMISSIONS.CLIENTS_VIEW]);
    expect(() => preventEscalation(granter, [])).not.toThrow();
  });

  it('throws when granter has empty permissions', () => {
    const granter = new Set<string>();
    expect(() =>
      preventEscalation(granter, [AGENCY_PERMISSIONS.CLIENTS_VIEW])
    ).toThrow('Permission escalation denied');
  });
});

describe('validateOverrides', () => {
  it('allows grants when granter holds those permissions', () => {
    const granter = new Set([
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CLIENTS_EDIT,
    ]);
    expect(() =>
      validateOverrides(granter, {
        grant: [AGENCY_PERMISSIONS.CLIENTS_VIEW],
      })
    ).not.toThrow();
  });

  it('blocks grants when granter lacks the permission', () => {
    const granter = new Set([AGENCY_PERMISSIONS.CLIENTS_VIEW]);
    expect(() =>
      validateOverrides(granter, {
        grant: [AGENCY_PERMISSIONS.CLIENTS_EDIT],
      })
    ).toThrow('Permission escalation denied');
  });

  it('allows any revokes regardless of granter permissions', () => {
    const granter = new Set<string>();
    expect(() =>
      validateOverrides(granter, {
        revoke: [AGENCY_PERMISSIONS.CLIENTS_VIEW, AGENCY_PERMISSIONS.TEAM_MANAGE],
      })
    ).not.toThrow();
  });

  it('validates grants but ignores revokes', () => {
    const granter = new Set([AGENCY_PERMISSIONS.CLIENTS_VIEW]);
    expect(() =>
      validateOverrides(granter, {
        grant: [AGENCY_PERMISSIONS.CLIENTS_VIEW],
        revoke: [AGENCY_PERMISSIONS.TEAM_MANAGE],
      })
    ).not.toThrow();
  });
});
