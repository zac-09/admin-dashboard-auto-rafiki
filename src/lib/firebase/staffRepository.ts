import { getFunctions, httpsCallable } from 'firebase/functions';

import { env } from '@/lib/env';
import type {
  AdminRole,
  InviteStaffInput,
  InviteStaffResult,
  StaffMember,
  StaffRepository,
} from '@/types';

import { getFirebaseApp } from './app';

async function call<T>(name: string, data?: object): Promise<T> {
  try {
    const fn = httpsCallable<object | undefined, T>(
      getFunctions(getFirebaseApp(), env.functionsRegion),
      name,
    );
    return (await fn(data)).data;
  } catch (error) {
    throw new Error((error as Error).message || 'That did not work.', { cause: error });
  }
}

export class CallableStaffRepository implements StaffRepository {
  list() {
    return call<StaffMember[]>('listStaff');
  }

  invite(input: InviteStaffInput) {
    return call<InviteStaffResult>('inviteStaff', input);
  }

  async setRole(input: { uid: string; role: AdminRole | null; reason: string }) {
    await call('setUserRole', input);
  }
}
