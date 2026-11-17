import { describe, expect, it } from 'vitest';
import { paginateItems } from './attendance-utils.js';

describe('paginateItems', () => {
  it('returns the requested page and its visible range', () => {
    expect(paginateItems(['a', 'b', 'c', 'd', 'e'], 2, 2)).toEqual({
      items: ['c', 'd'],
      pageCount: 3,
      currentPage: 2,
      start: 2,
      end: 4,
    });
  });

  it('clamps an out-of-range page after filtering', () => {
    expect(paginateItems(['only'], 4, 6)).toEqual({
      items: ['only'],
      pageCount: 1,
      currentPage: 1,
      start: 0,
      end: 1,
    });
  });

  it('handles empty lists and invalid page values safely', () => {
    expect(paginateItems([], 0, 0)).toEqual({
      items: [],
      pageCount: 1,
      currentPage: 1,
      start: 0,
      end: 0,
    });
  });
});
