import { useHydrated } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@tsu-stack/auth/react/tanstack-start/hooks";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";
import { type NavigateTo } from "@tsu-stack/i18n/tanstack-start/types";
import { Button } from "@tsu-stack/ui/components/button";
import { Field, FieldDescription, FieldGroup } from "@tsu-stack/ui/components/field";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import { cn } from "@tsu-stack/ui/lib/utils";

import { Container } from "@/components/common/container";
import { LogoIcon } from "@/components/common/logo";
import { TextField } from "@/components/form/text-field";
import { useZodForm } from "@/components/form/use-zod-form";
import { appConfig } from "@/config/app.config";
import { useSignInMutation } from "@/hooks/use-auth";

const signInFormSchema = z.object({
  email: z.email(m.auth__invalid_email()),
  password: z.string().min(8, m.auth__password_min_length())
});

export function SignInForm({
  redirectTo = "/",
  className,
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: NavigateTo }) {
  const navigate = useNavigate();
  const { isPending } = useAuth();
  const isHydrated = useHydrated();

  const signInMutation = useSignInMutation();

  const form = useZodForm(signInFormSchema, {
    defaultValues: {
      email: "",
      password: ""
    }
  });
  const onSubmit = form.handleSubmit((value) => {
    signInMutation.mutate(value, {
      onSuccess: async () => {
        await navigate({ to: redirectTo });
        toast.success(m.auth__sign_in_successful());
      }
    });
  });

  if (isPending) {
    return <Spinner />;
  }

  return (
    <Container className={cn("flex max-w-md flex-col gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <Link href="/" className="flex flex-col items-center gap-2 font-medium">
              <LogoIcon className="flex size-8 items-center justify-center rounded-md" />
              <span className="sr-only">{appConfig.site.shortName}</span>
            </Link>
            <h1 className="text-xl font-bold">{m.auth__sign_in_title()}</h1>
          </div>

          <TextField
            disabled={!isHydrated}
            error={form.formState.errors.email}
            label={m.auth__email_label()}
            placeholder={m.auth__email_placeholder()}
            registration={form.register("email")}
            required
            type="email"
          />

          <TextField
            disabled={!isHydrated}
            error={form.formState.errors.password}
            label={m.auth__password_label()}
            minLength={8}
            registration={form.register("password")}
            required
            type="password"
          />

          <Field>
            <Button
              type="submit"
              light="skeuomorphic"
              disabled={!isHydrated || signInMutation.isPending || signInMutation.isSuccess}
            >
              {signInMutation.isPending ? m.auth__signing_in() : m.auth__sign_in()}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        {m.auth__terms_agreement()} <Link to="/terms-of-service">{m.auth__terms_of_service()}</Link>{" "}
        {m.auth__and()} <Link to="/privacy-policy">{m.auth__privacy_policy()}</Link>.
      </FieldDescription>
    </Container>
  );
}
