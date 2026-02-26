'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/trpc/react';
import { skipToken } from '@tanstack/react-query';
import { useToast } from './toast_provider';

type WorkspaceAccessProps = {
  workspaceId: string | null;
};

export function WorkspaceAccess({ workspaceId }: WorkspaceAccessProps) {
  const { data: session } = useSession();
  const { pushToast } = useToast();
  const utils = trpc.useUtils();

  const { data: members } = trpc.workspaces.members.useQuery(
    workspaceId ? { workspaceId } : skipToken
  );

  const currentRole = useMemo(() => {
    if (!members || !session?.user?.id) {
      return null;
    }
    const member = members.find((entry) => entry.userId === session.user.id);
    return member?.role ?? null;
  }, [members, session?.user?.id]);

  const canManage = currentRole && currentRole !== 'MEMBER';

  const { data: invites } = trpc.invites.list.useQuery(
    workspaceId && canManage ? { workspaceId } : skipToken
  );

  const updateRole = trpc.workspaces.updateMemberRole.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Role updated', tone: 'success' });
      await utils.workspaces.members.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Role update failed',
        description: 'Unable to update member role.',
        tone: 'error',
      });
    },
  });

  const removeMember = trpc.workspaces.removeMember.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Member removed', tone: 'success' });
      await utils.workspaces.members.invalidate();
    },
    onError: (error) => {
      pushToast({
        title: 'Removal failed',
        description: error.message || 'Unable to remove member.',
        tone: 'error',
      });
    },
  });

  const revokeInvite = trpc.invites.revoke.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Invite revoked', tone: 'success' });
      await utils.invites.list.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Invite revoke failed',
        description: 'Unable to revoke invite.',
        tone: 'error',
      });
    },
  });

  if (!workspaceId) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-bold text-foreground">Members</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-500">
          {members?.length ? (
            members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {member.user.name ?? member.user.email}
                  </p>
                  <p className="text-xs text-slate-400">{member.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground disabled:opacity-60 focus:outline-none focus:border-primary"
                    disabled={!canManage}
                    value={member.role}
                    onChange={(event) =>
                      updateRole.mutate({
                        workspaceId,
                        memberId: member.id,
                        role: event.target.value as 'OWNER' | 'ADMIN' | 'MEMBER',
                      })
                    }
                  >
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                  {canManage && member.role !== 'OWNER' && member.user.id !== session?.user?.id && (
                    <button
                      className="text-xs font-medium text-rose-500 hover:text-rose-600 ml-2"
                      onClick={() => {
                        if (window.confirm(`Remove ${member.user.name ?? member.user.email} from workspace?`)) {
                          removeMember.mutate({ workspaceId, memberId: member.id });
                        }
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic">No members yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-bold text-foreground">Pending Invites</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-500">
          {!canManage ? (
            <p className="text-xs text-slate-400 italic">
              You do not have permission to manage invites.
            </p>
          ) : invites && invites.length ? (
            invites.map((invite) => (
              <div
                key={invite.id}
                className="rounded-xl border border-border bg-background px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{invite.email}</p>
                    <p className="text-xs text-slate-400">
                      Role: {invite.role}
                    </p>
                  </div>
                  <button
                    className="text-xs font-medium text-rose-500 hover:text-rose-600"
                    onClick={() => revokeInvite.mutate({ id: invite.id })}
                    type="button"
                  >
                    Revoke
                  </button>
                </div>
                <p className="mt-2 break-all text-[11px] text-primary/70">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/invite/${invite.token}`
                    : `/invite/${invite.token}`}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic">No pending invites.</p>
          )}
        </div>
      </div>
    </div>
  );
}
