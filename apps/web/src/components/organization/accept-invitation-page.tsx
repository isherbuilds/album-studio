import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@tsu-stack/auth/react/tanstack-start/hooks";
import { m } from "@tsu-stack/i18n/messages";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";
import { Button } from "@tsu-stack/ui/components/button";
import { Input } from "@tsu-stack/ui/components/input";
import { Label } from "@tsu-stack/ui/components/label";

import { Container } from "@/components/common/container";
import {
  useAcceptInvitationMutation,
  useAcceptNewUserInvitationMutation
} from "@/hooks/use-organization";

export function AcceptInvitationPage({ invitationId }: { invitationId: string }) {
  const { isPending: isAuthPending, user } = useAuth();
  const navigate = useNavigate();
  const accept = useAcceptInvitationMutation();
  const acceptNewUser = useAcceptNewUserInvitationMutation();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const isPending = isAuthPending || accept.isPending || acceptNewUser.isPending;

  return (
    <Container className="flex max-w-md flex-col gap-6 py-12">
      <header className="text-center">
        <p className="mb-3 font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
          Album Studio
        </p>
        <h1 className="font-display text-3xl">{m.auth__invitation_title()}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{m.auth__invitation_description()}</p>
      </header>
      <form
        className="space-y-5 rounded-xl border bg-card p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (isAuthPending) return;
          if (user) {
            accept.mutate(
              { invitationId },
              {
                onSuccess: async () => {
                  toast.success(m.auth__invitation_accepted());
                  await navigate({ to: "/dashboard" });
                }
              }
            );
          } else {
            acceptNewUser.mutate(
              { invitationId, name, password },
              {
                onSuccess: async (result) => {
                  toast.success(m.auth__invitation_accepted());
                  await navigate({
                    params: { organizationSlug: result.organizationSlug },
                    to: "/org/$organizationSlug"
                  });
                }
              }
            );
          }
        }}
      >
        {isAuthPending ? null : user ? (
          <p className="text-sm text-muted-foreground">
            {m.auth__signed_in_as()} {user.email}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="invited-name">{m.auth__name_label()}</Label>
              <Input
                id="invited-name"
                minLength={2}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invited-password">{m.auth__password_label()}</Label>
              <Input
                id="invited-password"
                minLength={8}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </>
        )}
        <Button className="w-full" disabled={isPending} type="submit">
          {isPending ? m.auth__accepting_invitation() : m.auth__accept_invitation()}
        </Button>
      </form>
    </Container>
  );
}
