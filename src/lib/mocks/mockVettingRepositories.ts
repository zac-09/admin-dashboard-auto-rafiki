import {
  isChecklistComplete,
  nextVetting,
  type DecideVettingInput,
  type DecideVettingResult,
  type VettingStatus,
} from '@/lib/vetting';
import type {
  AuditEntry,
  AuditRepository,
  MechanicDoc,
  MechanicRepository,
  Unsubscribe,
  VettingRepository,
} from '@/types';

import { AUDIT_ENTRIES } from './auditFixtures';
import { MECHANICS } from './contractFixtures';
import type { MockAuthRepository } from './mockAuthRepository';

/** Shared in-memory state so a mock decision shows up in queues, detail and history. */
export class MockVettingStore {
  mechanics = new Map<string, MechanicDoc>(MECHANICS.map((m) => [m.userId, structuredClone(m)]));
  audit: AuditEntry[] = structuredClone(AUDIT_ENTRIES);
  private listeners = new Map<string, Set<(m: MechanicDoc | null) => void>>();

  watch(userId: string, onChange: (m: MechanicDoc | null) => void): Unsubscribe {
    const set = this.listeners.get(userId) ?? new Set();
    set.add(onChange);
    this.listeners.set(userId, set);
    onChange(this.snapshot(userId));
    return () => set.delete(onChange);
  }

  setVetting(userId: string, vetting: VettingStatus): void {
    const mechanic = this.mechanics.get(userId);
    if (!mechanic) return;
    this.mechanics.set(userId, { ...mechanic, vetting });
    this.listeners.get(userId)?.forEach((l) => l(this.snapshot(userId)));
  }

  private snapshot(userId: string): MechanicDoc | null {
    const m = this.mechanics.get(userId);
    return m ? structuredClone(m) : null;
  }
}

export class MockMechanicRepository implements MechanicRepository {
  private readonly store: MockVettingStore;
  constructor(store: MockVettingStore) {
    this.store = store;
  }

  async listByVetting(status: VettingStatus): Promise<MechanicDoc[]> {
    return [...this.store.mechanics.values()]
      .filter((m) => m.vetting === status)
      .map((m) => structuredClone(m));
  }

  subscribe(userId: string, onChange: (m: MechanicDoc | null) => void): Unsubscribe {
    return this.store.watch(userId, onChange);
  }
}

export class MockAuditRepository implements AuditRepository {
  private readonly store: MockVettingStore;
  constructor(store: MockVettingStore) {
    this.store = store;
  }

  async listMechanicEntries(): Promise<AuditEntry[]> {
    return this.store.audit
      .filter((e) => e.targetType === 'mechanic')
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((e) => structuredClone(e));
  }
}

/** Mirrors the decideVetting callable's rules (functions/src/decideVetting.ts). */
export class MockVettingRepository implements VettingRepository {
  private readonly store: MockVettingStore;
  private readonly auth: MockAuthRepository;
  constructor(store: MockVettingStore, auth: MockAuthRepository) {
    this.store = store;
    this.auth = auth;
  }

  async decide(input: DecideVettingInput): Promise<DecideVettingResult> {
    const actor = this.auth.current();
    if (!actor?.role || actor.role === 'support') {
      throw new Error('Your role cannot make vetting decisions.');
    }
    const mechanic = this.store.mechanics.get(input.mechanicId);
    if (!mechanic) throw new Error('No mechanic profile with that id.');
    const reason = input.reason.trim();
    if (!reason) throw new Error('A reason is required.');
    if (input.decision === 'approve' && !isChecklistComplete(input.checklist ?? [])) {
      throw new Error('Complete every assessment checklist item to approve.');
    }
    const next = nextVetting(mechanic.vetting, input.decision);
    if (!next) throw new Error(`Cannot ${input.decision} a mechanic who is ${mechanic.vetting}.`);
    const entry: AuditEntry = {
      id: `audit_mock_${this.store.audit.length + 1}`,
      action: `mechanic.vetting.${input.decision}`,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'mechanic',
      targetId: mechanic.userId,
      targetLabel: mechanic.businessName,
      before: mechanic.vetting,
      after: next,
      reason,
      at: new Date().toISOString(),
    };
    if (input.decision === 'approve') entry.checklist = input.checklist;
    this.store.audit.push(entry);
    const changed = next !== mechanic.vetting;
    if (changed) this.store.setVetting(mechanic.userId, next);
    return { mechanicId: mechanic.userId, vetting: next, changed };
  }
}
