import { Building2, FileText, Lock, LogOut, UserSquare } from "lucide-react";

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
      <DropdownMenuTrigger
        render={<Button aria-label={m.user_dropdown__open_menu()} size="icon" variant="ghost" />}
      >
        <UserSquare aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-sm min-w-fit">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-start gap-3">
            <NavbarAvatar avatarImgSrc={user.image} email={user.email} name={user.name} />
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="cursor-pointer"
            nativeButton={false}
            render={<Link to="/select-organization" />}
          >
            <Building2 aria-hidden="true" className="opacity-60" />
            <span>{m.organization__selector_title()}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            nativeButton={false}
            render={<Link to="/privacy-policy" />}
          >
            <Lock aria-hidden="true" className="opacity-60" size={16} />
            <span>{m.user_dropdown__privacy_policy()}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            nativeButton={false}
            render={<Link to="/terms-of-service" />}
          >
            <FileText aria-hidden="true" className="opacity-60" size={16} />
            <span>{m.user_dropdown__terms_of_service()}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          variant="destructive"
          onClick={() => {
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
