import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPageRange } from "@/lib/pagination";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => `${basePath}?page=${page}`;
  const tokens = getPageRange(currentPage, totalPages);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-center gap-1.5 pt-2 flex-wrap"
    >
      <Link
        href={hrefFor(Math.max(1, currentPage - 1))}
        aria-disabled={isFirst ? "true" : undefined}
        className={cn(
          "h-9 px-3 rounded-btn border border-sand font-body text-[13px] text-obsidian flex items-center",
          isFirst && "pointer-events-none opacity-40"
        )}
      >
        ‹ Anterior
      </Link>

      {tokens.map((token, i) =>
        token === "ellipsis" ? (
          <span
            key={`ellipsis-${i}`}
            className="px-2 font-body text-[13px] text-graphite"
          >
            …
          </span>
        ) : (
          <Link
            key={token}
            href={hrefFor(token)}
            aria-current={token === currentPage ? "page" : undefined}
            className={cn(
              "h-9 min-w-9 px-2.5 rounded-btn font-body text-[13px] flex items-center justify-center",
              token === currentPage
                ? "bg-linen text-obsidian font-medium"
                : "text-graphite hover:bg-surface-hover"
            )}
          >
            {token}
          </Link>
        )
      )}

      <Link
        href={hrefFor(Math.min(totalPages, currentPage + 1))}
        aria-disabled={isLast ? "true" : undefined}
        className={cn(
          "h-9 px-3 rounded-btn border border-sand font-body text-[13px] text-obsidian flex items-center",
          isLast && "pointer-events-none opacity-40"
        )}
      >
        Próxima ›
      </Link>
    </nav>
  );
}
