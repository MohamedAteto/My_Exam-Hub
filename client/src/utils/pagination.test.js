import { describe, expect, it } from 'vitest';
import { getPaginationRange, paginateItems } from './pagination';

describe('pagination', () => {
  it('returns all items and a single page for the All option', () => {
    const items = Array.from({ length: 3918 }, (_, index) => index + 1);
    expect(paginateItems(items, 1, 'all')).toHaveLength(3918);
    expect(getPaginationRange(items.length, 1, 'all')).toMatchObject({
      totalPages: 1,
      firstItem: 1,
      lastItem: 3918
    });
  });

  it('clamps stale current pages and reports empty ranges as zero to zero', () => {
    expect(getPaginationRange(21, 4, 10)).toMatchObject({
      currentPage: 3,
      totalPages: 3,
      firstItem: 21,
      lastItem: 21
    });
    expect(getPaginationRange(0, 1, 'all')).toMatchObject({
      totalPages: 1,
      firstItem: 0,
      lastItem: 0
    });
  });
});