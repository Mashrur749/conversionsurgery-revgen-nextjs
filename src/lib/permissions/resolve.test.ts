import { describe, it, expect } from 'vitest';
import {
  resolvePermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from './resolve';
import { PORTAL_PERMISSIONS, AGENCY_PERMISSIONS } from './constants';

describe('resolvePermissions', () => {
  it('returns base permissions when overrides are null', () => {
    const result = resolvePermissions(
      [PORTAL_PERMISSIONS.DASHBOARD, PORTAL_PERMISSIONS.LEADS_VIEW],
      null
    );
    expect(result).toEqual(
      new Set([PORTAL_PERMISSIONS.DASHBOARD, PORTAL_PERMISSIONS.LEADS_VIEW])
    );
  });

  it('adds granted permissions', () => {
    const result = resolvePermissions(
      [PORTAL_PERMISSIONS.DASHBOARD],
      { grant: [PORTAL_PERMISSIONS.LEADS_VIEW] }
    );
    expect(result.has(PORTAL_PERMISSIONS.DASHBOARD)).toBe(true);
    expect(result.has(PORTAL_PERMISSIONS.LEADS_VIEW)).toBe(true);
  });

  it('removes revoked permissions', () => {
    const result = resolvePermissions(
      [PORTAL_PERMISSIONS.DASHBOARD, PORTAL_PERMISSIONS.LEADS_VIEW],
      { revoke: [PORTAL_PERMISSIONS.LEADS_VIEW] }
    );
    expect(result.has(PORTAL_PERMISSIONS.DASHBOARD)).toBe(true);
    expect(result.has(PORTAL_PERMISSIONS.LEADS_VIEW)).toBe(false);
  });

  it('handles grant and revoke together (revoke wins for same permission)', () => {
    const result = resolvePermissions(
      [PORTAL_PERMISSIONS.DASHBOARD],
      {
        grant: [PORTAL_PERMISSIONS.LEADS_VIEW],
        revoke: [PORTAL_PERMISSIONS.LEADS_VIEW],
      }
    );
    expect(result.has(PORTAL_PERMISSIONS.DASHBOARD)).toBe(true);
    expect(result.has(PORTAL_PERMISSIONS.LEADS_VIEW)).toBe(false);
  });

  it('handles empty template permissions', () => {
    const result = resolvePermissions([], null);
    expect(result.size).toBe(0);
  });

  it('handles empty overrides object', () => {
    const result = resolvePermissions(
      [PORTAL_PERMISSIONS.DASHBOARD],
      { grant: [], revoke: [] }
    );
    expect(result).toEqual(new Set([PORTAL_PERMISSIONS.DASHBOARD]));
  });

  it('deduplicates permissions', () => {
    const result = resolvePermissions(
      [PORTAL_PERMISSIONS.DASHBOARD, PORTAL_PERMISSIONS.DASHBOARD],
      { grant: [PORTAL_PERMISSIONS.DASHBOARD] }
    );
    expect(result.size).toBe(1);
  });
});

describe('hasPermission', () => {
  const perms = new Set([
    PORTAL_PERMISSIONS.DASHBOARD,
    PORTAL_PERMISSIONS.LEADS_VIEW,
  ]);

  it('returns true for present permission', () => {
    expect(hasPermission(perms, PORTAL_PERMISSIONS.DASHBOARD)).toBe(true);
  });

  it('returns false for absent permission', () => {
    expect(hasPermission(perms, PORTAL_PERMISSIONS.SETTINGS_EDIT)).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  const perms = new Set([
    AGENCY_PERMISSIONS.CLIENTS_VIEW,
    AGENCY_PERMISSIONS.CLIENTS_EDIT,
    AGENCY_PERMISSIONS.FLOWS_VIEW,
  ]);

  it('returns true when all required are present', () => {
    expect(
      hasAllPermissions(perms, [
        AGENCY_PERMISSIONS.CLIENTS_VIEW,
        AGENCY_PERMISSIONS.CLIENTS_EDIT,
      ])
    ).toBe(true);
  });

  it('returns false when one is missing', () => {
    expect(
      hasAllPermissions(perms, [
        AGENCY_PERMISSIONS.CLIENTS_VIEW,
        AGENCY_PERMISSIONS.CLIENTS_DELETE,
      ])
    ).toBe(false);
  });

  it('returns true for empty required array', () => {
    expect(hasAllPermissions(perms, [])).toBe(true);
  });
});

describe('hasAnyPermission', () => {
  const perms = new Set([AGENCY_PERMISSIONS.CLIENTS_VIEW]);

  it('returns true when at least one matches', () => {
    expect(
      hasAnyPermission(perms, [
        AGENCY_PERMISSIONS.CLIENTS_VIEW,
        AGENCY_PERMISSIONS.CLIENTS_EDIT,
      ])
    ).toBe(true);
  });

  it('returns false when none match', () => {
    expect(
      hasAnyPermission(perms, [
        AGENCY_PERMISSIONS.CLIENTS_EDIT,
        AGENCY_PERMISSIONS.CLIENTS_DELETE,
      ])
    ).toBe(false);
  });

  it('returns false for empty required array', () => {
    expect(hasAnyPermission(perms, [])).toBe(false);
  });
});
