import { can } from '../permissions';

describe('permissions', () => {
  it('support cannot approve mechanics, intervene, see revenue or manage staff', () => {
    for (const p of [
      'vetting.decide',
      'operations.intervene',
      'revenue.view',
      'revenue.markPaid',
      'staff.manage',
      'settings.edit',
    ] as const) {
      expect(can('support', p)).toBe(false);
    }
    expect(can('support', 'support.annotate')).toBe(true);
    expect(can('support', 'vetting.view')).toBe(true);
  });

  it('ops runs the marketplace but cannot change roles or settings', () => {
    expect(can('ops', 'vetting.decide')).toBe(true);
    expect(can('ops', 'revenue.markPaid')).toBe(true);
    expect(can('ops', 'staff.manage')).toBe(false);
    expect(can('ops', 'settings.edit')).toBe(false);
  });

  it('admin can do everything; no role can do nothing', () => {
    expect(can('admin', 'staff.manage')).toBe(true);
    expect(can(null, 'vetting.view')).toBe(false);
    expect(can(undefined, 'support.view')).toBe(false);
  });
});
