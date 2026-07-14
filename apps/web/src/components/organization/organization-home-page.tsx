import { Boxes, Package, PackageCheck, ReceiptText, Users } from "lucide-react";

import { can } from "@tsu-stack/auth/access-control";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@tsu-stack/ui/components/card";

import { WorkspacePage, WorkspacePageHeader } from "@/components/admin/workspace";
import { useGetOrganizationMembershipQuery } from "@/hooks/use-organization";

export function OrganizationHomePage({ organizationSlug }: { organizationSlug: string }) {
  const membership = useGetOrganizationMembershipQuery(organizationSlug);
  const role = membership.data?.role;
  const roleLabel = role
    ? {
        customer: m.organization__role_customer(),
        manager: m.organization__role_manager(),
        owner: m.organization__role_owner()
      }[role]
    : null;
  const canManageMembers = role ? can("member.read", { role }) : false;
  const canManageProducts = role ? can("product.manage", { role }) : false;
  const canManageInventory = role ? can("inventory.manage", { role }) : false;
  const links = [
    canManageProducts
      ? {
          description: m.products__description(),
          icon: Package,
          label: m.products__title(),
          to: "/org/$organizationSlug/products" as const
        }
      : null,
    {
      description: m.orders__description(),
      icon: PackageCheck,
      label: m.orders__title(),
      to: "/org/$organizationSlug/orders" as const
    },
    {
      description: m.payments__description(),
      icon: ReceiptText,
      label: m.payments__title(),
      to: "/org/$organizationSlug/payments" as const
    },
    canManageInventory
      ? {
          description: m.inventory__description(),
          icon: Boxes,
          label: m.inventory__title(),
          to: "/org/$organizationSlug/inventory" as const
        }
      : null,
    canManageMembers
      ? {
          description: m.organization__team_access_description(),
          icon: Users,
          label: m.organization__members(),
          to: "/org/$organizationSlug/members" as const
        }
      : null
  ].filter((item) => item !== null);

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        actions={roleLabel ? <Badge variant="outline">{roleLabel}</Badge> : null}
        description={m.organization__home_description()}
        eyebrow={m.app_shell__studio_overview()}
        title={membership.data?.name ?? m.organization__home_title()}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {links.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={item.to}
              params={{ organizationSlug }}
              to={item.to}
            >
              <Card className="h-full gap-4 transition-colors group-hover:border-ring/60" size="sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-9 place-items-center rounded-lg bg-muted text-foreground">
                      <Icon />
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <CardTitle className="mt-3 group-hover:underline">{item.label}</CardTitle>
                  <CardDescription className="line-clamp-2">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </section>
    </WorkspacePage>
  );
}
