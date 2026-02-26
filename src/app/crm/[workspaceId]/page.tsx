'use client';

import { use, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { skipToken } from '@tanstack/react-query';
import { trpc } from '@/trpc/react';
import { useToast } from '@/app/_components/toast_provider';
import { Sidebar } from '@/app/_components/sidebar';
import { Header } from '@/app/_components/header';
import { NewItemDialog } from '@/app/_components/new_item_dialog';
import { ShortcutHelpOverlay } from '@/app/_components/shortcut_help_overlay';
import { CrmDashboard } from '@/app/_components/crm_dashboard';
import type { DealStage } from '@prisma/client';

const DEAL_STAGE_COLUMNS: { stage: DealStage; label: string; color: string }[] = [
  { stage: 'LEAD', label: 'Lead', color: 'bg-muted border-border' },
  { stage: 'CONTACTED', label: 'Contacted', color: 'bg-blue-500/10 border-blue-500/20' },
  { stage: 'PROPOSAL', label: 'Proposal', color: 'bg-violet-500/10 border-violet-500/20' },
  { stage: 'NEGOTIATION', label: 'Negotiation', color: 'bg-amber-500/10 border-amber-500/20' },
  { stage: 'WON', label: 'Won', color: 'bg-emerald-500/10 border-emerald-500/20' },
  { stage: 'LOST', label: 'Lost', color: 'bg-red-500/10 border-red-500/20' },
];

type CrmTab = 'clients' | 'pipeline' | 'dashboard';

export default function CrmWorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { status } = useSession();
  const { pushToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthed = status === 'authenticated';
  const activeTab = (searchParams.get('tab') as CrmTab) ?? 'clients';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');

  // Filters, sort, bulk, columns
  const [filterTier, setFilterTier] = useState('');
  const [filterContact, setFilterContact] = useState<'' | 'email' | 'company' | 'phone'>('');
  const [sortField, setSortField] = useState<'displayName' | 'company'>('displayName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(['displayName', 'company', 'phone', 'website']),
  );
  const [bulkTier, setBulkTier] = useState('');
  const [showBulkTierInput, setShowBulkTierInput] = useState(false);

  useEffect(() => { document.title = 'CRM — Houseworks'; }, []);

  const utils = trpc.useUtils();

  const { data: clients = [], isLoading } = trpc.crm.listClients.useQuery(
    isAuthed ? { workspaceId } : skipToken,
  );

  const createClient = trpc.crm.createClient.useMutation({
    onSuccess: async () => {
      setShowCreate(false);
      setNewName('');
      pushToast({ title: 'Client created', tone: 'success' });
      await utils.crm.listClients.invalidate({ workspaceId });
    },
    onError: (e) => pushToast({ title: 'Failed to create client', description: e.message, tone: 'error' }),
  });

  const { data: allDeals = [] } = trpc.deals.listByWorkspace.useQuery(
    isAuthed ? { workspaceId } : skipToken,
  );

  const deleteClient = trpc.crm.deleteClient.useMutation({
    onSuccess: async () => {
      await utils.crm.listClients.invalidate({ workspaceId });
    },
  });

  const updateProfile = trpc.crm.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.crm.listClients.invalidate({ workspaceId });
    },
  });

  const filtered = clients
    .filter((client) => {
      const name = client.displayName.toLowerCase();
      const company = (client.company ?? '').toLowerCase();
      const q = search.trim().toLowerCase();
      if (q && !name.includes(q) && !company.includes(q)) return false;
      if (filterTier && client.tier !== filterTier) return false;
      if (filterContact === 'email' && !client.email) return false;
      if (filterContact === 'company' && !client.company) return false;
      if (filterContact === 'phone' && !client.phone) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = sortField === 'displayName' ? a.displayName : (a.company ?? '');
      const bVal = sortField === 'displayName' ? b.displayName : (b.company ?? '');
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const allTiers = [...new Set(clients.map((c) => c.tier).filter(Boolean))] as string[];

  if (!isAuthed) return null;

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
          breadcrumb="Houseworks — CRM"
          titleElement="p"
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          <div>
            {/* Page heading */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-foreground">CRM</h1>
              {activeTab === 'clients' && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                >
                  + New Client
                </button>
              )}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 mb-6 border-b border-border" role="tablist" aria-label="CRM sections">
              {(['clients', 'pipeline', 'dashboard'] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => router.push(`/crm/${workspaceId}${tab === 'clients' ? '' : `?tab=${tab}`}`)}
                  className={`min-h-[44px] px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Clients tab */}
            {activeTab === 'clients' && (
              <>
                {/* Search + Filter bar */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="flex-1 min-w-[200px]">
                    <label htmlFor="crm-search" className="sr-only">Search clients</label>
                    <input
                      id="crm-search"
                      type="text"
                      placeholder="Search clients…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search clients"
                      className="w-full max-w-sm rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:outline-none focus:bg-card transition-all"
                    />
                  </div>
                  {/* Tier filter */}
                  <select
                    aria-label="Filter by tier"
                    value={filterTier}
                    onChange={(e) => setFilterTier(e.target.value)}
                    className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">All tiers</option>
                    {allTiers.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {/* Columns popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColumns(!showColumns)}
                      className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/70 hover:bg-muted"
                    >
                      Columns ▾
                    </button>
                    {showColumns && (
                      <div className="absolute right-0 top-full mt-1 z-10 w-48 rounded-xl border border-border bg-card p-3 shadow-lg space-y-1">
                        {(['displayName', 'company', 'email', 'phone', 'website', 'address', 'tier'] as const).map((col) => (
                          <label key={col} className="flex items-center gap-2 text-sm text-foreground/70 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={visibleColumns.has(col)}
                              onChange={(e) => {
                                const next = new Set(visibleColumns);
                                if (e.target.checked) next.add(col);
                                else if (col !== 'displayName') next.delete(col);
                                setVisibleColumns(next);
                              }}
                              disabled={col === 'displayName'}
                            />
                            {col === 'displayName' ? 'Display Name' : col.charAt(0).toUpperCase() + col.slice(1)}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact info filter */}
                <div className="mb-4">
                  <select
                    aria-label="Filter by contact info"
                    value={filterContact}
                    onChange={(e) => setFilterContact(e.target.value as '' | 'email' | 'company' | 'phone')}
                    className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">All contacts</option>
                    <option value="email">Has email</option>
                    <option value="company">Has company</option>
                    <option value="phone">Has phone</option>
                  </select>
                </div>

                {/* Bulk action bar */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-3 mb-4 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                    <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
                    <div className="flex gap-2 flex-wrap">
                      {showBulkTierInput ? (
                        <>
                          <input
                            type="text"
                            placeholder="Tier name"
                            value={bulkTier}
                            onChange={(e) => setBulkTier(e.target.value)}
                            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none w-32"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              for (const id of selectedIds) {
                                await updateProfile.mutateAsync({ clientId: id, tier: bulkTier });
                              }
                              setSelectedIds(new Set());
                              setBulkTier('');
                              setShowBulkTierInput(false);
                            }}
                            className="min-h-[44px] rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowBulkTierInput(false)}
                            className="min-h-[44px] rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/70"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowBulkTierInput(true)}
                          className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground/70 hover:bg-background"
                        >
                          Assign tier
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Delete ${selectedIds.size} client(s)?`)) return;
                          for (const id of selectedIds) {
                            await deleteClient.mutateAsync({ clientId: id });
                          }
                          setSelectedIds(new Set());
                        }}
                        className="min-h-[44px] rounded-lg border border-red-200 bg-card px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/10"
                      >
                        Delete selected
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="ml-auto min-h-[44px] text-xs text-slate-400 hover:text-foreground/70"
                    >
                      ✕ Clear
                    </button>
                  </div>
                )}

                {/* Create dialog */}
                {showCreate && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
                      <h2 className="text-base font-bold mb-4">New Client</h2>
                      <input
                        type="text"
                        placeholder="Client name *"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:bg-card"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => setShowCreate(false)}
                          className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm text-foreground/70 hover:bg-background"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!newName.trim() || createClient.isPending}
                          onClick={() => {
                            if (newName.trim()) {
                              createClient.mutate({
                                workspaceId,
                                displayName: newName.trim(),
                              });
                            }
                          }}
                          className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-primary/90"
                        >
                          {createClient.isPending ? 'Creating…' : 'Create'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Client table */}
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background py-16 text-center">
                    <p className="text-sm text-slate-500">{clients.length === 0 ? 'No clients yet.' : 'No clients match your filters.'}</p>
                    {clients.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        className="mt-3 min-h-[44px] text-sm font-semibold text-primary hover:underline"
                      >
                        Create your first client
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border bg-background">
                        <tr>
                          <th className="w-10 px-3 py-3">
                            <input
                              type="checkbox"
                              aria-label="Select all"
                              checked={selectedIds.size === filtered.length && filtered.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds(new Set(filtered.map((c) => c.id)));
                                else setSelectedIds(new Set());
                              }}
                              className="rounded"
                            />
                          </th>
                          {(['displayName', 'company', 'email', 'phone', 'website', 'address', 'tier'] as const)
                            .filter((col) => visibleColumns.has(col))
                            .map((col) => (
                              <th
                                key={col}
                                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-foreground select-none"
                                onClick={() => {
                                  if (col === 'displayName' || col === 'company') {
                                    if (sortField === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                    else { setSortField(col as 'displayName' | 'company'); setSortDir('asc'); }
                                  }
                                }}
                              >
                                {col === 'displayName' ? 'Display Name' : col.charAt(0).toUpperCase() + col.slice(1)}
                                {(col === 'displayName' || col === 'company') && sortField === col && (
                                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </th>
                            ))}
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filtered.map((client) => (
                          <tr key={client.id} className={`hover:bg-background transition-colors ${selectedIds.has(client.id) ? 'bg-primary/5' : ''}`}>
                            <td className="w-10 px-3 py-3">
                              <input
                                type="checkbox"
                                aria-label={`Select ${client.displayName}`}
                                checked={selectedIds.has(client.id)}
                                onChange={(e) => {
                                  const next = new Set(selectedIds);
                                  if (e.target.checked) next.add(client.id);
                                  else next.delete(client.id);
                                  setSelectedIds(next);
                                }}
                                className="rounded"
                              />
                            </td>
                            {visibleColumns.has('displayName') && (
                              <td className="px-4 py-3 font-medium text-foreground">
                                <Link href={`/crm/${workspaceId}/client/${client.id}`} className="hover:text-primary transition-colors">
                                  {client.displayName}
                                </Link>
                              </td>
                            )}
                            {visibleColumns.has('company') && (
                              <td className="px-4 py-3 text-foreground/70">{client.company ?? '—'}</td>
                            )}
                            {visibleColumns.has('email') && (
                              <td className="px-4 py-3 text-foreground/70 text-xs">
                                {client.email ? <a href={`mailto:${client.email}`} className="hover:text-primary">{client.email}</a> : '—'}
                              </td>
                            )}
                            {visibleColumns.has('phone') && (
                              <td className="px-4 py-3 text-foreground/70">{client.phone ?? '—'}</td>
                            )}
                            {visibleColumns.has('website') && (
                              <td className="px-4 py-3 text-slate-500 text-xs">
                                {client.website ? (
                                  <a href={client.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                                    {client.website.replace(/^https?:\/\//, '')}
                                  </a>
                                ) : '—'}
                              </td>
                            )}
                            {visibleColumns.has('address') && (
                              <td className="px-4 py-3 text-foreground/70 text-xs">{client.address ?? '—'}</td>
                            )}
                            {visibleColumns.has('tier') && (
                              <td className="px-4 py-3">
                                {client.tier ? (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{client.tier}</span>
                                ) : '—'}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/crm/${workspaceId}/client/${client.id}`}
                                className="inline-flex items-center min-h-[44px] px-2 text-xs font-medium text-primary hover:text-primary/80"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Pipeline tab */}
            {activeTab === 'pipeline' && (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {DEAL_STAGE_COLUMNS.map(({ stage, label, color }) => {
                    const stageDeals = allDeals.filter((d) => d.stage === stage);
                    const stageValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
                    return (
                      <div key={stage} className={`w-64 flex-shrink-0 rounded-2xl border ${color} p-3`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold uppercase tracking-wide text-foreground/70">{label}</span>
                          <span className="text-xs text-slate-400">{stageDeals.length}</span>
                        </div>
                        {stageValue > 0 && (
                          <p className="text-xs text-slate-400 mb-2">${stageValue.toLocaleString()}</p>
                        )}
                        <div className="space-y-2">
                          {stageDeals.map((deal) => (
                            <Link
                              key={deal.id}
                              href={`/crm/${workspaceId}/client/${deal.clientId}`}
                              className="block rounded-lg bg-card border border-border p-3 hover:border-primary/30 transition-colors shadow-sm"
                            >
                              <p className="text-sm font-semibold text-foreground truncate">{deal.title}</p>
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {deal.client.company ?? deal.client.displayName}
                              </p>
                              {deal.value != null && (
                                <p className="text-xs text-emerald-600 font-medium mt-1">${deal.value.toLocaleString()}</p>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dashboard tab */}
            {activeTab === 'dashboard' && (
              <CrmDashboard workspaceId={workspaceId} />
            )}

          </div>
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
