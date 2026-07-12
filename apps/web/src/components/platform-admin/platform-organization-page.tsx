import { m } from "@tsu-stack/i18n/messages";
import { Skeleton } from "@tsu-stack/ui/components/skeleton";

import { Container } from "@/components/common/container";
import { useGetOrganizationQuery } from "@/hooks/use-platform-admin";

export function PlatformOrganizationPage({ slug }: { slug: string }) {
  const organization = useGetOrganizationQuery(slug);
  return (
    <Container className="py-12">
      <p className="mb-3 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
        {m.platform_admin__eyebrow()}
      </p>
      {organization.isError ? (
        <p className="text-sm text-destructive">{m.platform_admin__organization_load_failed()}</p>
      ) : organization.data ? (
        <>
          <h1 className="font-display text-4xl">{organization.data.name}</h1>
          <p className="mt-2 text-muted-foreground">/{slug}</p>
        </>
      ) : (
        <Skeleton className="h-10 w-64" />
      )}
    </Container>
  );
}
