'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { trpc } from '@/trpc/react';
import { skipToken } from '@tanstack/react-query';
import { useToast } from '../_components/toast_provider';

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.7 6.3l-.7-.4a4.9 4.9 0 00-.5-.9l.1-.8a.5.5 0 00-.2-.5l-1-1a.5.5 0 00-.5-.1l-.8.1a4.9 4.9 0 00-.9-.5l-.4-.7a.5.5 0 00-.4-.3H7.1a.5.5 0 00-.4.3l-.4.7c-.3.1-.6.3-.9.5l-.8-.1a.5.5 0 00-.5.2l-1 1a.5.5 0 00-.1.5l.1.8c-.2.3-.4.6-.5.9l-.7.4a.5.5 0 00-.3.4v1.4a.5.5 0 00.3.4l.7.4c.1.3.3.6.5.9l-.1.8a.5.5 0 00.2.5l1 1a.5.5 0 00.5.1l.8-.1c.3.2.6.4.9.5l.4.7a.5.5 0 00.4.3h1.4a.5.5 0 00.4-.3l.4-.7c.3-.1.6-.3.9-.5l.8.1a.5.5 0 00.5-.2l1-1a.5.5 0 00.1-.5l-.1-.8c.2-.3.4-.6.5-.9l.7-.4a.5.5 0 00.3-.4V6.7a.5.5 0 00-.3-.4z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Tab = 'workspace' | 'team' | 'boards';

