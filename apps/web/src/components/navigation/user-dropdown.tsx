import { FileText, BarChart2, Lock, LogOut, UserSquare } from "lucide-react";

import { useAuthSuspense } from "@tsu-stack/auth/react/tanstack-start/hooks";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Button } from "@tsu-stack/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@tsu-stack/ui/components/dropdown-menu";

import { NavbarAvatar } from "@/components/navigation/navbar-avatar";
import { NavbarUnauthenticatedButtons } from "@/components/navigation/navbar-unauthenticated-buttons";
import { useSignOut } from "@/hooks/use-auth";

export function UserDropdown() {
  const { user } = useAuthSuspense();
  const handleSignOut = useSignOut();

  if (!user) {
    return <NavbarUnauthenticatedButtons />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Open account menu" size="icon" variant="ghost">
          <UserSquare aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-sm min-w-fit">
        <DropdownMenuLabel className="flex items-start gap-3">
          <NavbarAvatar avatarImgSrc={user.image} name={user.name} email={user.email} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/dashboard">
              <BarChart2 aria-hidden="true" className="opacity-60" size={16} />
              <span>{m.user_dropdown__dashboard()}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/privacy-policy">
              <Lock aria-hidden="true" className="opacity-60" size={16} />
              <span>{m.user_dropdown__privacy_policy()}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/terms-of-service">
              <FileText aria-hidden="true" className="opacity-60" size={16} />
              <span>{m.user_dropdown__terms_of_service()}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          variant="destructive"
          onSelect={(event) => {
            // Keep the menu open until sign-out resolves: success invalidates routing and
            // redirects (unmounting this), failure surfaces a toast so the user can retry
            // instead of the menu silently closing on a still-authenticated session.
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut aria-hidden="true" className="opacity-60" />
          <span>{m.user_dropdown__logout()}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
