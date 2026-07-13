import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { authClient } from "@tsu-stack/auth/react/auth-client";

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    await authClient.signOut();
    queryClient.clear();
    await router.invalidate();
  };
}
