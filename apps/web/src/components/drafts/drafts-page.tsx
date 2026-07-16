import { useHydrated } from "@tanstack/react-router";
import { ArrowRight, ImageOff, PackageOpen, Trash2 } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button, buttonVariants } from "@tsu-stack/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle
} from "@tsu-stack/ui/components/empty";
import { Spinner } from "@tsu-stack/ui/components/spinner";

import { Image } from "@/components/common/image";
import { useDraftListQuery, useRemoveDraftMutation } from "@/hooks/use-drafts";
import { getDateTimeFormatter, getNumberFormatter } from "@/lib/intl";
import { formatMinorAmount } from "@/lib/money";

export function DraftsPage({ organizationSlug }: { organizationSlug: string }) {
  const { locale } = useLocale();
  const isHydrated = useHydrated();
  const drafts = useDraftListQuery(organizationSlug);
  const removeDraft = useRemoveDraftMutation(organizationSlug);
  const items = drafts.data ?? [];
  const dateFormatter = getDateTimeFormatter(
    locale,
    isHydrated ? { dateStyle: "medium" } : { dateStyle: "medium", timeZone: "UTC" }
  );
  const numberFormatter = getNumberFormatter(locale, { maximumFractionDigits: 4 });
  const indexFormatter = getNumberFormatter(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{m.drafts__title()}</h1>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {m.drafts__description()}
          </p>
        </div>
        <Link
          className={buttonVariants({ className: "w-full sm:w-auto", variant: "outline" })}
          params={{ organizationSlug }}
          to="/$organizationSlug/catalog"
        >
          {m.drafts__browse_catalog()}
          <ArrowRight data-icon="inline-end" />
        </Link>
        {removeDraft.isError ? (
          <p className="text-sm text-destructive sm:basis-full" role="alert">
            {m.drafts__remove_failed()}
          </p>
        ) : null}
      </header>

      {drafts.isPending ? (
        <output className="grid min-h-64 place-items-center">
          <Spinner aria-label={m.drafts__title()} />
        </output>
      ) : drafts.isError ? (
        <Empty role="alert">
          <EmptyMedia variant="icon">
            <PackageOpen />
          </EmptyMedia>
          <EmptyTitle>{m.drafts__load_saved_failed()}</EmptyTitle>
          <EmptyContent>
            <Button onClick={() => void drafts.refetch()} variant="outline">
              {m.error_500__try_again()}
            </Button>
          </EmptyContent>
        </Empty>
      ) : items.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <PackageOpen />
          </EmptyMedia>
          <EmptyTitle>{m.drafts__empty_title()}</EmptyTitle>
          <EmptyDescription>{m.drafts__empty_description()}</EmptyDescription>
          <EmptyContent>
            <Link
              className={buttonVariants()}
              params={{ organizationSlug }}
              to="/$organizationSlug/catalog"
            >
              {m.drafts__browse_catalog()}
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <ol className="divide-y">
            {items.map((draft, index) => {
              const name = draft.projectName ?? m.drafts__untitled();
              return (
                <li
                  className="grid min-w-0 grid-cols-[2rem_4rem_minmax(0,1fr)] items-center gap-3 p-4 sm:grid-cols-[2rem_5rem_minmax(0,1fr)_auto] sm:gap-6 sm:p-6"
                  key={draft.id}
                >
                  <span className="self-start pt-1 font-mono text-xs text-muted-foreground tabular-nums sm:self-center sm:pt-0">
                    {indexFormatter.format(index + 1)}
                  </span>
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {draft.thumbnailUrl ? (
                      <Image
                        alt=""
                        className="size-full object-cover"
                        height={160}
                        src={draft.thumbnailUrl}
                        width={160}
                      />
                    ) : (
                      <ImageOff aria-hidden className="size-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    {draft.resumable ? (
                      <Link
                        className="block w-fit max-w-full truncate rounded-md text-base font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        params={{ draftId: draft.id, organizationSlug }}
                        to="/$organizationSlug/drafts/$draftId/configure"
                      >
                        {name}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-base font-medium">
                          {name}
                        </span>
                        <Badge className="shrink-0" variant="outline">
                          {m.drafts__product_unavailable()}
                        </Badge>
                      </div>
                    )}
                    <p className="truncate text-sm text-muted-foreground">{draft.productName}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {m.drafts__last_edited({
                          date: dateFormatter.format(new Date(draft.updatedAt))
                        })}
                      </span>
                      <span>
                        {m.drafts__quantity({
                          quantity: numberFormatter.format(draft.quantity)
                        })}
                      </span>
                      <span>
                        {draft.evaluationSummary.status === "valid"
                          ? m.drafts__estimate({
                              price: formatMinorAmount(
                                draft.evaluationSummary.orderTotal.amountMinor,
                                draft.evaluationSummary.orderTotal.currency,
                                locale
                              )
                            })
                          : m.drafts__incomplete()}
                      </span>
                    </div>
                  </div>
                  <Button
                    aria-label={m.drafts__remove_named({ name })}
                    className="col-start-3 justify-self-end sm:col-start-4 sm:row-start-1"
                    disabled={removeDraft.pendingDraftIds.has(draft.id)}
                    onClick={() => {
                      if (!window.confirm(m.drafts__remove_confirm())) return;
                      removeDraft.mutate({ draftId: draft.id });
                    }}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    {removeDraft.pendingDraftIds.has(draft.id) ? (
                      <Spinner aria-hidden />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
