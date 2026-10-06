import {
  allowedDecisions,
  ASSESSMENT_CHECKLIST,
  decisionLabel,
  isChecklistComplete,
  nextVetting,
} from '../vetting';

describe('vetting decisions', () => {
  it('approve verifies a pending applicant, reinstates a suspension, re-verifies a verified mechanic', () => {
    expect(nextVetting('pending', 'approve')).toBe('verified');
    expect(nextVetting('suspended', 'approve')).toBe('verified');
    expect(nextVetting('verified', 'approve')).toBe('verified');
    expect(decisionLabel('approve', 'pending')).toBe('Approve');
    expect(decisionLabel('approve', 'suspended')).toBe('Reinstate');
    expect(decisionLabel('approve', 'verified')).toBe('Re-verify');
  });

  it('reject never changes vetting and does not apply to verified mechanics', () => {
    expect(nextVetting('pending', 'reject')).toBe('pending');
    expect(nextVetting('suspended', 'reject')).toBe('suspended');
    expect(nextVetting('verified', 'reject')).toBeNull();
  });

  it('suspend applies to pending and verified only', () => {
    expect(nextVetting('pending', 'suspend')).toBe('suspended');
    expect(nextVetting('verified', 'suspend')).toBe('suspended');
    expect(nextVetting('suspended', 'suspend')).toBeNull();
  });

  it('lists the decisions open for each state', () => {
    expect(allowedDecisions('pending')).toEqual(['approve', 'reject', 'suspend']);
    expect(allowedDecisions('verified')).toEqual(['approve', 'suspend']);
    expect(allowedDecisions('suspended')).toEqual(['approve', 'reject']);
  });

  it('requires every checklist item', () => {
    const all = ASSESSMENT_CHECKLIST.map((i) => i.id);
    expect(isChecklistComplete(all)).toBe(true);
    expect(isChecklistComplete(all.slice(1))).toBe(false);
    expect(isChecklistComplete([])).toBe(false);
  });
});
