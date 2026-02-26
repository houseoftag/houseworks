'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';

type LineItem = { description: string; amount: string };

export function CrmInvoiceDialog({
  workspaceId,
  clientId,
  customerRef,
  onClose,
  onSuccess,
}: {
  workspaceId: string;
  clientId: string;
  customerRef: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { pushToast } = useToast();
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', amount: '' }]);
  const [dueDate, setDueDate] = useState('');

  const createInvoice = trpc.quickbooks.createInvoice.useMutation({
    onSuccess: (data) => {
      pushToast({ title: `Invoice #${data.docNumber} created`, tone: 'success' });
      onSuccess?.();
      onClose();
    },
    onError: (e) => pushToast({ title: 'Failed to create invoice', description: e.message, tone: 'error' }),
  });

  const total = lineItems.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const canSubmit = lineItems.every((l) => l.description.trim() && parseFloat(l.amount) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Create QuickBooks Invoice</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-foreground/70">✕</button>
        </div>

        {/* Line items */}
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Line items</p>
          {lineItems.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                placeholder="Description"
                value={item.description}
                onChange={(e) => setLineItems((li) => li.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
              />
              <input
                type="number"
                placeholder="Amount"
                value={item.amount}
                onChange={(e) => setLineItems((li) => li.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))}
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:bg-card"
                min="0"
                step="0.01"
              />
              {lineItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLineItems((li) => li.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-rose-500 px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLineItems((li) => [...li, { description: '', amount: '' }])}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            + Add line item
          </button>
        </div>

        {/* Due date */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Due date (optional)</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        {/* Total */}
        <div className="flex items-center justify-between py-3 border-t border-border mb-4">
          <span className="text-sm font-semibold text-foreground/70">Total</span>
          <span className="text-base font-bold text-foreground">${total.toFixed(2)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/70 hover:bg-background">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || createInvoice.isPending}
            onClick={() =>
              createInvoice.mutate({
                workspaceId,
                clientId,
                customerRef,
                lineItems: lineItems.map((l) => ({ description: l.description, amount: parseFloat(l.amount) })),
                dueDate: dueDate || undefined,
              })
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-primary/90"
          >
            {createInvoice.isPending ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
