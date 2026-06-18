import type { ReactNode } from 'react';

/**
 * A single column definition for {@link DataTable}.
 *
 * The table renders as ONE real `<table>` on every breakpoint (no separate
 * mobile card layout) — compact on phones, roomier on `sm+`. Columns that are
 * secondary on small screens can opt out with {@link Column.hideOnMobile}; the
 * container also scrolls horizontally as a safety net so nothing ever clips.
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
  /** Hide this column on mobile (shown from `sm` up). */
  hideOnMobile?: boolean;
  /** Optional footer cell (e.g. totals). If any column sets this, a `tfoot` renders. */
  footer?: ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable key for each row. */
  rowKey: (row: T) => string;
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

// Compact on phones, roomier on sm+. `hideOnMobile` columns appear from sm up.
const cellPad = 'px-2 py-2.5 sm:px-4 sm:py-3';
const mobileHidden = 'hidden sm:table-cell';

/**
 * Responsive, generic data table. A single `<table>` on all breakpoints —
 * compact and monolithic — sharing one look across Overview and the admin
 * panel. Centralizes the table chrome (rounded container, header, dividers,
 * hover, footer, loading/empty states) so feature surfaces only declare columns.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  loadingState,
  emptyState,
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading && rows.length === 0) return <>{loadingState ?? null}</>;
  if (rows.length === 0) return <>{emptyState ?? null}</>;

  const hasFooter = columns.some((c) => c.footer !== undefined);

  return (
    <div className="bg-white dark:bg-gray-900/40 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${cellPad} text-label text-gray-400 whitespace-nowrap ${ALIGN[col.align ?? 'left']} ${
                    col.hideOnMobile ? mobileHidden : ''
                  } ${col.headerClassName ?? ''}`}
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
                  <td
                    key={col.key}
                    className={`${cellPad} ${ALIGN[col.align ?? 'left']} ${col.hideOnMobile ? mobileHidden : ''} ${
                      col.className ?? ''
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {hasFooter && (
            <tfoot>
              <tr className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${cellPad} whitespace-nowrap ${ALIGN[col.align ?? 'left']} ${
                      col.hideOnMobile ? mobileHidden : ''
                    }`}
                  >
                    {col.footer}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
