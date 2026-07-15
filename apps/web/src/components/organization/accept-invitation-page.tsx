import { toast } from "sonner";

import { OrganizationAcceptNewUserInvitationInputSchema } from "@tsu-stack/contract/organization";
import { m } from "@tsu-stack/i18n/messages";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";
import { Button } from "@tsu-stack/ui/components/button";
import { Field, FieldGroup } from "@tsu-stack/ui/components/field";

import { Container } from "@/components/common/container";
import { TextField } from "@/components/form/text-field";
import { useZodForm } from "@/components/form/use-zod-form";
import { useAcceptNewUserInvitationMutation } from "@/hooks/use-organization";
const acceptNewUserInvitationFormSchema = OrganizationAcceptNewUserInvitationInputSchema.omit({
  invitationId: true
});

export function AcceptInvitationPage({ invitationId }: { invitationId: string }) {
  const navigate = useNavigate();
  const acceptNewUser = useAcceptNewUserInvitationMutation();
  const form = useZodForm(acceptNewUserInvitationFormSchema, {
    defaultValues: {
      name: "",
      password: ""
    }
  });
  const onSubmit = form.handleSubmit((value) => {
    acceptNewUser.mutate(
      {
        invitationId,
        name: value.name,
        password: value.password
      },
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
  });

  return (
    <Container className="flex max-w-md flex-col gap-6 py-12">
      <header className="text-center">
        <p className="mb-3 font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
          Album Studio
        </p>
        <h1 className="font-display text-3xl">{m.auth__invitation_title()}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{m.auth__invitation_description()}</p>
      </header>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <TextField
            error={form.formState.errors.name}
            label={m.auth__name_label()}
            maxLength={120}
            minLength={2}
            registration={form.register("name")}
            required
          />
          <TextField
            error={form.formState.errors.password}
            label={m.auth__password_label()}
            maxLength={128}
            minLength={8}
            registration={form.register("password")}
            required
            type="password"
          />
          <Field>
            <Button className="w-full" disabled={acceptNewUser.isPending} type="submit">
              {acceptNewUser.isPending
                ? m.auth__accepting_invitation()
                : m.auth__accept_invitation()}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </Container>
  );
}
