import { m } from "@tsu-stack/i18n/messages";

export function SearchResultsStatus({
  isFetching,
  loadingLabel,
  total
}: {
  isFetching: boolean;
  loadingLabel: string;
  total: number | undefined;
}) {
  return (
    <output aria-atomic="true" aria-live="polite" className="sr-only">
      {isFetching
        ? loadingLabel
        : total === undefined
          ? ""
          : m.common__results_count({ count: total })}
    </output>
  );
}
