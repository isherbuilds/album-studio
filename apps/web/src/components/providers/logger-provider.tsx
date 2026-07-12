import { useEffect } from "react";

import { useAuth } from "@tsu-stack/auth/react/tanstack-start/hooks";
import { clearIdentity, setIdentity } from "@tsu-stack/logger/client";

export function LoggerIdentitySync({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    clearIdentity();

    if (user) {
      setIdentity({ user: { id: user.id } });
    }

    return clearIdentity;
  }, [user]);

  return children;
}
