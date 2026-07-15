import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@tsu-stack/auth/react/auth-client";
import { authQueryKeys } from "@tsu-stack/auth/react/tanstack-start/queries";
import { m } from "@tsu-stack/i18n/messages";

export function useSignInMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const result = await authClient.signIn.email(values);
      if (!result.data) {
        throw new Error(result.error?.message ?? m.auth__sign_in_failed());
      }
      return result.data;
    },
    onError: (error) => toast.error(error.message || m.auth__sign_in_failed()),
    onSuccess: () =>
      queryClient.invalidateQueries({
        exact: true,
        queryKey: authQueryKeys.user,
        refetchType: "active"
      })
  });
}

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
