import type { ReactNode } from 'react';

/**
 * A single column definition for {@link DataTable}.
 *
 * Columns drive the desktop `<table>` layout. On mobile the table collapses to
 * stacked cards — either auto-generated from these columns (label/value pairs)
 * or fully custom via {@link DataTableProps.mobileCard}.
 */
export interface Column<T> {
  /** Stable identifier for the column (used as React key). */
  key: string;
  /** Header label. Leave empty for visual-only columns (avatars, actions). */
  header?: ReactNode;
  /** Renders the cell content for a row. */
  render: (row: T) => ReactNode;
  /** Horizontal alignment of the cell + header. Defaults to `left`. */
  align?: 'left' | 'right' | 'center';
  /** Extra classes applied to the `<td>`. */
  className?: string;
  /** Extra classes applied to the `<th>`. */
  headerClassName?: string;
  /** Hide this column when the table auto-stacks into mobile cards. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable key for each row. */
  rowKey: (row: T) => string;
  /**
   * Custom mobile card renderer. When provided it fully replaces the
   * auto-stacked mobile layout, giving each surface a tailored card while
   * sharing the desktop table chrome. Falls back to label/value stacking.
   */
  mobileCard?: (row: T) => ReactNode;
  /** Optional full-width footer (e.g. totals) — desktop `tfoot` + mobile card. */
  footer?: ReactNode;
  isLoading?: boolean;
  /** Shown while `isLoading` and there are no rows yet. */
  loadingState?: ReactNode;
  /** Shown when there are no rows and not loading. */
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/**
 * Responsive, generic data table: a real `<table>` on `sm+` and stacked cards
 * on mobile. Centralizes table chrome (header, dividers, hover, rounded card
 * container) so feature surfaces only describe their columns.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  mobileCard,
  footer,
  isLoading,
  loadingState,
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading && rows.length === 0) return <>{loadingState ?? null}</>;
  if (rows.length === 0) return <>{emptyState ?? null}</>;

  const mobileColumns = columns.filter((c) => !c.hideOnMobile);

  return (
    <>
      {/* DESKTOP TABLE */}
      <div className="hidden sm:block bg-white dark:bg-gray-900/40 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-label text-gray-400 ${ALIGN[col.align ?? 'left']} ${col.headerClassName ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/20 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${ALIGN[col.align ?? 'left']} ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                <td colSpan={columns.length} className="px-4 py-3">
                  {footer}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* MOBILE CARDS */}
      <div className="sm:hidden space-y-2">
        {rows.map((row) =>
          mobileCard ? (
            <div key={rowKey(row)}>{mobileCard(row)}</div>
          ) : (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className="p-3 bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-1"
            >
              {mobileColumns.map((col) => (
                <div key={col.key} className="flex items-center justify-between gap-3">
                  {col.header ? <span className="text-micro text-gray-400">{col.header}</span> : <span />}
                  <span className="text-body-strong dark:text-white min-w-0 truncate">{col.render(row)}</span>
                </div>
              ))}
            </div>
          ),
        )}
        {footer && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
