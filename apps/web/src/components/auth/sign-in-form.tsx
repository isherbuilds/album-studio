import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@tsu-stack/auth/react/auth-client";
import { useAuth } from "@tsu-stack/auth/react/tanstack-start/hooks";
import { authQueryKeys } from "@tsu-stack/auth/react/tanstack-start/queries";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";
import { type NavigateTo } from "@tsu-stack/i18n/tanstack-start/types";
import { Button } from "@tsu-stack/ui/components/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import { cn } from "@tsu-stack/ui/lib/utils";

import { Container } from "@/components/common/container";
import { LogoIcon } from "@/components/common/logo";
import { appConfig } from "@/config/app.config";

export function SignInForm({
  redirectTo = "/",
  className,
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: NavigateTo }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPending } = useAuth();
  const isHydrated = useHydrated();

  const signInMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password
      });

      if (!result.data) {
        throw new Error(result.error?.message ?? m.auth__sign_in_failed());
      }

      return result;
    },
    onError: (error: Error) => {
      toast.error(error.message || m.auth__sign_in_failed());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        exact: true,
        queryKey: authQueryKeys.user,
        refetchType: "active"
      });
      await navigate({
        to: redirectTo
      });
      toast.success(m.auth__sign_in_successful());
    }
  });

  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    },
    onSubmit: async ({ value }) => {
      signInMutation.mutate(value);
    },
    validators: {
      onSubmit: z.object({
        email: z.email(m.auth__invalid_email()),
        password: z.string().min(8, m.auth__password_min_length())
      })
    }
  });

  if (isPending) {
    return <Spinner />;
  }

  return (
    <Container className={cn("flex max-w-md flex-col gap-6", className)} {...props}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await form.handleSubmit();
        }}
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <Link href="/" className="flex flex-col items-center gap-2 font-medium">
              <LogoIcon className="flex size-8 items-center justify-center rounded-md" />
              <span className="sr-only">{appConfig.site.shortName}</span>
            </Link>
            <h1 className="text-xl font-bold">{m.auth__sign_in_title()}</h1>
          </div>

          <form.Field name="email">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{m.auth__email_label()}</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="email"
                  value={field.state.value}
                  disabled={!isHydrated}
                  placeholder={m.auth__email_placeholder()}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-sm text-destructive" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </Field>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{m.auth__password_label()}</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                  disabled={!isHydrated}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-sm text-destructive" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </Field>
            )}
          </form.Field>

          <Field>
            <Button
              light="skeuomorphic"
              type="submit"
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
