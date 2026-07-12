import { m } from "@tsu-stack/i18n/messages";

import { Container } from "@/components/common/container";
import { useGetOrganizationQuery } from "@/hooks/use-platform-admin";

export function PlatformOrganizationPage({ slug }: { slug: string }) {
  const organization = useGetOrganizationQuery(slug);
  return (
    <Container className="py-12">
      <p className="mb-3 font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
        {m.platform_admin__eyebrow()}
      </p>
      <h1 className="font-display text-4xl">{organization.data?.name ?? slug}</h1>
      <p className="mt-2 text-muted-foreground">/{slug}</p>
    </Container>
  );
}
