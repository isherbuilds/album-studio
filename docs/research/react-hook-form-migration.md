# React Hook Form migration

Date: 2026-07-15

## Question

Should Album Studio replace TanStack Form with React Hook Form, while preserving Zod 4 validation and TanStack Query mutation ownership? Which Midday patterns are worth adopting?

## Answer

Yes. The active forms are small and dominated by native text inputs, so React Hook Form's `register` path fits better than a controlled form store. Use `Controller` only for Base UI `Select` and the currency input that must visibly normalize while typing. Keep native `FormData` forms unchanged.

Adopt Midday's small `useZodForm(schema, options)` seam and direct `form.handleSubmit(onSubmit)` wiring, but improve it for Zod 4 by typing the form input and parsed output separately. Keep Album Studio's existing mutation hooks: they already centralize oRPC calls, errors, cache invalidation, and updates more cleanly than Midday's component-local mutations.

## Evidence

- React Hook Form `register` returns native input bindings (`name`, `ref`, `onChange`, `onBlur`) and is its uncontrolled path. `Controller` is specifically the adapter for controlled components. [RHF source](https://github.com/react-hook-form/react-hook-form/blob/master/src/logic/createFormControl.ts) and [Controller source](https://github.com/react-hook-form/react-hook-form/blob/master/src/controller.tsx).
- RHF scopes form-state subscriptions by field name and proxy flags, reducing unrelated renders. [useFormState source](https://github.com/react-hook-form/react-hook-form/blob/master/src/useFormState.ts) and [subscription predicate](https://github.com/react-hook-form/react-hook-form/blob/master/src/logic/shouldSubscribeByName.ts).
- RHF 7.81.0 supports React 19 and sets a 12.6 kB bundlewatch ceiling for its CJS build. [package metadata](https://github.com/react-hook-form/react-hook-form/blob/master/package.json).
- `@hookform/resolvers` exposes `zodResolver` and supports Zod 3 and Zod 4. The resolver returns parsed output unless `raw: true`; `useForm<Input, Context, Output>` preserves transform typing. [resolver source](https://github.com/react-hook-form/resolvers/blob/master/zod/src/zod.ts) and [resolver README](https://github.com/react-hook-form/resolvers#typescript).
- Zod 4 distinguishes schema input and output types. [Zod type inference docs](https://zod.dev/basics#inferring-types).
- shadcn's current RHF guide uses `zodResolver`, `Controller`, `Field`, `data-invalid`, `aria-invalid`, and `FieldError`, while recommending native browser constraints in production. [shadcn RHF guide](https://ui.shadcn.com/docs/forms/react-hook-form).
- Midday centralizes resolver setup in [`use-zod-form.ts`](https://github.com/midday-ai/midday/blob/main/apps/dashboard/src/hooks/use-zod-form.ts), submits through `form.handleSubmit`, and drives pending UI from TanStack Query mutations in forms such as [`invite-form.tsx`](https://github.com/midday-ai/midday/blob/main/apps/dashboard/src/components/forms/invite-form.tsx) and [`api-key-form.tsx`](https://github.com/midday-ai/midday/blob/main/apps/dashboard/src/components/forms/api-key-form.tsx).
- Album Studio already owns mutation side effects in `apps/web/src/hooks/use-auth.ts`, `use-organization.ts`, and `use-platform-admin.ts`; forms only supply validated values and component-local success transitions.

## What this means for us

1. Add `react-hook-form` and `@hookform/resolvers`; remove `@tanstack/react-form` and its devtools.
2. Replace `useAppForm` with a Zod 4-aware `useZodForm` hook.
3. Register native `Input` controls rather than wrapping all fields in `Controller`.
4. Keep a small shared text-field renderer for shadcn `Field` accessibility and errors.
5. Use `Controller` only where the UI control is genuinely controlled.
6. Keep mutation/cache/error policy in domain hooks; do not copy Midday's component-local query invalidation.
7. Keep simple native `FormData` forms native; converting them would add state machinery without user-visible value.

## Sources

- https://github.com/react-hook-form/react-hook-form
- https://github.com/react-hook-form/resolvers
- https://zod.dev/basics
- https://ui.shadcn.com/docs/forms/react-hook-form
- https://github.com/midday-ai/midday/tree/main/apps/dashboard/src
