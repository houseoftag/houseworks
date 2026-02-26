'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/trpc/react';
import { skipToken } from '@tanstack/react-query';
import { useToast } from './toast_provider';

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.7 6.3l-.7-.4a4.9 4.9 0 00-.5-.9l.1-.8a.5.5 0 00-.2-.5l-1-1a.5.5 0 00-.5-.1l-.8.1a4.9 4.9 0 00-.9-.5l-.4-.7a.5.5 0 00-.4-.3H7.1a.5.5 0 00-.4.3l-.4.7c-.3.1-.6.3-.9.5l-.8-.1a.5.5 0 00-.5.2l-1 1a.5.5 0 00-.1.5l.1.8c-.2.3-.4.6-.5.9l-.7.4a.5.5 0 00-.3.4v1.4a.5.5 0 00.3.4l.7.4c.1.3.3.6.5.9l-.1.8a.5.5 0 00.2.5l1 1a.5.5 0 00.5.1l.8-.1c.3.2.6.4.9.5l.4.7a.5.5 0 00.4.3h1.4a.5.5 0 00.4-.3l.4-.7c.3-.1.6-.3.9-.5l.8.1a.5.5 0 00.5-.2l1-1a.5.5 0 00.1-.5l-.1-.8c.2-.3.4-.6.5-.9l.7-.4a.5.5 0 00.3-.4V6.7a.5.5 0 00-.3-.4z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Tab = 'workspace' | 'team' | 'boards';

