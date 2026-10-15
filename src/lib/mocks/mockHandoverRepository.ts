import type { HandoverNote, HandoverRepository, Unsubscribe } from '@/types';

import type { MockAuthRepository } from './mockAuthRepository';

/** Mirrors addHandoverNote / markHandoverHandled (functions/src/handover.ts). */
export class MockHandoverRepository implements HandoverRepository {
  private notes: HandoverNote[] = [];
  private listeners = new Set<() => void>();
  private readonly auth: MockAuthRepository;

  constructor(auth: MockAuthRepository) {
    this.auth = auth;
  }

  subscribe(onChange: (notes: HandoverNote[]) => void): Unsubscribe {
    const emit = () => onChange(structuredClone(this.notes.slice(0, 50)));
    this.listeners.add(emit);
    emit();
    return () => this.listeners.delete(emit);
  }

  private actor() {
    const a = this.auth.current();
    if (!a?.role) throw new Error('Only dashboard staff write handover notes.');
    return { ...a, role: a.role };
  }

  async add(input: { text: string; jobId?: string | null }) {
    const a = this.actor();
    const text = input.text.trim();
    if (!text) throw new Error('Write the note first.');
    this.notes.unshift({
      id: `note_mock_${this.notes.length + 1}`,
      text,
      jobId: input.jobId?.trim() || null,
      at: new Date().toISOString(),
      authorUid: a.uid,
      authorEmail: a.email,
      authorRole: a.role,
      handledAt: null,
      handledBy: null,
      handledByEmail: null,
    });
    this.listeners.forEach((l) => l());
  }

  async markHandled(id: string) {
    const a = this.actor();
    const note = this.notes.find((n) => n.id === id);
    if (!note) throw new Error('That note no longer exists.');
    if (note.handledAt) throw new Error('Someone already handled it.');
    Object.assign(note, {
      handledAt: new Date().toISOString(),
      handledBy: a.uid,
      handledByEmail: a.email,
    });
    this.listeners.forEach((l) => l());
  }
}
