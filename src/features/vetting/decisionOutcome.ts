import type { VettingDecision } from '@/lib/vetting';
import type { MechanicDoc } from '@/types';

/** The outcome moment for a saved decision (title + one line on what changes). */
export function decisionOutcome(
  decision: VettingDecision,
  mechanic: MechanicDoc,
): { title: string; subtitle: string } {
  const name = mechanic.businessName;
  if (decision === 'reject')
    return { title: 'Rejection recorded', subtitle: `${name} stays ${mechanic.vetting}` };
  if (decision === 'suspend')
    return { title: 'Suspended', subtitle: `${name} receives no new jobs` };
  if (mechanic.vetting === 'verified')
    return { title: 'Re-verified', subtitle: `${name}: next check due in 12 months` };
  if (mechanic.vetting === 'suspended')
    return { title: 'Reinstated', subtitle: `${name} receives jobs again` };
  return { title: 'Approved', subtitle: `${name} now receives job broadcasts` };
}
