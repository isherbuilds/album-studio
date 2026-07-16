import { ArrowRight, Building2 } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@tsu-stack/ui/components/empty";

import { Container } from "@/components/common/container";
import { Navbar } from "@/components/navigation/navbar";
import { useListMyOrganizationsQuery } from "@/hooks/use-organization";

function getRoleLabel(role: "owner" | "manager" | "customer") {
  switch (role) {
    case "owner":
      return m.organization__role_owner();
    case "manager":
      return m.organization__role_manager();
    case "customer":
      return m.organization__role_customer();
  }
}

export function OrganizationSelectorPage() {
  const organizations = useListMyOrganizationsQuery();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Container className="py-10 sm:py-16">
          <Card className="mx-auto max-w-2xl">
            <CardHeader className="border-b">
              <CardTitle>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {m.organization__selector_title()}
                </h1>
              </CardTitle>
              <CardDescription>{m.organization__selector_eyebrow()}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {organizations.data?.length ? (
                <div className="divide-y">
                  {organizations.data.map((item) => (
                    <Link
                      className="group flex items-center gap-4 px-4 py-4 outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
                      key={item.id}
                      params={{ organizationSlug: item.slug }}
                      to="/$organizationSlug"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Building2 aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate font-medium">{item.name}</strong>
                        <span className="text-sm text-muted-foreground">
                          {getRoleLabel(item.role)}
                        </span>
                      </span>
                      <ArrowRight aria-hidden className="text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty className="min-h-64">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Building2 />
                    </EmptyMedia>
                    <EmptyTitle>{m.organization__selector_title()}</EmptyTitle>
                    <EmptyDescription>{m.organization__selector_empty()}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </Container>
      </main>
    </div>
  );
}
