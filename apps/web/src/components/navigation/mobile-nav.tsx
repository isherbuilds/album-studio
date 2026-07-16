import { LogOut, Menu, X } from "lucide-react";
import React, { Suspense } from "react";

import { useAuthSuspense } from "@tsu-stack/auth/react/tanstack-start/hooks";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Button, buttonVariants } from "@tsu-stack/ui/components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from "@tsu-stack/ui/components/sheet";

import { LocaleSwitcher } from "@/components/common/locale-switcher";
import { ThemeSwitcher } from "@/components/common/theme-switcher";
import { navLinks } from "@/components/navigation/nav-links";
import { NavbarAvatar } from "@/components/navigation/navbar-avatar";
import { useSignOut } from "@/hooks/use-auth";
export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  const onNavigate = () => setOpen(false);

  return (
    <div className="flex items-center gap-2 md:hidden">
      <LocaleSwitcher variant="outline" size="icon" />
      <ThemeSwitcher className="md:hidden" variant="outline" />
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger
          aria-controls="mobile-menu"
          aria-label={m.navbar__open_menu()}
          className={buttonVariants({ className: "md:hidden", size: "icon", variant: "outline" })}
        >
          <Menu />
        </SheetTrigger>
        <SheetContent
          className="inset-x-0 bottom-0 h-auto w-full overflow-y-auto p-4 data-[side=top]:top-(--navbar-height) sm:max-w-none"
          id="mobile-menu"
          showCloseButton={false}
          side="top"
        >
          <SheetTitle className="sr-only">{m.navbar__navigation()}</SheetTitle>
          <SheetClose
            render={
              <Button
                aria-label={m.navbar__close_menu()}
                className="absolute top-4 right-4"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <X />
          </SheetClose>
          <nav aria-label={m.navbar__navigation()} className="mt-10">
            <div className="grid gap-2">
              {navLinks.map((link) => {
                const label = link.label();

                return (
                  <Link
                    className={buttonVariants({
                      className: "w-full justify-start",
                      variant: "ghost"
                    })}
                    onClick={onNavigate}
                    key={link.href ?? link.to}
                    {...(link.href ? { href: link.href } : { to: link.to })}
                  >
                    <span className="max-sm:-ms-2">{label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
          <Suspense fallback={null}>
            <MobileNavAuth onNavigate={onNavigate} />
          </Suspense>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MobileNavAuth({ onNavigate }: { onNavigate: () => void }) {
  const { user } = useAuthSuspense();
  const signOut = useSignOut();

  const handleSignOut = () => {
    onNavigate();
    void signOut();
  };

  if (!user) {
    return (
      <div className="mt-12 flex flex-col gap-2">
        <Link
          className={buttonVariants({ className: "w-full", variant: "outline" })}
          onClick={onNavigate}
          to="/sign-in"
        >
          {m.navbar__sign_in()}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 flex flex-col gap-6">
      <div className="border-t" />
      <div className="flex items-center gap-3 px-2">
        <NavbarAvatar avatarImgSrc={user.image} name={user.name} email={user.email} />
      </div>
      <Button className="w-full" variant="destructive" onClick={handleSignOut}>
        <LogOut aria-hidden="true" size={16} />
        {m.user_dropdown__logout()}
      </Button>
    </div>
  );
}
