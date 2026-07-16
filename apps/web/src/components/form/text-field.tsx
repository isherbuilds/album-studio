import { useId } from "react";
import { type FieldError as HookFormFieldError, type UseFormRegisterReturn } from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";

export function TextField({
  error,
  label,
  registration,
  ...props
}: {
  error?: HookFormFieldError;
  label: string;
  registration: UseFormRegisterReturn;
} & Omit<React.ComponentProps<typeof Input>, "id" | "name" | "onBlur" | "onChange" | "ref">) {
  const isInvalid = error !== undefined;
  const errorId = useId();
  const describedBy = [props["aria-describedby"], isInvalid ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={registration.name}>{label}</FieldLabel>
      <Input
        {...props}
        {...registration}
        aria-describedby={describedBy || undefined}
        aria-errormessage={isInvalid ? errorId : undefined}
        aria-invalid={isInvalid || undefined}
        id={registration.name}
      />
      {isInvalid && <FieldError errors={[error]} id={errorId} />}
    </Field>
  );
}
