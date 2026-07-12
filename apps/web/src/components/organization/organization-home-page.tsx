import { Users } from "lucide-react";

import { can } from "@tsu-stack/auth/access-control";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";

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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-1">
        {roleLabel ? (
          <Badge className="mb-2 w-fit" variant="outline">
            {roleLabel}
          </Badge>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{membership.data?.name}</h1>
        <p className="text-sm text-muted-foreground">{m.organization__home_description()}</p>
      </header>

      {canManageMembers ? (
        <Card className="max-w-sm" size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users />
              {m.organization__team_access()}
            </CardTitle>
            <CardDescription>{m.organization__team_access_description()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link params={{ organizationSlug }} to="/org/$organizationSlug/members">
                {m.organization__manage_members()}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
