'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { skipToken } from '@tanstack/react-query';
import { trpc } from '@/trpc/react';
import { BoardTable } from './board_table';
import { BoardControls } from './board_controls';
import { AutomationPanel } from './automation_panel';
import { useSession } from 'next-auth/react';

const BOARD_FRESHNESS_POLL_MS = 5_000;
const REFRESHING_MIN_VISIBLE_MS = 700;
const FRESH_CONFIRMATION_VISIBLE_MS = 1_100;
const REFRESH_FAILURE_VISIBLE_MS = 4_000;

type FreshnessState = 'fresh' | 'refreshing' | 'stale';

function FreshnessBadge({ state }: { state: FreshnessState }) {
  const config =
    state === 'refreshing'
      ? {
          label: 'Refreshing',
          dotClassName: 'bg-amber-300',
          textClassName: 'text-amber-100',
          borderClassName: 'border-amber-300/70',
        }
      : state === 'stale'
        ? {
            label: 'Stale',
            dotClassName: 'bg-rose-300',
            textClassName: 'text-rose-100',
            borderClassName: 'border-rose-300/70',
          }
        : {
            label: 'Fresh',
            dotClassName: 'bg-emerald-300',
            textClassName: 'text-emerald-100',
            borderClassName: 'border-emerald-300/70',
          };

  const liveMode = state === 'stale' ? 'off' : 'polite';

  return (
    <span
      aria-atomic="true"
      aria-live={liveMode}
      className={`inline-flex items-center gap-2.5 rounded-full border bg-slate-950/45 px-3.5 py-1.5 text-sm font-bold uppercase tracking-[0.08em] ${config.textClassName} ${config.borderClassName}`}
      data-testid="board-freshness-status"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${config.dotClassName}`} />
      <span className="sr-only">Board data status:</span>
      {config.label}
    </span>
  );
}

function LastSuccessfulRefresh({ at }: { at: Date | null }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-300/80" data-testid="board-last-successful-refresh">
      Last successful refresh: {at ? at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'not yet'}
    </p>
  );
}

function RefreshStatus({ freshnessState, lastSuccessfulRefreshAt, refreshError }: { freshnessState: FreshnessState; lastSuccessfulRefreshAt: Date | null; refreshError: string | null }) {
  return (
    <div className="space-y-1">
      <FreshnessBadge state={freshnessState} />
      <LastSuccessfulRefresh at={lastSuccessfulRefreshAt} />
      {refreshError ? (
        <p
          aria-live="polite"
          className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-300"
          data-testid="board-refresh-error"
          role="status"
        >
          {refreshError}
        </p>
      ) : null}
    </div>
  );
}

export function BoardData({ boardId, onRequestCreateBoard }: { boardId: string | null; onRequestCreateBoard?: () => void }) {
  const { status } = useSession();
  const utils = trpc.useUtils();
  const isAuthed = status === 'authenticated';
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastSuccessfulRefreshAt, setLastSuccessfulRefreshAt] = useState<Date | null>(null);
  const refreshFailureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const freshnessQueryOptions = {
    refetchInterval: BOARD_FRESHNESS_POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  } as const;

  const {
    data: defaultBoard,
    isLoading: loadingDefault,
    isFetching: fetchingDefault,
    isRefetching: refetchingDefault,
    isStale: staleDefault,
    refetch: refetchDefault,
  } = trpc.boards.getDefault.useQuery(undefined, {
    ...freshnessQueryOptions,
    enabled: isAuthed && !boardId,
  });

  const specificBoardInput = isAuthed && boardId ? { id: boardId } : skipToken;
  const {
    data: specificBoard,
    isLoading: loadingSpecific,
    isFetching: fetchingSpecific,
    isRefetching: refetchingSpecific,
    isStale: staleSpecific,
    refetch: refetchSpecific,
  } = trpc.boards.getById.useQuery(specificBoardInput, freshnessQueryOptions);

  const data = boardId ? specificBoard : defaultBoard;
  const isLoading = boardId ? loadingSpecific : loadingDefault;
  const isFetching = boardId ? fetchingSpecific : fetchingDefault;
  const isRefetching = boardId ? refetchingSpecific : refetchingDefault;
  const isStale = boardId ? staleSpecific : staleDefault;

  const [freshnessPhase, setFreshnessPhase] = useState<'idle' | 'refreshing' | 'fresh'>('idle');
  const previousRawRefreshingRef = useRef(false);
  const refreshingHoldUntilRef = useRef<number | null>(null);
  const delayedFreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freshClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rawRefreshing = isManualRefreshing || isFetching || isRefetching;

  useEffect(() => {
    const wasRefreshing = previousRawRefreshingRef.current;

    if (rawRefreshing && !wasRefreshing) {
      if (delayedFreshTimerRef.current) {
        clearTimeout(delayedFreshTimerRef.current);
        delayedFreshTimerRef.current = null;
      }
      if (freshClearTimerRef.current) {
        clearTimeout(freshClearTimerRef.current);
        freshClearTimerRef.current = null;
      }
      refreshingHoldUntilRef.current = Date.now() + REFRESHING_MIN_VISIBLE_MS;
      setFreshnessPhase('refreshing');
    }

    if (!rawRefreshing && wasRefreshing) {
      const remainingRefreshingMs = Math.max(0, (refreshingHoldUntilRef.current ?? Date.now()) - Date.now());

      delayedFreshTimerRef.current = setTimeout(() => {
        setFreshnessPhase('fresh');
        freshClearTimerRef.current = setTimeout(() => {
          setFreshnessPhase('idle');
        }, FRESH_CONFIRMATION_VISIBLE_MS);
      }, remainingRefreshingMs);
    }

    previousRawRefreshingRef.current = rawRefreshing;
  }, [rawRefreshing]);

  useEffect(() => {
    return () => {
      if (delayedFreshTimerRef.current) {
        clearTimeout(delayedFreshTimerRef.current);
      }
      if (freshClearTimerRef.current) {
        clearTimeout(freshClearTimerRef.current);
      }
      if (refreshFailureTimerRef.current) {
        clearTimeout(refreshFailureTimerRef.current);
      }
    };
  }, []);

  const freshnessState: FreshnessState =
    freshnessPhase === 'refreshing' ? 'refreshing' : freshnessPhase === 'fresh' ? 'fresh' : isStale ? 'stale' : 'fresh';

  const refreshBoard = async () => {
    setIsManualRefreshing(true);
    setRefreshError(null);

    try {
      if (boardId) {
        await utils.boards.getById.invalidate({ id: boardId });
        await refetchSpecific();
      } else {
        await utils.boards.getDefault.invalidate();
        await refetchDefault();
      }

      setLastSuccessfulRefreshAt(new Date());
    } catch {
      setRefreshError('Refresh failed. Please retry.');
      if (refreshFailureTimerRef.current) {
        clearTimeout(refreshFailureTimerRef.current);
      }
      refreshFailureTimerRef.current = setTimeout(() => {
        setRefreshError(null);
      }, REFRESH_FAILURE_VISIBLE_MS);
    } finally {
      setIsManualRefreshing(false);
    }
  };

  if (!isAuthed) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 text-sm text-slate-500 shadow-sm">
        <p>You need to sign in to access your workspace.</p>
        <Link
          className="mt-4 inline-flex rounded-xl bg-primary px-6 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-500/20"
          href="/sign-in"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-4 w-80 animate-pulse rounded bg-slate-50" />
        </div>
        <div className="h-80 rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
          <div className="mt-6 space-y-4">
            <div className="h-12 animate-pulse rounded bg-slate-50" />
            <div className="h-12 animate-pulse rounded bg-slate-50" />
            <div className="h-12 animate-pulse rounded bg-slate-50" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3">
          <RefreshStatus freshnessState={freshnessState} lastSuccessfulRefreshAt={lastSuccessfulRefreshAt} refreshError={refreshError} />
          <button
            className="rounded-xl border border-slate-700/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 disabled:opacity-60"
            data-testid="board-refresh-button"
            disabled={isManualRefreshing || isFetching}
            onClick={refreshBoard}
            type="button"
          >
            {isManualRefreshing || isFetching ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
        <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">No boards found</h3>
          <p className="mt-2 text-xs text-slate-500">
            Create your first board to get started. Use <span className="font-semibold">Workspace Management → BOARD</span> below.
          </p>
          <button
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-blue-500/20"
            onClick={() => onRequestCreateBoard?.()}
            type="button"
          >
            Create Your First Board
          </button>
        </div>
      </div>
    );
  }

  const hasGroups = Array.isArray((data as { groups?: unknown }).groups);
  const hasColumns = Array.isArray((data as { columns?: unknown }).columns);

  if (!hasGroups || !hasColumns) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3">
          <RefreshStatus freshnessState={freshnessState} lastSuccessfulRefreshAt={lastSuccessfulRefreshAt} refreshError={refreshError} />
          <button
            className="rounded-xl border border-slate-700/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 disabled:opacity-60"
            data-testid="board-refresh-button"
            disabled={isManualRefreshing || isFetching}
            onClick={refreshBoard}
            type="button"
          >
            {isManualRefreshing || isFetching ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">
          <p className="font-bold">Board configuration is incomplete.</p>
          <p className="mt-2 text-xs text-rose-600/80 leading-relaxed">
            Some essential data (groups or columns) could not be loaded for this board.
            Please try refreshing the page or contact support if the issue persists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3">
        <RefreshStatus freshnessState={freshnessState} lastSuccessfulRefreshAt={lastSuccessfulRefreshAt} refreshError={refreshError} />
        <button
          className="rounded-xl border border-slate-700/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 disabled:opacity-60"
          data-testid="board-refresh-button"
          disabled={isManualRefreshing || isFetching}
          onClick={refreshBoard}
          type="button"
        >
          {isManualRefreshing || isFetching ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>
      <BoardControls board={data} />
      <AutomationPanel board={data} />
      <BoardTable board={data} />
    </div>
  );
}
