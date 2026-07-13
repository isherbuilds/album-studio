import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@tsu-stack/auth/react/auth-client";
import { m } from "@tsu-stack/i18n/messages";

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error(m.auth__sign_out_failed());
      return false;
    }
    queryClient.clear();
    await router.invalidate();
    return true;
  };
}
