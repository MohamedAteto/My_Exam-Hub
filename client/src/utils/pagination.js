export function getPaginationRange(itemCount, currentPage, pageSize) {
  const effectivePageSize = pageSize === 'all' ? Math.max(itemCount, 1) : Math.max(Number(pageSize) || 1, 1);
  const totalPages = Math.max(1, Math.ceil(itemCount / effectivePageSize));
  const page = Math.min(Math.max(Number(currentPage) || 1, 1), totalPages);
  const startIndex = itemCount === 0 ? 0 : (page - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, itemCount);

  return {
    currentPage: page,
    effectivePageSize,
    totalPages,
    startIndex,
    endIndex,
    firstItem: itemCount === 0 ? 0 : startIndex + 1,
    lastItem: endIndex
  };
}

export function paginateItems(items, currentPage, pageSize) {
  const range = getPaginationRange(items.length, currentPage, pageSize);
  return items.slice(range.startIndex, range.endIndex);
}