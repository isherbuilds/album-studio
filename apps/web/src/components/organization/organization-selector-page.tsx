import { authClient } from "@tsu-stack/auth/react/auth-client";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";

import { Container } from "@/components/common/container";
import { useListMyOrganizationsQuery } from "@/hooks/use-organization";

export function OrganizationSelectorPage() {
  const organizations = useListMyOrganizationsQuery();
  const navigate = useNavigate();
  return (
    <Container className="py-12">
      <p className="mb-3 font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
        {m.organization__selector_eyebrow()}
      </p>
      <h1 className="font-display text-4xl">{m.organization__selector_title()}</h1>
      <div className="mt-8 max-w-2xl overflow-hidden rounded-xl border">
        {organizations.data?.length ? (
          organizations.data.map((item, index) => (
            <Link
              className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 border-b p-4 last:border-0 hover:bg-muted/60"
              key={item.id}
              onClick={async (event) => {
                event.preventDefault();
                const result = await authClient.organization.setActive({ organizationId: item.id });
                if (!result.error) {
                  await navigate({
                    params: { organizationSlug: item.slug },
                    to: "/org/$organizationSlug"
                  });
                }
              }}
              params={{ organizationSlug: item.slug }}
              to="/org/$organizationSlug"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <strong className="block">{item.name}</strong>
                <span className="text-sm text-muted-foreground">{item.role}</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          ))
        ) : (
          <p className="p-8 text-sm text-muted-foreground">{m.organization__selector_empty()}</p>
        )}
      </div>
    </Container>
  );
}
