export const PRODUCTS_PAGE_SIZE = 20;

export function getTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(requestedPage: number, totalPages: number): number {
  if (!Number.isFinite(requestedPage)) return 1;
  return Math.min(Math.max(1, Math.trunc(requestedPage)), totalPages);
}

export type PageToken = number | "ellipsis";

export function getPageRange(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage - 1 >= 1) pages.add(currentPage - 1);
  if (currentPage + 1 <= totalPages) pages.add(currentPage + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: PageToken[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(sorted[i]);
  }
  return result;
}
