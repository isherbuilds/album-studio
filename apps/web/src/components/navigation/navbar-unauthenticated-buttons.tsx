import { useLocation } from "@tanstack/react-router";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { buttonVariants } from "@tsu-stack/ui/components/button";

export function NavbarUnauthenticatedButtons() {
  const location = useLocation();

  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "outline" })}
      search={{ redirect: location.href }}
      to="/sign-in"
    >
      {m.navbar__sign_in()}
    </Link>
  );
}
