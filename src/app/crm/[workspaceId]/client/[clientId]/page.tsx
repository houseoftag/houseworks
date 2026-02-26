'use client';

import { use, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { skipToken } from '@tanstack/react-query';
import { trpc } from '@/trpc/react';
import { useToast } from '@/app/_components/toast_provider';
import { Sidebar } from '@/app/_components/sidebar';
import { Header } from '@/app/_components/header';
import { NewItemDialog } from '@/app/_components/new_item_dialog';
import { ShortcutHelpOverlay } from '@/app/_components/shortcut_help_overlay';
import { CrmInvoiceDialog } from '@/app/_components/crm_invoice_dialog';
import type { CrmEntryType } from '@prisma/client';

const ENTRY_ICONS: Record<CrmEntryType, string> = {
  NOTE: '📝',
  DOCUMENT: '📄',
  DELIVERABLE: '📦',
  EMAIL: '📧',
  INVOICE: '💰',
  MEETING: '🤝',
  CALL: '📞',
};

const ENTRY_COLORS: Record<CrmEntryType, string> = {
  NOTE: 'bg-muted text-foreground/70',
  DOCUMENT: 'bg-blue-500/15 text-blue-500',
  DELIVERABLE: 'bg-violet-500/15 text-violet-500',
  EMAIL: 'bg-sky-500/15 text-sky-500',
  INVOICE: 'bg-emerald-500/15 text-emerald-600',
  MEETING: 'bg-amber-500/15 text-amber-600',
  CALL: 'bg-orange-500/15 text-orange-500',
};

const TIER_COLORS: Record<string, string> = {
  New: 'bg-muted text-foreground/70',
  Active: 'bg-emerald-500/15 text-emerald-600',
  VIP: 'bg-violet-500/15 text-violet-500',
  Inactive: 'bg-red-500/10 text-red-500',
};

/** Generate a consistent color from a name for the avatar */
function avatarColor(name: string): string {
  const palette = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-sky-500', 'bg-indigo-500', 'bg-teal-500',
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type CrmBoardType = {
  groups: { id: string; title: string; color: string | null; position: number }[];
  columns: { id: string; title: string; type: string; position: number }[];
};

type DealItemType = {
  id: string;
  name: string;
  group: { id: string; title: string; color: string | null };
  cellValues: { id: string; value: unknown; column: { id: string; title: string; type: string } }[];
};

/** Get a cell value for a given column title pattern */
function getCellValue(item: DealItemType, pattern: string): string {
  const cell = item.cellValues.find((c) => c.column.title.toLowerCase().includes(pattern.toLowerCase()));
  return cell?.value != null ? String(cell.value) : '';
}

/** Convert hex color to an inline style for badges */
function groupBadgeStyle(hexColor: string) {
  return {
    backgroundColor: hexColor + '22',
    color: hexColor,
  } as const;
}

function ItemEditForm({
  item,
  crmBoard,
  onSave,
  onDelete,
  onClose,
  isSaving,
  isDeleting,
}: {
  item: DealItemType;
  crmBoard: CrmBoardType;
  onSave: (data: { name?: string; groupId?: string; cellUpdates: { columnId: string; value: unknown }[] }) => void;
  onDelete: () => void;
  onClose: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const [name, setName] = useState(item.name);
  const [groupId, setGroupId] = useState(item.group.id);
  const [cellDraft, setCellDraft] = useState<Record<string, string>>(() => {
    const draft: Record<string, string> = {};
    for (const col of crmBoard.columns) {
      const cell = item.cellValues.find((c) => c.column.id === col.id);
      draft[col.id] = cell?.value != null ? String(cell.value) : '';
    }
    return draft;
  });

  const handleSave = () => {
    const cellUpdates: { columnId: string; value: unknown }[] = [];
    for (const col of crmBoard.columns) {
      const raw = cellDraft[col.id] ?? '';
      const existing = item.cellValues.find((c) => c.column.id === col.id);
      const oldVal = existing?.value != null ? String(existing.value) : '';
      if (raw !== oldVal) {
        let value: unknown = raw || null;
        if (col.type === 'NUMBER' && raw) value = parseFloat(raw.replace(/,/g, ''));
        cellUpdates.push({ columnId: col.id, value });
      }
    }
    onSave({
      name: name.trim() !== item.name ? name.trim() : undefined,
      groupId: groupId !== item.group.id ? groupId : undefined,
      cellUpdates,
    });
  };

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
        placeholder="Item name"
      />
      <select
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
      >
        {crmBoard.groups.map((g) => (
          <option key={g.id} value={g.id}>{g.title}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        {crmBoard.columns
          .filter((col) => col.type !== 'CLIENT')
          .map((col) => (
            <div key={col.id}>
              <label className="block text-xs font-medium text-slate-500 mb-0.5">{col.title}</label>
              {col.type === 'NUMBER' ? (
                <input
                  type="text"
                  placeholder="0"
                  value={cellDraft[col.id] ? Number(String(cellDraft[col.id]).replace(/,/g, '')).toLocaleString() : ''}
                  onChange={(e) => setCellDraft((d) => ({ ...d, [col.id]: e.target.value.replace(/,/g, '') }))}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              ) : col.type === 'DATE' ? (
                <input
                  type="date"
                  value={cellDraft[col.id] ?? ''}
                  onChange={(e) => setCellDraft((d) => ({ ...d, [col.id]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={cellDraft[col.id] ?? ''}
                  onChange={(e) => setCellDraft((d) => ({ ...d, [col.id]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              )}
            </div>
          ))}
      </div>
      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="min-h-[44px] text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/70"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || isSaving}
            onClick={handleSave}
            className="min-h-[44px] rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientProfilePage({
  params,
}: {
  params: Promise<{ workspaceId: string; clientId: string }>;
}) {
  const { workspaceId, clientId } = use(params);
  const { status } = useSession();
  const { pushToast } = useToast();
  const router = useRouter();
  const isAuthed = status === 'authenticated';
  const utils = trpc.useUtils();

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<{
    displayName: string; company: string; email: string; website: string; phone: string; address: string; tier: string; tags: string;
  }>({ displayName: '', company: '', email: '', website: '', phone: '', address: '', tier: '', tags: '' });

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [entryType, setEntryType] = useState<CrmEntryType>('NOTE');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryBody, setEntryBody] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [entryTime, setEntryTime] = useState('');
  const [entryLinkUrl, setEntryLinkUrl] = useState('');

  // Timeline filters (C2)
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineTypeFilter, setTimelineTypeFilter] = useState<CrmEntryType | null>(null);

  // Contacts state
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRole, setContactRole] = useState('');

  // Deals state (backed by Board Items)
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [newDealName, setNewDealName] = useState('');
  const [newDealGroupId, setNewDealGroupId] = useState('');
  const [newDealValues, setNewDealValues] = useState<Record<string, string>>({});
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);

  const { data: qbIntegration } = trpc.quickbooks.getIntegration.useQuery(
    workspaceId ? { workspaceId } : skipToken,
  );

  const { data: client, isLoading } = trpc.crm.getClient.useQuery(
    isAuthed ? { clientId } : skipToken,
  );

  useEffect(() => {
    if (client?.displayName) {
      document.title = `${client.displayName} — CRM — Houseworks`;
    } else {
      document.title = 'Client — CRM — Houseworks';
    }
  }, [client?.displayName]);

  const updateProfile = trpc.crm.updateProfile.useMutation({
    onSuccess: async () => {
      setEditingProfile(false);
      pushToast({ title: 'Profile saved', tone: 'success' });
      await utils.crm.getClient.invalidate({ clientId });
    },
    onError: (e) => pushToast({ title: 'Save failed', description: e.message, tone: 'error' }),
  });

  const deleteClient = trpc.crm.deleteClient.useMutation({
    onSuccess: () => {
      pushToast({ title: 'Client deleted', tone: 'success' });
      router.push(`/crm/${workspaceId}`);
    },
    onError: (e) => pushToast({ title: 'Delete failed', description: e.message, tone: 'error' }),
  });

  const { data: crmBoard } = trpc.boards.getCrmBoard.useQuery(
    isAuthed ? { workspaceId } : skipToken,
  );

  const { data: dealItems = [] } = trpc.items.listByClient.useQuery(
    isAuthed ? { clientId } : skipToken,
  );

  const createItem = trpc.items.create.useMutation({
    onSuccess: async () => {
      await utils.items.listByClient.invalidate({ clientId });
      await utils.boards.getCrmBoard.invalidate({ workspaceId });
    },
    onError: (e) => pushToast({ title: 'Failed to create deal', description: e.message, tone: 'error' }),
  });

  const updateItem = trpc.items.update.useMutation({
    onSuccess: async () => {
      await utils.items.listByClient.invalidate({ clientId });
      await utils.boards.getCrmBoard.invalidate({ workspaceId });
    },
    onError: (e) => pushToast({ title: 'Failed to update deal', description: e.message, tone: 'error' }),
  });

  const deleteItem = trpc.items.delete.useMutation({
    onSuccess: async () => {
      await utils.items.listByClient.invalidate({ clientId });
      await utils.boards.getCrmBoard.invalidate({ workspaceId });
    },
    onError: (e) => pushToast({ title: 'Failed to delete deal', description: e.message, tone: 'error' }),
  });

  const updateCell = trpc.cells.update.useMutation({
    onSuccess: async () => {
      await utils.items.listByClient.invalidate({ clientId });
      await utils.boards.getCrmBoard.invalidate({ workspaceId });
    },
  });

  const { data: contacts = [] } = trpc.crm.listContacts.useQuery(
    isAuthed ? { clientId } : skipToken,
  );

  const addContact = trpc.crm.addContact.useMutation({
    onSuccess: async () => {
      setShowAddContact(false);
      setContactName(''); setContactEmail(''); setContactPhone(''); setContactRole('');
      pushToast({ title: 'Contact added', tone: 'success' });
      await utils.crm.listContacts.invalidate({ clientId });
    },
    onError: (e) => pushToast({ title: 'Failed to add contact', description: e.message, tone: 'error' }),
  });

  const deleteContact = trpc.crm.deleteContact.useMutation({
    onSuccess: async () => {
      await utils.crm.listContacts.invalidate({ clientId });
    },
    onError: (e) => pushToast({ title: 'Failed to delete contact', description: e.message, tone: 'error' }),
  });

  const addEntry = trpc.crm.addTimelineEntry.useMutation({
    onSuccess: async () => {
      setShowAddEntry(false);
      setEntryTitle('');
      setEntryBody('');
      setEntryDate(new Date().toISOString().split('T')[0]);
      setEntryTime('');
      setEntryLinkUrl('');
      pushToast({ title: 'Entry added', tone: 'success' });
      await utils.crm.getClient.invalidate({ clientId });
    },
    onError: (e) => pushToast({ title: 'Failed to add entry', description: e.message, tone: 'error' }),
  });

  const startEdit = () => {
    setProfileDraft({
      displayName: client?.displayName ?? '',
      company: client?.company ?? '',
      email: client?.email ?? '',
      website: client?.website ?? '',
      phone: client?.phone ?? '',
      address: client?.address ?? '',
      tier: client?.tier ?? '',
      tags: ((client as { tags?: string[] })?.tags ?? []).join(', '),
    });
    setEditingProfile(true);
  };

  const saveProfile = () => {
    const tags = profileDraft.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    updateProfile.mutate({
      clientId,
      displayName: profileDraft.displayName || undefined,
      company: profileDraft.company || undefined,
      email: profileDraft.email || undefined,
      website: profileDraft.website || undefined,
      phone: profileDraft.phone || undefined,
      address: profileDraft.address || undefined,
      tier: profileDraft.tier || undefined,
      tags,
    });
  };

  if (!isAuthed) return null;

  const tags = (client as { tags?: string[] })?.tags ?? [];
  const domains = (client as { domains?: string[] })?.domains ?? [];
  const tierColor = TIER_COLORS[client?.tier ?? ''] ?? 'bg-muted text-foreground/70';

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      <Sidebar
        onSelectBoard={(id) => router.push(`/?board=${id}`)}
        selectedBoardId={null}
        onNavigateDashboard={() => router.push('/')}
        currentView="crm"
        useLinks
      />

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header
          onSelectBoard={(id) => router.push(`/?board=${id}`)}
          onSelectItem={(_, boardId) => router.push(`/?board=${boardId}`)}
          breadcrumb={`Houseworks — CRM — ${client?.displayName ?? '…'}`}
          titleElement="p"
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          {isLoading ? (
            <div className="mx-auto max-w-5xl space-y-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse bg-muted" />)}
            </div>
          ) : !client ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-slate-500">Client not found.</p>
                <Link href={`/crm/${workspaceId}`} className="mt-2 text-sm text-primary hover:underline">Back to CRM</Link>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl">
              {/* Breadcrumb */}
              <Link
                href={`/crm/${workspaceId}`}
                className="inline-flex items-center gap-1 min-h-[44px] text-sm text-slate-400 hover:text-primary mb-4"
              >
                Back to CRM
              </Link>

              <div className="mt-2 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Profile Panel */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    {/* Avatar + name header */}
                    <div className="flex items-start gap-4 mb-5">
                      <div className={`flex-shrink-0 h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold text-white ${avatarColor(client.displayName)}`}>
                        {initials(client.displayName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-foreground leading-tight">{client.displayName}</h1>
                        {client.company && (
                          <p className="text-sm text-slate-500 mt-0.5 truncate">{client.company}</p>
                        )}
                        {client.tier && (
                          <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierColor}`}>
                            {client.tier}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={startEdit}
                        className="min-h-[44px] px-3 text-xs font-medium text-primary hover:text-primary/80 flex-shrink-0"
                      >
                        Edit
                      </button>
                    </div>

                    {editingProfile ? (
                      <div className="space-y-2">
                        {([
                          ['displayName', 'Display Name'],
                          ['company', 'Company'],
                          ['email', 'Email'],
                          ['phone', 'Phone'],
                          ['website', 'Website'],
                          ['address', 'Address'],
                          ['tier', 'Tier (New / Active / VIP / Inactive)'],
                          ['tags', 'Tags (comma-separated)'],
                        ] as const).map(([field, label]) => (
                          <div key={field}>
                            <label className="block text-xs font-medium text-slate-500 mb-0.5">{label}</label>
                            <input
                              type={field === 'email' ? 'email' : 'text'}
                              value={profileDraft[field]}
                              onChange={(e) => setProfileDraft((d) => ({ ...d, [field]: e.target.value }))}
                              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:bg-card"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={saveProfile}
                            disabled={updateProfile.isPending}
                            className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {updateProfile.isPending ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProfile(false)}
                            className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-xs text-foreground/70"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <dl className="space-y-2 text-sm">
                        {client.email && (
                          <div className="flex gap-2">
                            <dt className="w-20 flex-shrink-0 text-slate-400 text-xs font-medium">Email</dt>
                            <dd><a href={`mailto:${client.email}`} className="text-primary hover:underline text-xs">{client.email}</a></dd>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex gap-2">
                            <dt className="w-20 flex-shrink-0 text-slate-400 text-xs font-medium">Phone</dt>
                            <dd className="text-xs">{client.phone}</dd>
                          </div>
                        )}
                        {client.website && (
                          <div className="flex gap-2">
                            <dt className="w-20 flex-shrink-0 text-slate-400 text-xs font-medium">Website</dt>
                            <dd>
                              <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                                {client.website.replace(/^https?:\/\//, '')}
                              </a>
                            </dd>
                          </div>
                        )}
                        {client.address && (
                          <div className="flex gap-2">
                            <dt className="w-20 flex-shrink-0 text-slate-400 text-xs font-medium">Address</dt>
                            <dd className="text-xs">{client.address}</dd>
                          </div>
                        )}
                        {domains.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            <dt className="w-20 flex-shrink-0 text-slate-400 text-xs font-medium">Domains</dt>
                            <dd className="flex flex-wrap gap-1">
                              {domains.map((d) => (
                                <span key={d} className="rounded-full bg-sky-500/15 text-sky-600 px-2 py-0.5 text-[10px] font-mono font-medium">{d}</span>
                              ))}
                            </dd>
                          </div>
                        )}
                        {tags.length > 0 && (
                          <div className="flex gap-2 flex-wrap pt-1">
                            {tags.map((tag) => (
                              <span key={tag} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                tag === 'needs-reply' ? 'bg-red-500/15 text-red-600' :
                                tag === 'at-risk' ? 'bg-amber-500/15 text-amber-600' :
                                tag === 'upsell-candidate' ? 'bg-emerald-500/15 text-emerald-600' :
                                'bg-muted text-foreground/70'
                              }`}>{tag}</span>
                            ))}
                          </div>
                        )}
                        {!client.email && !client.phone && !client.website && !client.address && tags.length === 0 && domains.length === 0 && (
                          <p className="text-xs text-slate-400 italic">No profile details yet.</p>
                        )}
                      </dl>
                    )}

                    {/* Delete */}
                    {!editingProfile && (
                      <div className="mt-6 pt-4 border-t border-border">
                        {showDeleteConfirm ? (
                          <div className="space-y-2">
                            <p className="text-xs text-foreground/70">Delete this client permanently?</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => deleteClient.mutate({ clientId })}
                                disabled={deleteClient.isPending}
                                className="min-h-[44px] rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                {deleteClient.isPending ? 'Deleting…' : 'Yes, delete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="min-h-[44px] rounded-lg border border-border px-3 py-2 text-xs text-foreground/70"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="min-h-[44px] text-xs text-red-500 hover:text-red-600 font-medium"
                          >
                            Delete client
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Deals section (backed by CRM Board Items) */}
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-foreground">Deals</h2>
                      <button
                        type="button"
                        onClick={() => {
                          if (crmBoard?.groups[0]) setNewDealGroupId(crmBoard.groups[0].id);
                          setNewDealValues({});
                          setNewDealName('');
                          setShowAddDeal(true);
                        }}
                        className="min-h-[44px] rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                      >
                        + Add Deal
                      </button>
                    </div>

                    {showAddDeal && crmBoard && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
                          <h3 className="text-base font-bold mb-4">New Deal</h3>
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Deal name *"
                              value={newDealName}
                              onChange={(e) => setNewDealName(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                              autoFocus
                            />
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-0.5">Stage</label>
                              <select
                                value={newDealGroupId}
                                onChange={(e) => setNewDealGroupId(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                              >
                                {crmBoard.groups.map((g) => (
                                  <option key={g.id} value={g.id}>{g.title}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {crmBoard.columns
                                .filter((col) => col.type !== 'CLIENT')
                                .map((col) => (
                                  <div key={col.id}>
                                    <label className="block text-xs font-medium text-slate-500 mb-0.5">{col.title}</label>
                                    {col.type === 'NUMBER' ? (
                                      <input
                                        type="text"
                                        placeholder="0"
                                        value={newDealValues[col.id] ? Number(String(newDealValues[col.id]).replace(/,/g, '')).toLocaleString() : ''}
                                        onChange={(e) => setNewDealValues((d) => ({ ...d, [col.id]: e.target.value.replace(/,/g, '') }))}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                                      />
                                    ) : col.type === 'DATE' ? (
                                      <input
                                        type="date"
                                        value={newDealValues[col.id] ?? ''}
                                        onChange={(e) => setNewDealValues((d) => ({ ...d, [col.id]: e.target.value }))}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={newDealValues[col.id] ?? ''}
                                        onChange={(e) => setNewDealValues((d) => ({ ...d, [col.id]: e.target.value }))}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                                      />
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4">
                            <button
                              type="button"
                              onClick={() => setShowAddDeal(false)}
                              className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm text-foreground/70"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!newDealName.trim() || !newDealGroupId || createItem.isPending}
                              onClick={async () => {
                                const created = await createItem.mutateAsync({
                                  groupId: newDealGroupId,
                                  name: newDealName.trim(),
                                  clientId,
                                });
                                // Set cell values for each column
                                const cellPromises: Promise<unknown>[] = [];
                                for (const col of crmBoard.columns) {
                                  if (col.type === 'CLIENT') {
                                    cellPromises.push(updateCell.mutateAsync({ itemId: created.id, columnId: col.id, value: clientId }));
                                  } else {
                                    const raw = newDealValues[col.id];
                                    if (raw) {
                                      let value: unknown = raw;
                                      if (col.type === 'NUMBER') value = parseFloat(raw.replace(/,/g, ''));
                                      cellPromises.push(updateCell.mutateAsync({ itemId: created.id, columnId: col.id, value }));
                                    }
                                  }
                                }
                                await Promise.all(cellPromises);
                                setShowAddDeal(false);
                                setNewDealName('');
                                setNewDealGroupId('');
                                setNewDealValues({});
                                pushToast({ title: 'Deal created', tone: 'success' });
                              }}
                              className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {createItem.isPending ? 'Creating...' : 'Create'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {dealItems.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No deals yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {dealItems.map((item) => {
                          const valueStr = getCellValue(item, 'value');
                          const probStr = getCellValue(item, 'probability');
                          const valueNum = valueStr ? parseFloat(valueStr) : null;
                          const probNum = probStr ? parseInt(probStr) : null;
                          return (
                            <div key={item.id} className="rounded-lg border border-border bg-background p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span
                                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                      style={groupBadgeStyle(item.group.color ?? '#94a3b8')}
                                    >
                                      {item.group.title}
                                    </span>
                                    {valueNum != null && !isNaN(valueNum) && (
                                      <span className="text-xs text-foreground/70">
                                        ${valueNum.toLocaleString()}
                                      </span>
                                    )}
                                    {probNum != null && !isNaN(probNum) && (
                                      <span className="text-xs text-slate-400">{probNum}%</span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedDealId(expandedDealId === item.id ? null : item.id)}
                                  className="min-h-[44px] px-2 text-xs text-slate-400 hover:text-foreground/70"
                                >
                                  {expandedDealId === item.id ? '\u25B2' : '\u25BC'}
                                </button>
                              </div>
                              {expandedDealId === item.id && crmBoard && (
                                <ItemEditForm
                                  item={item}
                                  crmBoard={crmBoard}
                                  onSave={async (data) => {
                                    const promises: Promise<unknown>[] = [];
                                    if (data.name || data.groupId) {
                                      promises.push(updateItem.mutateAsync({
                                        id: item.id,
                                        ...(data.name ? { name: data.name } : {}),
                                        ...(data.groupId ? { groupId: data.groupId } : {}),
                                      }));
                                    }
                                    for (const cu of data.cellUpdates) {
                                      promises.push(updateCell.mutateAsync({
                                        itemId: item.id,
                                        columnId: cu.columnId,
                                        value: cu.value,
                                      }));
                                    }
                                    await Promise.all(promises);
                                    setExpandedDealId(null);
                                  }}
                                  onDelete={async () => {
                                    await deleteItem.mutateAsync({ id: item.id });
                                    setExpandedDealId(null);
                                  }}
                                  onClose={() => setExpandedDealId(null)}
                                  isSaving={updateItem.isPending || updateCell.isPending}
                                  isDeleting={deleteItem.isPending}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Contacts section */}
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-foreground">Contacts</h2>
                      <button
                        type="button"
                        onClick={() => setShowAddContact(true)}
                        className="min-h-[44px] rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                      >
                        + Add Contact
                      </button>
                    </div>

                    {showAddContact && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
                          <h3 className="text-base font-bold mb-4">New Contact</h3>
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Full name *"
                              value={contactName}
                              onChange={(e) => setContactName(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                              autoFocus
                            />
                            <input
                              type="email"
                              placeholder="Email (optional)"
                              value={contactEmail}
                              onChange={(e) => setContactEmail(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                            />
                            <input
                              type="text"
                              placeholder="Phone (optional)"
                              value={contactPhone}
                              onChange={(e) => setContactPhone(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                            />
                            <input
                              type="text"
                              placeholder="Role / title (optional)"
                              value={contactRole}
                              onChange={(e) => setContactRole(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                            />
                          </div>
                          <div className="flex justify-end gap-2 mt-4">
                            <button
                              type="button"
                              onClick={() => setShowAddContact(false)}
                              className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm text-foreground/70"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!contactName.trim() || addContact.isPending}
                              onClick={() => addContact.mutate({
                                clientId,
                                displayName: contactName.trim(),
                                email: contactEmail.trim() || undefined,
                                phone: contactPhone.trim() || undefined,
                                role: contactRole.trim() || undefined,
                              })}
                              className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {addContact.isPending ? 'Adding…' : 'Add'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {contacts.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No contacts yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div key={contact.id} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background p-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">{contact.displayName}</p>
                              {contact.role && <p className="text-xs text-slate-400 mt-0.5">{contact.role}</p>}
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="text-xs text-primary hover:underline block mt-0.5">{contact.email}</a>
                              )}
                              {contact.phone && <p className="text-xs text-slate-500 mt-0.5">{contact.phone}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteContact.mutate({ contactId: contact.id })}
                              disabled={deleteContact.isPending}
                              className="min-h-[44px] px-2 text-xs text-slate-400 hover:text-red-500 flex-shrink-0"
                              aria-label={`Delete contact ${contact.displayName}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Timeline */}
                <div className="lg:col-span-3">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-foreground">Timeline</h2>
                    <div className="flex items-center gap-2">
                      {qbIntegration && (
                        <button
                          type="button"
                          onClick={() => setShowInvoiceDialog(true)}
                          className="min-h-[44px] rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20"
                        >
                          Create Invoice
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowAddEntry(true)}
                        className="min-h-[44px] rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                      >
                        + Add entry
                      </button>
                    </div>
                  </div>

                  {showInvoiceDialog && (
                    <CrmInvoiceDialog
                      workspaceId={workspaceId}
                      clientId={clientId}
                      customerRef={client.company ?? client.displayName}
                      onClose={() => setShowInvoiceDialog(false)}
                      onSuccess={() => utils.crm.getClient.invalidate({ clientId })}
                    />
                  )}

                  {showAddEntry && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-base font-bold mb-4">Add Timeline Entry</h3>
                        <div className="space-y-3">
                          {/* C4: Type picker grid */}
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(Object.keys(ENTRY_ICONS) as CrmEntryType[]).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setEntryType(t)}
                                  className={`flex flex-col items-center gap-0.5 rounded-lg border p-2 text-[10px] font-semibold transition-colors ${
                                    entryType === t
                                      ? 'border-primary bg-primary/5 text-primary'
                                      : 'border-border text-slate-500 hover:border-border hover:bg-background'
                                  }`}
                                >
                                  <span className="text-sm">{ENTRY_ICONS[t]}</span>
                                  <span className="capitalize">{t.toLowerCase()}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* C5: Date/time fields */}
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
                              <input
                                type="date"
                                value={entryDate}
                                onChange={(e) => setEntryDate(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                required
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-500 mb-1">Time (optional)</label>
                              <input
                                type="time"
                                value={entryTime}
                                onChange={(e) => setEntryTime(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* C6: Conditional title field — hidden for Meeting/Call */}
                          {!['MEETING', 'CALL'].includes(entryType) && (
                            <input
                              type="text"
                              placeholder="Title *"
                              value={entryTitle}
                              onChange={(e) => setEntryTitle(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                              autoFocus
                            />
                          )}

                          {/* C6: Notes textarea */}
                          <textarea
                            placeholder="Notes (optional)"
                            value={entryBody}
                            onChange={(e) => setEntryBody(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card resize-none"
                          />

                          {/* C6: URL field for Document/Deliverable/Invoice */}
                          {['DOCUMENT', 'DELIVERABLE', 'INVOICE'].includes(entryType) && (
                            <input
                              type="url"
                              placeholder="Link/URL (optional)"
                              value={entryLinkUrl}
                              onChange={(e) => setEntryLinkUrl(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                            />
                          )}
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => setShowAddEntry(false)}
                            className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm text-foreground/70"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              (!['MEETING', 'CALL'].includes(entryType) && !entryTitle.trim()) ||
                              addEntry.isPending
                            }
                            onClick={() => {
                              const autoTitle = entryType === 'MEETING' ? 'Meeting' : entryType === 'CALL' ? 'Call' : entryTitle.trim();
                              const bodyParts: string[] = [];
                              if (entryLinkUrl.trim()) bodyParts.push(`[URL: ${entryLinkUrl.trim()}]`);
                              if (entryBody.trim()) bodyParts.push(entryBody.trim());
                              const finalBody = bodyParts.join('\n') || undefined;
                              addEntry.mutate({
                                clientId,
                                type: entryType,
                                title: autoTitle,
                                body: finalBody,
                                entryDate: entryDate || undefined,
                                entryTime: entryTime || undefined,
                              });
                            }}
                            className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {addEntry.isPending ? 'Adding…' : 'Add'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* C2: Timeline search + type filter */}
                  {client.timeline.length > 0 && (
                    <div className="mb-3 space-y-2">
                      <input
                        type="search"
                        aria-label="Search timeline"
                        placeholder="Search timeline…"
                        value={timelineSearch}
                        onChange={(e) => setTimelineSearch(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTimelineTypeFilter(null)}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors min-h-[44px] ${
                            timelineTypeFilter === null
                              ? 'bg-primary text-white'
                              : 'bg-muted text-slate-500 hover:bg-border'
                          }`}
                        >
                          All
                        </button>
                        {(Object.keys(ENTRY_ICONS) as CrmEntryType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTimelineTypeFilter(timelineTypeFilter === t ? null : t)}
                            className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors min-h-[44px] ${
                              timelineTypeFilter === t
                                ? 'bg-primary text-white'
                                : 'bg-muted text-slate-500 hover:bg-border'
                            }`}
                          >
                            {ENTRY_ICONS[t]} {t.charAt(0) + t.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(() => {
                    // Apply filters (C2)
                    const searchLower = timelineSearch.toLowerCase();
                    const filtered = client.timeline.filter((entry) => {
                      if (timelineTypeFilter && entry.type !== timelineTypeFilter) return false;
                      if (searchLower) {
                        const inTitle = entry.title.toLowerCase().includes(searchLower);
                        const inBody = entry.body?.toLowerCase().includes(searchLower) ?? false;
                        if (!inTitle && !inBody) return false;
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="rounded-2xl border border-dashed border-border bg-background py-12 text-center">
                          <p className="text-sm text-slate-400">
                            {client.timeline.length === 0 ? 'No timeline entries yet.' : 'No entries match your filters.'}
                          </p>
                        </div>
                      );
                    }

                    // C1: Group entries by date
                    const groupedByDate: { dateKey: string; dateLabel: string; entries: typeof filtered }[] = [];
                    for (const entry of filtered) {
                      const rawDate = (entry as { entryDate?: string | null }).entryDate ?? entry.createdAt;
                      const dateKey = typeof rawDate === 'string'
                        ? rawDate.split('T')[0]
                        : (rawDate as Date).toISOString().split('T')[0];
                      const dateLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      });
                      const last = groupedByDate[groupedByDate.length - 1];
                      if (last && last.dateKey === dateKey) {
                        last.entries.push(entry);
                      } else {
                        groupedByDate.push({ dateKey, dateLabel, entries: [entry] });
                      }
                    }

                    return (
                      <div className="relative">
                        {/* C1: Vertical thru-line */}
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                        {groupedByDate.map((group) => (
                          <div key={group.dateKey}>
                            {/* C1: Date separator */}
                            <div className="relative flex items-center gap-2 py-2 pl-10">
                              <hr className="flex-1 border-border" />
                              <span className="flex-shrink-0 text-xs font-medium text-slate-400">{group.dateLabel}</span>
                              <hr className="flex-1 border-border" />
                            </div>
                            {group.entries.map((entry) => (
                              <div key={entry.id} className="relative pl-12 pb-3">
                                {/* C1: Icon dot */}
                                <div className={`absolute left-2 top-3 h-4 w-4 rounded-full flex items-center justify-center text-[10px] ${ENTRY_COLORS[entry.type]}`}>
                                  {ENTRY_ICONS[entry.type]}
                                </div>
                                <div className={`rounded-xl border border-transparent p-4 ${ENTRY_COLORS[entry.type]}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold tracking-wide opacity-70">
                                        {entry.type.charAt(0).toUpperCase() + entry.type.slice(1).toLowerCase().replace(/_/g, ' ')}
                                      </span>
                                      {entry.type === 'EMAIL' && (() => {
                                        const meta = entry.metadata as Record<string, unknown> | null;
                                        const cls = meta?.classification as string | undefined;
                                        if (!cls) return null;
                                        const clsColors: Record<string, string> = {
                                          NEED_REPLY: 'bg-red-500/15 text-red-600',
                                          FYI: 'bg-slate-200 text-slate-600',
                                          LEAD: 'bg-emerald-500/15 text-emerald-600',
                                          VENDOR: 'bg-blue-500/15 text-blue-600',
                                          IGNORE: 'bg-slate-100 text-slate-400',
                                        };
                                        return (
                                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${clsColors[cls] ?? 'bg-muted text-foreground/70'}`}>
                                            {cls.replace(/_/g, ' ')}
                                          </span>
                                        );
                                      })()}
                                      {entry.type === 'NOTE' && (() => {
                                        const meta = entry.metadata as Record<string, unknown> | null;
                                        if (meta?.nudgeDraft) {
                                          return (
                                            <span className="rounded-full bg-amber-500/15 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                                              DRAFT NUDGE
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <span className="text-xs opacity-50 flex-shrink-0" title={new Date(entry.createdAt).toLocaleString()}>{relativeTime(entry.createdAt)}</span>
                                  </div>
                                  <p className="mt-1 text-sm font-semibold">{entry.title}</p>
                                  {entry.body && <p className="mt-1 text-xs opacity-80 whitespace-pre-wrap">{entry.body}</p>}
                                  {entry.createdBy && (
                                    <p className="mt-2 text-xs opacity-50">by {entry.createdBy.name ?? 'Unknown'}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="flex-shrink-0 border-t border-border px-4 py-3 text-[10px] text-slate-400 lg:px-6">
          Houseworks
        </footer>
      </div>

      <NewItemDialog />
      <ShortcutHelpOverlay />
    </div>
  );
}