type WorkspaceSettingsProps = {
  open: boolean;
  onClose: () => void;
  onWorkspaceDeleted?: () => void;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export { SettingsIcon };

export function WorkspaceSettings({ open, onClose, onWorkspaceDeleted }: WorkspaceSettingsProps) {
  const { status, data: session } = useSession();
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('workspace');

  // --- data ---
  const { data: workspaces } = trpc.workspaces.listMine.useQuery(undefined, {
    enabled: status === 'authenticated',
  });
  const workspaceList = Array.isArray(workspaces) ? workspaces : [];
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const effectiveWsId = selectedWsId ?? workspaceList[0]?.id ?? null;
  const selectedWs = workspaceList.find((w) => w.id === effectiveWsId);

  // --- dialog open/close ---
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handler = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handler);
    return () => dialog.removeEventListener('cancel', handler);
  }, [onClose]);

  // --- workspace rename ---
  const renameValue = selectedWs?.name ?? '';
  const [renameInput, setRenameInput] = useState<string | null>(null);
  const effectiveRenameValue = renameInput ?? renameValue;

  const renameMut = trpc.workspaces.rename.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Workspace renamed', tone: 'success' });
      await utils.workspaces.listMine.invalidate();
    },
    onError: (e) => pushToast({ title: 'Rename failed', description: e.message, tone: 'error' }),
  });

  // --- workspace delete ---
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const deleteMut = trpc.workspaces.delete.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Workspace deleted', tone: 'success' });
      setSelectedWsId(null);
      await utils.workspaces.listMine.invalidate();
      onWorkspaceDeleted?.();
    },
    onError: (e) => pushToast({ title: 'Delete failed', description: e.message, tone: 'error' }),
  });

  // --- team ---
  const { data: members } = trpc.workspaces.members.useQuery(
    effectiveWsId ? { workspaceId: effectiveWsId } : skipToken,
  );

  const currentRole = members && session?.user?.id
    ? (members.find((m) => m.userId === session.user.id)?.role ?? null)
    : null;

  const canManage = currentRole && currentRole !== 'MEMBER';

  const { data: invites } = trpc.invites.list.useQuery(
    effectiveWsId && canManage ? { workspaceId: effectiveWsId } : skipToken,
  );

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER'>('MEMBER');

  const createInvite = trpc.invites.create.useMutation({
    onSuccess: () => {
      setInviteEmail('');
      pushToast({ title: 'Invite sent', tone: 'success' });
      utils.invites.list.invalidate();
    },
    onError: () => pushToast({ title: 'Invite failed', tone: 'error' }),
  });

  const removeMember = trpc.workspaces.removeMember.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Member removed', tone: 'success' });
      await utils.workspaces.members.invalidate();
    },
    onError: (e) => pushToast({ title: 'Removal failed', description: e.message, tone: 'error' }),
  });

  const revokeInvite = trpc.invites.revoke.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Invite revoked', tone: 'success' });
      await utils.invites.list.invalidate();
    },
    onError: () => pushToast({ title: 'Revoke failed', tone: 'error' }),
  });

  const updateRole = trpc.workspaces.updateMemberRole.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Role updated', tone: 'success' });
      await utils.workspaces.members.invalidate();
    },
    onError: () => pushToast({ title: 'Role update failed', tone: 'error' }),
  });

  // --- boards ---
  const { data: boards } = trpc.boards.listByWorkspace.useQuery(
    effectiveWsId ? { workspaceId: effectiveWsId } : skipToken,
  );

  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardTitle, setEditingBoardTitle] = useState('');

  const updateBoard = trpc.boards.update.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Board renamed', tone: 'success' });
      setEditingBoardId(null);
      await utils.boards.listByWorkspace.invalidate();
    },
    onError: () => pushToast({ title: 'Rename failed', tone: 'error' }),
  });

  const deleteBoard = trpc.boards.delete.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Board deleted', tone: 'success' });
      await utils.boards.listByWorkspace.invalidate();
    },
    onError: () => pushToast({ title: 'Delete failed', tone: 'error' }),
  });

  if (!open) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'team', label: 'Team' },
    { id: 'boards', label: 'Boards' },
  ];

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      aria-label="Workspace settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <SettingsIcon className="text-slate-500" />
          <h2 className="text-base font-bold text-foreground">Settings</h2>
          {workspaceList.length > 1 && (
            <select
              className="ml-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              value={effectiveWsId ?? ''}
              onChange={(e) => setSelectedWsId(e.target.value)}
            >
              {workspaceList.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-muted hover:text-foreground/70 transition-colors"
          aria-label="Close settings"
          type="button"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-6" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary'
                : 'text-slate-500 hover:text-foreground'
            }`}
            type="button"
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-[60vh] overflow-y-auto px-6 py-6" role="tabpanel">
        {/* === WORKSPACE TAB === */}
        {activeTab === 'workspace' && (
          <div className="space-y-8">
            {/* Rename */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Rename workspace</h3>
              <div className="flex gap-3">
                <input
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:bg-card focus:border-primary focus:outline-none transition-all"
                  value={effectiveRenameValue}
                  onChange={(e) => setRenameInput(e.target.value)}
                  placeholder="Workspace name"
                />
                <button
                  className="rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:bg-primary/90"
                  disabled={!effectiveRenameValue.trim() || effectiveRenameValue === selectedWs?.name || renameMut.isPending}
                  onClick={() => {
                    if (effectiveWsId && effectiveRenameValue.trim()) {
                      renameMut.mutate({ workspaceId: effectiveWsId, name: effectiveRenameValue.trim() });
                      setRenameInput(null);
                    }
                  }}
                  type="button"
                >
                  {renameMut.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Delete */}
            <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-5">
              <h3 className="text-sm font-bold text-rose-500">Delete workspace</h3>
              <p className="text-xs text-rose-500/70">
                This will permanently delete the workspace, all boards, and data. This action cannot be undone.
              </p>
              <p className="text-xs text-foreground/70">
                Type <strong>{selectedWs?.name}</strong> to confirm:
              </p>
              <input
                className="w-full rounded-xl border border-rose-200 bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:border-rose-400 focus:outline-none transition-all"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type workspace name to confirm"
              />
              <button
                className="rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:bg-rose-700"
                disabled={deleteConfirm !== selectedWs?.name || deleteMut.isPending}
                onClick={() => {
                  if (effectiveWsId) {
                    deleteMut.mutate({ workspaceId: effectiveWsId });
                  }
                }}
                type="button"
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete workspace'}
              </button>
            </div>
          </div>
        )}

        {/* === TEAM TAB === */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            {/* Members */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Members</h3>
              <div className="space-y-2">
                {members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(member.user.name ?? member.user.email ?? '?')[0]!.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {member.user.name ?? member.user.email}
                        </p>
                        <p className="text-xs text-slate-400">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground disabled:opacity-60 focus:outline-none focus:border-primary"
                        disabled={!canManage}
                        value={member.role}
                        onChange={(e) => {
                          if (effectiveWsId) {
                            updateRole.mutate({
                              workspaceId: effectiveWsId,
                              memberId: member.id,
                              role: e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER',
                            });
                          }
                        }}
                      >
                        <option value="OWNER">Owner</option>
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </select>
                      {canManage && member.role !== 'OWNER' && member.user.id !== session?.user?.id && (
                        <button
                          className="text-xs font-medium text-rose-500 hover:text-rose-600"
                          onClick={() => {
                            if (effectiveWsId && window.confirm(`Remove ${member.user.name ?? member.user.email}?`)) {
                              removeMember.mutate({ workspaceId: effectiveWsId, memberId: member.id });
                            }
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {(!members || members.length === 0) && (
                  <p className="text-xs text-slate-400 italic">No members yet.</p>
                )}
              </div>
            </div>

            {/* Invite */}
            {canManage && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground">Invite by email</h3>
                <div className="flex gap-3">
                  <input
                    className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:bg-card focus:border-primary focus:outline-none transition-all"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    type="email"
                  />
                  <select
                    className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'OWNER' | 'ADMIN' | 'MEMBER')}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    <option value="OWNER">Owner</option>
                  </select>
                  <button
                    className="rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:bg-primary/90"
                    disabled={!effectiveWsId || !inviteEmail || createInvite.isPending}
                    onClick={() => {
                      if (effectiveWsId) {
                        createInvite.mutate({ workspaceId: effectiveWsId, email: inviteEmail, role: inviteRole });
                      }
                    }}
                    type="button"
                  >
                    {createInvite.isPending ? 'Sending…' : 'Send invite'}
                  </button>
                </div>
              </div>
            )}

            {/* Pending invites */}
            {canManage && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground">Pending invites</h3>
                <div className="space-y-2">
                  {invites && invites.length > 0 ? (
                    invites.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{inv.email}</p>
                          <p className="text-xs text-slate-400">Role: {inv.role}</p>
                        </div>
                        <button
                          className="text-xs font-medium text-rose-500 hover:text-rose-600"
                          onClick={() => revokeInvite.mutate({ id: inv.id })}
                          type="button"
                        >
                          Revoke
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No pending invites.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === BOARDS TAB === */}
        {activeTab === 'boards' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">All boards</h3>
            <div className="space-y-2">
              {boards && boards.length > 0 ? (
                boards.map((board) => (
                  <div key={board.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    {editingBoardId === board.id ? (
                      <div className="flex flex-1 gap-2">
                        <input
                          className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                          value={editingBoardTitle}
                          onChange={(e) => setEditingBoardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editingBoardTitle.trim()) {
                              updateBoard.mutate({ id: board.id, title: editingBoardTitle.trim() });
                            }
                            if (e.key === 'Escape') setEditingBoardId(null);
                          }}
                          autoFocus
                        />
                        <button
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          disabled={!editingBoardTitle.trim() || updateBoard.isPending}
                          onClick={() => updateBoard.mutate({ id: board.id, title: editingBoardTitle.trim() })}
                          type="button"
                        >
                          Save
                        </button>
                        <button
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/70 hover:bg-muted"
                          onClick={() => setEditingBoardId(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{board.title}</p>
                          {board.description && (
                            <p className="text-xs text-slate-400 mt-0.5">{board.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            className="text-xs font-medium text-primary hover:text-primary/80"
                            onClick={() => {
                              setEditingBoardId(board.id);
                              setEditingBoardTitle(board.title);
                            }}
                            type="button"
                          >
                            Rename
                          </button>
                          <button
                            className="text-xs font-medium text-rose-500 hover:text-rose-600"
                            onClick={() => {
                              if (window.confirm(`Delete board "${board.title}"? This cannot be undone.`)) {
                                deleteBoard.mutate({ id: board.id });
                              }
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No boards in this workspace.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
