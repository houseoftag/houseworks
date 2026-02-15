'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';
import { WorkspaceAccess } from './workspace_access';
import { getCreateBoardErrorCopy, getCreateBoardStatusCopy } from './create_board_feedback';

type WorkspaceControlsProps = {
  requestedTab?: 'WORKSPACE' | 'BOARD' | 'TEAM';
};

export function WorkspaceControls({ requestedTab }: WorkspaceControlsProps) {
  const { status } = useSession();
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const { data: workspaces } = trpc.workspaces.listMine.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const workspaceList = Array.isArray(workspaces) ? workspaces : [];

  const [workspaceName, setWorkspaceName] = useState('');
  const [boardTitle, setBoardTitle] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER'>(
    'MEMBER',
  );
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [manualActiveTab, setManualActiveTab] = useState<'WORKSPACE' | 'BOARD' | 'TEAM'>(requestedTab ?? 'WORKSPACE');

  useEffect(() => {
    if (requestedTab) {
      setManualActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const [createBoardStatus, setCreateBoardStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [createBoardErrorMessage, setCreateBoardErrorMessage] = useState<string | null>(null);

  const activeTab = manualActiveTab;
  const effectiveSelectedWorkspace = selectedWorkspace ?? workspaceList[0]?.id ?? null;

  const createWorkspaceMutation = trpc.workspaces.create.useMutation({
    onSuccess: async (created) => {
      setWorkspaceName('');
      setSelectedWorkspace(created.id);
      pushToast({
        title: 'Workspace created',
        description: created.name,
        tone: 'success',
      });
      await utils.workspaces.listMine.invalidate();
    },
    onError: (e) => {
      pushToast({
        title: 'Workspace failed',
        description: e.message || 'Unable to create workspace.',
        tone: 'error',
      });
    },
  });

  const createBoard = trpc.boards.create.useMutation({
    onMutate: () => {
      setCreateBoardStatus('loading');
      setCreateBoardErrorMessage(null);
    },
    onSuccess: async () => {
      setBoardTitle('');
      setBoardDescription('');
      setCreateBoardStatus('success');
      pushToast({
        title: 'Board created',
        description: 'Your board is ready. Select it in the sidebar to start adding work.',
        tone: 'success',
      });
      await utils.boards.getDefault.invalidate();
      await utils.boards.listByWorkspace.invalidate();
    },
    onError: (error) => {
      setCreateBoardStatus('error');
      setCreateBoardErrorMessage(getCreateBoardErrorCopy(error.message));
      pushToast({
        title: 'Board failed',
        description: getCreateBoardErrorCopy(error.message),
        tone: 'error',
      });
    },
  });

  const createInvite = trpc.invites.create.useMutation({
    onSuccess: (invite) => {
      setInviteEmail('');
      setInviteLink(`${window.location.origin}/invite/${invite.token}`);
      pushToast({
        title: 'Invite created',
        description: 'Share the invite link with your teammate.',
        tone: 'success',
      });
    },
    onError: () => {
      pushToast({
        title: 'Invite failed',
        description: 'Unable to create invite.',
        tone: 'error',
      });
    },
  });

  if (status !== 'authenticated') {
    return (
      <div className="rounded-2xl border border-border bg-white/50 p-6 text-sm text-slate-500 italic shadow-sm">
        Sign in to manage workspaces and invites.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-foreground">
            Workspace Management
          </h3>
          <div className="flex gap-4">
            {(['WORKSPACE', 'BOARD', 'TEAM'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setManualActiveTab(tab)}
                className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === tab
                    ? 'text-primary'
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {activeTab === 'WORKSPACE' && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all"
                placeholder="Workspace name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
              />
              <button
                className="rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-500/20 disabled:opacity-60 transition-transform active:scale-95"
                disabled={!workspaceName.trim() || createWorkspaceMutation.isPending}
                onClick={() => {
                  const name = workspaceName.trim();
                  if (!name) return;
                  createWorkspaceMutation.mutate({ name });
                }}
                type="button"
              >
                {createWorkspaceMutation.isPending ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          )}

          {activeTab === 'BOARD' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200" id="create-board-panel">
              <p className="text-xs text-slate-500">
                Create your first board to start tracking work. Pick a workspace, name your board, then submit.
              </p>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground focus:bg-white focus:border-primary focus:outline-none transition-all"
                value={effectiveSelectedWorkspace ?? ''}
                onChange={(event) => {
                  setSelectedWorkspace(event.target.value);
                  if (createBoardStatus !== 'loading') {
                    setCreateBoardStatus('idle');
                    setCreateBoardErrorMessage(null);
                  }
                }}
              >
                <option value="" disabled>
                  Select workspace
                </option>
                {workspaceList.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all"
                placeholder="Board title"
                value={boardTitle}
                onChange={(event) => {
                  setBoardTitle(event.target.value);
                  if (createBoardStatus !== 'loading') {
                    setCreateBoardStatus('idle');
                    setCreateBoardErrorMessage(null);
                  }
                }}
              />
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all"
                placeholder="Board description"
                rows={2}
                value={boardDescription}
                onChange={(event) => {
                  setBoardDescription(event.target.value);
                  if (createBoardStatus !== 'loading') {
                    setCreateBoardStatus('idle');
                    setCreateBoardErrorMessage(null);
                  }
                }}
              />
              <button
                aria-busy={createBoard.isPending}
                className="rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-500/20 disabled:opacity-60 transition-transform active:scale-95"
                disabled={!effectiveSelectedWorkspace || !boardTitle.trim() || createBoard.isPending}
                onClick={() =>
                  createBoard.mutate({
                    workspaceId: effectiveSelectedWorkspace!,
                    title: boardTitle.trim(),
                    description: boardDescription.trim() || undefined,
                  })
                }
                type="button"
              >
                {createBoard.isPending
                  ? 'Creating Board…'
                  : createBoardStatus === 'success'
                    ? 'Create Another Board'
                    : 'Create Board'}
              </button>
              <p
                aria-live="polite"
                className={`min-h-5 text-xs font-medium ${
                  createBoardStatus === 'error'
                    ? 'text-rose-700'
                    : createBoardStatus === 'success'
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                }`}
                data-testid="create-board-status"
                role="status"
              >
                {getCreateBoardStatusCopy(createBoardStatus, createBoardErrorMessage)}
              </p>
            </div>
          )}

          {activeTab === 'TEAM' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all"
                placeholder="email@studio.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground focus:bg-white focus:border-primary focus:outline-none transition-all"
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as 'OWNER' | 'ADMIN' | 'MEMBER')
                }
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
              </select>
              <button
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary hover:bg-slate-50 disabled:opacity-60 transition-all font-bold"
                disabled={!effectiveSelectedWorkspace || !inviteEmail || createInvite.isPending}
                onClick={() =>
                  createInvite.mutate({
                    workspaceId: effectiveSelectedWorkspace!,
                    email: inviteEmail,
                    role: inviteRole,
                  })
                }
                type="button"
              >
                {createInvite.isPending ? 'Sending…' : 'Create Invite Link'}
              </button>
              {inviteLink ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Invite link:{' '}
                  <span className="break-all font-medium text-primary">{inviteLink}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <WorkspaceAccess workspaceId={effectiveSelectedWorkspace} />
    </div>
  );
}
