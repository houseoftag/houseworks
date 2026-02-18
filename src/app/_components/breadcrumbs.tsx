'use client';

type BreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-300">/</span>}
          {item.onClick ? (
            <button
              className="hover:text-primary transition-colors"
              onClick={item.onClick}
              type="button"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-slate-500 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
