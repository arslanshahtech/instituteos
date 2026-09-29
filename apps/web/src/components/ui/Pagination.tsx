import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button.js';

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-summary">
        Showing {firstItem}–{lastItem} of {totalItems}
      </p>
      <div className="pagination-controls">
        <Button
          aria-label="Previous page"
          disabled={currentPage <= 1}
          iconOnly
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </Button>
        <span aria-live="polite" className="pagination-page">
          Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
        </span>
        <Button
          aria-label="Next page"
          disabled={currentPage >= totalPages}
          iconOnly
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
