import { ChevronLeft, ChevronRight } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Button } from "@tsu-stack/ui/components/button";

type DataPaginationProps = {
  isFetching: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
};

export function DataPagination({ isFetching, onPageChange, page, pageCount }: DataPaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-busy={isFetching}
      aria-label={m.common__pagination()}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t px-3 py-3 sm:gap-4 sm:px-4"
    >
      <Button
        aria-label={m.common__previous_page()}
        disabled={isFetching || page <= 1}
        onClick={() => onPageChange(page - 1)}
        size="sm"
        type="button"
        variant="outline"
      >
        <ChevronLeft data-icon="inline-start" />
        <span className="sr-only sm:not-sr-only">{m.common__previous_page()}</span>
      </Button>
      <span
        aria-live="polite"
        className="min-w-0 truncate text-center text-sm text-muted-foreground tabular-nums"
      >
        {m.common__page_of({ page, pageCount })}
      </span>
      <Button
        aria-label={m.common__next_page()}
        disabled={isFetching || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        size="sm"
        type="button"
        variant="outline"
      >
        <span className="sr-only sm:not-sr-only">{m.common__next_page()}</span>
        <ChevronRight data-icon="inline-end" />
      </Button>
    </nav>
  );
}
