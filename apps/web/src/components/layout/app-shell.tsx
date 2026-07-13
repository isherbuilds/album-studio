import { useRouterState } from "@tanstack/react-router";
import { Building2, Images, LayoutDashboard, LogOut, Menu, Users } from "lucide-react";
import { useState } from "react";

import { can } from "@tsu-stack/auth/access-control";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Button } from "@tsu-stack/ui/components/button";
import { Separator } from "@tsu-stack/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@tsu-stack/ui/components/sheet";
import { cn } from "@tsu-stack/ui/lib/utils";

import { ThemeSwitcher } from "@/components/common/theme-switcher";
import { NavbarAvatar } from "@/components/navigation/navbar-avatar";
import { useSignOut } from "@/hooks/use-auth";

type WorkspaceNavigationProps = {
  organizationSlug?: string;
  showMemberNavigation: boolean;
  onNavigate?: () => void;
  showPlatformNavigation: boolean;
};

function WorkspaceNavigation({
  onNavigate,
  organizationSlug,
  showMemberNavigation,
  showPlatformNavigation
}: WorkspaceNavigationProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const itemClass = (active: boolean) =>
    cn(
      "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
      active && "bg-muted text-foreground"
    );

  return (
    <nav aria-label={m.app_shell__workspace()} className="flex flex-col gap-1">
      {showPlatformNavigation ? (
        <>
          <Link className={itemClass(pathname.endsWith("/admin"))} onClick={onNavigate} to="/admin">
            <LayoutDashboard />
            {m.app_shell__overview()}
          </Link>
          <Link
            className={itemClass(pathname.includes("/admin/organizations"))}
            onClick={onNavigate}
            to="/admin/organizations"
          >
            <Building2 />
            {m.platform_admin__organizations()}
          </Link>
        </>
      ) : null}
      {organizationSlug ? (
        <>
          <Link
            className={itemClass(!pathname.includes("/members"))}
            onClick={onNavigate}
            params={{ organizationSlug }}
            to="/org/$organizationSlug"
          >
            <Images />
            {m.app_shell__studio_overview()}
          </Link>
          {showMemberNavigation ? (
            <Link
              className={itemClass(pathname.includes("/members"))}
              onClick={onNavigate}
              params={{ organizationSlug }}
              to="/org/$organizationSlug/members"
            >
              <Users />
              {m.organization__members()}
            </Link>
          ) : null}
        </>
      ) : null}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const signOut = useSignOut();
  const matches = useRouterState({ select: (state) => state.matches });
  const user = matches.find((match) => match.context.user)?.context.user;
  const membershipMatch = matches.find((match) => "membership" in match.context);
  const membership = membershipMatch?.context.membership;
  const organizationSlug =
    membershipMatch && membership && "organizationSlug" in membershipMatch.params
      ? membershipMatch.params.organizationSlug
      : undefined;
  const showMemberNavigation = membership ? can("member.read", { role: membership.role }) : false;
  const showPlatformNavigation = matches.some((match) => match.routeId.includes("/(auth)/admin"));

  return (
    <div className="flex h-full flex-col p-3">
      <Link className="flex h-12 items-center gap-3 px-2" onClick={onNavigate} to="/dashboard">
        <span className="grid size-8 place-items-center rounded-lg bg-foreground text-sm font-semibold text-background">
          AS
        </span>
        <span className="leading-tight">
          <strong className="block text-sm">Album Studio</strong>
          <span className="text-xs text-muted-foreground">
            {m.app_shell__production_workspace()}
          </span>
        </span>
      </Link>
      <Separator className="my-3" />
      <WorkspaceNavigation
        onNavigate={onNavigate}
        organizationSlug={organizationSlug}
        showMemberNavigation={showMemberNavigation}
        showPlatformNavigation={showPlatformNavigation}
      />
      <div className="mt-auto flex flex-col gap-3">
        <Separator />
        <div className="flex items-center justify-between gap-3 px-2">
          <NavbarAvatar avatarImgSrc={user?.image} email={user?.email} name={user?.name} />
          <ThemeSwitcher size="icon-sm" variant="ghost" />
        </div>
        <Button
          className="w-full justify-start"
          onClick={async () => {
            await signOut();
            onNavigate?.();
          }}
          variant="ghost"
        >
          <LogOut data-icon="inline-start" />
          {m.app_shell__sign_out()}
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  return (
    <div className="min-h-screen bg-muted/30 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 hidden w-62 border-r bg-background lg:block">
        <SidebarContent />
      </aside>
      <div className="lg:col-start-2">
        <header className="sticky top-0 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <Sheet onOpenChange={setMobileNavigationOpen} open={mobileNavigationOpen}>
            <SheetTrigger asChild>
              <Button aria-label={m.app_shell__open_navigation()} size="icon" variant="ghost">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-72 p-0" side="left">
              <SheetHeader className="sr-only">
                <SheetTitle>{m.app_shell__navigation_title()}</SheetTitle>
                <SheetDescription>{m.app_shell__navigation_description()}</SheetDescription>
              </SheetHeader>
              <SidebarContent onNavigate={() => setMobileNavigationOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="ml-2 text-sm font-semibold">Album Studio</span>
        </header>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
