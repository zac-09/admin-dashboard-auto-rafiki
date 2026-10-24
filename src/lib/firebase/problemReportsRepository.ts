import { collection, getFirestore, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { env } from '@/lib/env';
import {
  PROBLEM_REPORTS,
  type ProblemContext,
  type ProblemReport,
  type ProblemReportsRepository,
} from '@/types';

import { getFirebaseApp } from './app';

async function call(name: string, data: unknown, fallback: string): Promise<void> {
  try {
    await httpsCallable(getFunctions(getFirebaseApp(), env.functionsRegion), name)(data);
  } catch (error) {
    throw new Error((error as Error).message || fallback, { cause: error });
  }
}

export class FirestoreProblemReportsRepository implements ProblemReportsRepository {
  subscribe(onChange: (reports: ProblemReport[]) => void, onError: (e: Error) => void) {
    return onSnapshot(
      query(
        collection(getFirestore(getFirebaseApp()), PROBLEM_REPORTS),
        orderBy('at', 'desc'),
        limit(100),
      ),
      (s) => onChange(s.docs.map((d) => ({ ...(d.data() as ProblemReport), id: d.id }))),
      onError,
    );
  }

  report(input: { description: string; context: ProblemContext }) {
    return call('reportProblem', input, 'The report could not be sent.');
  }

  resolve(id: string) {
    return call('resolveProblemReport', { id }, 'The report could not be updated.');
  }
}