/* ------------------------------------------------------------------ */
/*  Inline Confirm Button                                              */
/* ------------------------------------------------------------------ */
function InlineConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
  confirmClassName,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  confirmClassName?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startConfirm = useCallback(() => {
    setConfirming(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setConfirming(false), 4000);
  }, []);

  const handleConfirm = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onConfirm();
  }, [onConfirm]);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          className={confirmClassName ?? 'text-xs font-semibold text-rose-600 hover:text-rose-700'}
          onClick={handleConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
        <button
          className="text-xs text-slate-400 hover:text-slate-600"
          onClick={() => setConfirming(false)}
          type="button"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      className={className ?? 'text-xs font-medium text-rose-500 hover:text-rose-600'}
      onClick={startConfirm}
      type="button"
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings Page                                                      */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const { status, data: session } = useSession();
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('workspace');

  // --- data ---
  const { data: workspaces } = trpc.workspaces.listMine.useQuery(undefined, {
    enabled: status === 'authenticated',
  });
  const workspaceList = Array.isArray(workspaces) ? workspaces : [];
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const effectiveWsId = selectedWsId ?? workspaceList[0]?.id ?? null;
  const selectedWs = workspaceList.find((w) => w.id === effectiveWsId);

  // --- workspace create ---
  const [createName, setCreateName] = useState('');
  const createWorkspace = trpc.workspaces.create.useMutation({
    onSuccess: async (created) => {
      setCreateName('');
      setSelectedWsId(created.id);
      pushToast({ title: 'Workspace created', description: created.name, tone: 'success' });
      await utils.workspaces.listMine.invalidate();
    },
    onError: (e) => pushToast({ title: 'Create failed', description: e.message, tone: 'error' }),
  });

  // --- workspace rename ---
  const renameValue = selectedWs?.name ?? '';
  const [renameInput, setRenameInput] = useState<string | null>(null);
  const [prevWsId, setPrevWsId] = useState<string | null>(effectiveWsId);
  if (effectiveWsId !== prevWsId) {
    setPrevWsId(effectiveWsId);
    setRenameInput(null);
  }
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
      setDeleteConfirm('');
      await utils.workspaces.listMine.invalidate();
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

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">Sign in to access settings.</p>
          <Link href="/sign-in" className="mt-4 inline-flex rounded-md bg-primary px-6 py-2 text-xs font-semibold text-white">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'team', label: 'Team' },
    { id: 'boards', label: 'Boards' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeftIcon />
          Back to dashboard
        </Link>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="text-slate-400" />
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          {workspaceList.length > 1 && (
            <select
              aria-label="Select workspace"
              className="ml-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              value={effectiveWsId ?? ''}
              onChange={(e) => setSelectedWsId(e.target.value)}
            >
              {workspaceList.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-8" role="tablist" aria-label="Settings tabs">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                let nextIdx = idx;
                if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
                else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
                else if (e.key === 'Home') nextIdx = 0;
                else if (e.key === 'End') nextIdx = tabs.length - 1;
                else return;
                e.preventDefault();
                const next = tabs[nextIdx]!;
                setActiveTab(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              }}
              className={`relative px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-slate-500 hover:text-slate-700'
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
        <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {/* === WORKSPACE TAB === */}
          {activeTab === 'workspace' && (
            <div className="space-y-8">
              {/* Create workspace */}
              <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-foreground">Create workspace</h3>
                <p className="mt-1 text-xs text-slate-500">Add a new workspace to organize your boards and team.</p>
                <div className="mt-4 flex gap-3">
                  <input
                    aria-label="New workspace name"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all"
                    placeholder="Workspace name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                  />
                  <button
                    className="rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:bg-primary/90"
                    disabled={!createName.trim() || createWorkspace.isPending}
                    onClick={() => createWorkspace.mutate({ name: createName.trim() })}
                    type="button"
                  >
                    {createWorkspace.isPending ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </section>

              {/* Rename */}
              {selectedWs && (
                <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-foreground">Rename workspace</h3>
                  <p className="mt-1 text-xs text-slate-500">Change the display name for &ldquo;{selectedWs.name}&rdquo;.</p>
                  <div className="mt-4 flex gap-3">
                    <input
                      aria-label="Rename workspace"
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all"
                      value={effectiveRenameValue}
                      onChange={(e) => setRenameInput(e.target.value)}
                      placeholder="Workspace name"
                    />
                    <button
                      className="rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:bg-primary/90"
                      disabled={!effectiveRenameValue.trim() || effectiveRenameValue === selectedWs.name || renameMut.isPending}
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
                </section>
              )}

              {/* Delete */}
              {selectedWs && (
                <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-rose-700">Delete workspace</h3>
                  <p className="mt-1 text-xs text-rose-600/80">
                    This will permanently delete the workspace, all boards, and data. This action cannot be undone.
                  </p>
                  <p className="mt-3 text-xs text-slate-600">
                    Type <strong>{selectedWs.name}</strong> to confirm:
                  </p>
                  <input
                    aria-label="Type workspace name to confirm deletion"
                    className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:border-rose-400 focus:outline-none transition-all"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="Type workspace name to confirm"
                  />
                  <button
                    className="mt-3 rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:bg-rose-700"
                    disabled={deleteConfirm.toLowerCase() !== selectedWs.name.toLowerCase() || deleteMut.isPending}
                    onClick={() => {
                      if (effectiveWsId) deleteMut.mutate({ workspaceId: effectiveWsId });
                    }}
                    type="button"
                  >
                    {deleteMut.isPending ? 'Deleting…' : 'Delete workspace'}
                  </button>
                </section>
              )}
            </div>
          )}

          {/* === TEAM TAB === */}
          {activeTab === 'team' && (
            <div className="space-y-8">
              {/* Members */}
              <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-foreground">Members</h3>
                <div className="mt-4 space-y-2">
                  {members?.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {(member.user.name ?? member.user.email ?? '?')[0]!.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {member.user.name ?? member.user.email}
                          </p>
                          <p className="text-xs text-slate-500">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Role for ${member.user.name ?? member.user.email}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-foreground disabled:opacity-60 focus:outline-none focus:border-primary"
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
                          <InlineConfirmButton
                            label="Remove"
                            confirmLabel="Yes, remove"
                            onConfirm={() => {
                              if (effectiveWsId) {
                                removeMember.mutate({ workspaceId: effectiveWsId, memberId: member.id });
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  {(!members || members.length === 0) && (
                    <p className="text-xs text-slate-500 italic">No members yet.</p>
                  )}
                </div>
              </section>

              {/* Invite */}
              {canManage && (
                <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-foreground">Invite by email</h3>
                  <p className="mt-1 text-xs text-slate-500">Send an invitation link to add a new team member.</p>
                  <div className="mt-4 flex gap-3">
                    <input
                      aria-label="Invite email address"
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all"
                      placeholder="email@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                    />
                    <select
                      aria-label="Invite role"
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
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
                </section>
              )}

              {/* Pending invites */}
              {canManage && (
                <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-foreground">Pending invites</h3>
                  <div className="mt-4 space-y-2">
                    {invites && invites.length > 0 ? (
                      invites.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{inv.email}</p>
                            <p className="text-xs text-slate-500">Role: {inv.role.charAt(0) + inv.role.slice(1).toLowerCase()}</p>
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
                      <p className="text-xs text-slate-500 italic">No pending invites.</p>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* === BOARDS TAB === */}
          {activeTab === 'boards' && (
            <div className="space-y-4">
              <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-foreground">All boards</h3>
                <div className="mt-4 space-y-2">
                  {boards && boards.length > 0 ? (
                    boards.map((board) => (
                      <div key={board.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        {editingBoardId === board.id ? (
                          <div className="flex flex-1 gap-2">
                            <input
                              aria-label="Board name"
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
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
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
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
                                <p className="text-xs text-slate-500 mt-0.5">{board.description}</p>
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
                              <InlineConfirmButton
                                label="Delete"
                                confirmLabel="Yes, delete"
                                onConfirm={() => deleteBoard.mutate({ id: board.id })}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">No boards in this workspace.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
