import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockRepositories, MOCK_PASSWORD } from '@/lib/mocks';
import { MECHANICS } from '@/lib/mocks/contractFixtures';
import { setRepositoriesForTesting } from '@/lib/repositories';
import { useSessionStore } from '@/lib/session';
import { renderApp } from '@/test/renderApp';
import type { AuditEntry, VettingDocument } from '@/types';

import { applicantNudge, applicants, daysToApprove, stageOf } from '../pipeline';

const kato = MECHANICS.find((m) => m.userId === 'u_mech_kato')!;
const ssempala = MECHANICS.find((m) => m.userId === 'u_mech_ssempala')!;
const record = (docType: VettingDocument['docType']): VettingDocument => ({
  docType,
  storagePath: `vetting/x/${docType}/f1`,
  contentType: 'image/jpeg',
  sizeBytes: 1000,
  uploadedAt: '2026-10-05T09:00:00.000Z',
  version: 1,
});
const review = (decision: 'verified' | 'rejected', docType: VettingDocument['docType']) => ({
  decision,
  storagePath: `vetting/x/${docType}/f1`,
  version: 1,
  reason: 'r',
  reviewedBy: 's',
  reviewedByEmail: 's@x',
  reviewedByRole: 'ops' as const,
  reviewedAt: '2026-10-06T09:00:00.000Z',
});

describe('applicant pipeline', () => {
  const now = new Date('2026-10-10T09:00:00Z');

  it('stages: missing or rejected → applicant; uploaded → review; all verified → assessment', () => {
    const base = { required: [], verified: 0, missing: [], rejected: [], pending: [] };
    expect(stageOf({ ...base, missing: ['national-id'] })).toBe('needs-documents');
    expect(stageOf({ ...base, rejected: ['certification'], pending: ['national-id'] })).toBe(
      'needs-documents',
    );
    expect(stageOf({ ...base, pending: ['national-id'] })).toBe('to-review');
    expect(stageOf({ ...base, verified: 2 })).toBe('ready');
  });

  it('reads each applicant against their own required documents, oldest first', () => {
    const list = applicants(
      [kato, ssempala],
      new Map([
        [
          'u_mech_ssempala',
          {
            docs: {
              'national-id': record('national-id'),
              certification: record('certification'),
              'riding-permit': record('riding-permit'),
            },
            reviews: { 'national-id': review('verified', 'national-id') },
          },
        ],
      ]),
      now,
    );
    expect(list.map((a) => [a.mechanic.businessName, a.stage])).toEqual([
      ['Ssempala Boda Fix', 'to-review'],
      ['Kato Battery & Tyre', 'needs-documents'],
    ]);
    expect(list[1]!.summary.missing).toEqual(['national-id', 'certification']);
  });

  it('writes a nudge naming what to upload and what to re-upload', () => {
    const [a] = applicants(
      [ssempala],
      new Map([
        [
          'u_mech_ssempala',
          {
            docs: { 'national-id': record('national-id'), certification: record('certification') },
            reviews: { certification: review('rejected', 'certification') },
          },
        ],
      ]),
      now,
    );
    expect(applicantNudge(a!)).toBe(
      'Hello Ssempala Boda Fix, this is AutoRafiki. To finish your mechanic application, please ' +
        'upload your riding permit and upload a clearer copy of your mechanic certification in ' +
        'the AutoRafiki app. Reply here if you need help. Thank you.',
    );
  });

  it('time to approve: first approvals from pending, in the window, with a known application date', () => {
    const approve = (id: string, at: string, before = 'pending'): AuditEntry => ({
      id: `${id}${at}`,
      action: 'mechanic.vetting.approve',
      actorUid: 's',
      actorEmail: null,
      actorRole: 'ops',
      targetType: 'mechanic',
      targetId: id,
      targetLabel: id,
      before,
      after: 'verified',
      reason: 'r',
      at,
    });
    const result = daysToApprove(
      [kato, ssempala],
      [
        approve('u_mech_kato', '2026-10-09T09:00:00Z'), // 4 days after 5 Oct 09:00
        approve('u_mech_ssempala', '2026-10-09T09:00:00Z'), // 6 days after 3 Oct 09:00
        approve('u_mech_ssempala', '2026-10-09T10:00:00Z', 'suspended'), // a reinstatement
        approve('u_mech_okello', '2026-10-09T09:00:00Z'), // no application date
      ],
      now,
    );
    expect(result).toEqual({ median: 5, count: 2 });
  });
});

describe('pipeline on the Pending tab', () => {
  it('groups applicants and offers a nudge to those who owe documents', async () => {
    const repos = createMockRepositories();
    await repos.auth.signIn('ops@autorafiki.test', MOCK_PASSWORD);
    setRepositoriesForTesting(repos);
    useSessionStore.setState({ status: 'loading', session: null });
    renderApp('/vetting');
    const user = userEvent.setup();
    const panel = await screen.findByRole('region', { name: 'Applicant pipeline' });
    expect(panel).toHaveTextContent(/2 waiting · oldest \d+ days/);
    const owing = within(panel).getByRole('list', { name: 'Waiting on the applicant' });
    const rows = within(owing).getAllByRole('listitem');
    expect(rows.map((r) => within(r).getAllByRole('link')[0]!.textContent)).toEqual([
      'Ssempala Boda Fix',
      'Kato Battery & Tyre',
    ]);
    expect(rows[0]).toHaveTextContent(
      'Documents: 0 of 3 verified · 1 not uploaded · 2 awaiting review',
    );
    const nudge = within(rows[1]!).getByRole('link', { name: 'WhatsApp nudge' });
    expect(decodeURIComponent(nudge.getAttribute('href')!)).toContain(
      'please upload your national ID and mechanic certification',
    );
    // Other tabs do not show it.
    await user.click(screen.getByRole('button', { name: /Verified/ }));
    expect(screen.queryByRole('region', { name: 'Applicant pipeline' })).not.toBeInTheDocument();
  });
});
