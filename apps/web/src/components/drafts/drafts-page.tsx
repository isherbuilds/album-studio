import { useHydrated } from "@tanstack/react-router";
import { ArrowRight, ImageOff, PackageOpen, Trash2 } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import { Card, CardContent } from "@tsu-stack/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle
} from "@tsu-stack/ui/components/empty";

import { formatMinorAmount } from "@/components/catalog/format";
import { Image } from "@/components/common/image";
import { useDraftListQuery, useRemoveDraftMutation } from "@/hooks/use-drafts";

export function DraftsPage({ organizationSlug }: { organizationSlug: string }) {
  const { locale } = useLocale();
  const isHydrated = useHydrated();
  const drafts = useDraftListQuery(organizationSlug);
  const removeDraft = useRemoveDraftMutation(organizationSlug);
  const items = drafts.data ?? [];
  const dateFormatter = new Intl.DateTimeFormat(
    locale,
    isHydrated ? { dateStyle: "medium" } : { dateStyle: "medium", timeZone: "UTC" }
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{m.drafts__title()}</h1>
          <p className="max-w-prose text-sm text-muted-foreground">{m.drafts__description()}</p>
        </div>
        <Button asChild variant="outline">
          <Link params={{ organizationSlug }} to="/org/$organizationSlug/catalog">
            {m.drafts__browse_catalog()}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        {removeDraft.isError ? (
          <p className="text-sm text-destructive sm:basis-full" role="alert">
            {m.drafts__remove_failed()}
          </p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <PackageOpen />
          </EmptyMedia>
          <EmptyTitle>{m.drafts__empty_title()}</EmptyTitle>
          <EmptyDescription>{m.drafts__empty_description()}</EmptyDescription>
          <EmptyContent>
            <Button asChild>
              <Link params={{ organizationSlug }} to="/org/$organizationSlug/catalog">
                {m.drafts__browse_catalog()}
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <ol className="divide-y">
              {items.map((draft, index) => {
                const name = draft.projectName ?? m.drafts__untitled();
                return (
                  <li
                    className="grid min-w-0 grid-cols-[2rem_4rem_minmax(0,1fr)] items-center gap-3 p-4 sm:grid-cols-[2rem_5rem_minmax(0,1fr)_auto] sm:gap-5 sm:p-5"
                    key={draft.id}
                  >
                    <span className="self-start pt-1 font-mono text-xs text-muted-foreground tabular-nums sm:self-center sm:pt-0">
                      {String(index + 1).padStart(2, "0")}
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
                        <Button
                          asChild
                          className="h-auto justify-start px-0 text-left"
                          variant="link"
                        >
                          <Link
                            params={{ draftId: draft.id, organizationSlug }}
                            to="/org/$organizationSlug/drafts/$draftId/configure"
                          >
                            <span className="truncate text-base font-medium">{name}</span>
                          </Link>
                        </Button>
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
                        <span>{m.drafts__quantity({ quantity: draft.quantity })}</span>
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
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
