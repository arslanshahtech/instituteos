import type { Key, ReactNode } from 'react';
import { EmptyState } from './States.js';

export interface TableColumn<T> {
  header: string;
  render: (row: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  caption: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => Key;
  emptyTitle?: string;
  emptyDescription?: string;
  wrapperClassName?: string;
  tableClassName?: string;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  emptyTitle = 'No results yet',
  emptyDescription = 'When there is information to show, it will appear here.',
  wrapperClassName,
  tableClassName,
}: DataTableProps<T>) {
  return (
    <div
      className={['table-scroll', wrapperClassName].filter(Boolean).join(' ')}
    >
      <table
        className={['data-table', tableClassName].filter(Boolean).join(' ')}
      >
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={column.align ? `align-${column.align}` : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <tr key={rowKey(row, rowIndex)}>
                {columns.map((column) => (
                  <td
                    key={column.header}
                    data-label={column.header}
                    className={
                      column.align ? `align-${column.align}` : undefined
                    }
                  >
                    {column.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                className="table-empty-cell"
                colSpan={Math.max(columns.length, 1)}
              >
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
