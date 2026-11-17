export interface PaginatedItems<T> {
  items: T[];
  pageCount: number;
  currentPage: number;
  start: number;
  end: number;
}

export function paginateItems<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
): PaginatedItems<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize));
  const currentPage = Math.min(
    Math.max(1, Math.floor(requestedPage) || 1),
    pageCount,
  );
  const start = items.length === 0 ? 0 : (currentPage - 1) * safePageSize;
  const end = Math.min(start + safePageSize, items.length);

  return {
    items: items.slice(start, end),
    pageCount,
    currentPage,
    start,
    end,
  };
}
