import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRepositories } from '@/lib/repositories';
import type { AdminRole, InviteStaffInput } from '@/types';

const KEY = ['staff'] as const;

export function useStaff() {
  const { staff } = useRepositories();
  return useQuery({ queryKey: KEY, queryFn: () => staff.list() });
}

export function useInviteStaff() {
  const { staff } = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteStaffInput) => staff.invite(input),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetRole() {
  const { staff } = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { uid: string; role: AdminRole | null; reason: string }) =>
      staff.setRole(input),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

/** Firebase emails its own password-reset message, which works as a setup link. */
export function useEmailSetupLink() {
  const { auth } = useRepositories();
  return useMutation({ mutationFn: (email: string) => auth.sendPasswordReset(email) });
}
