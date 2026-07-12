# Contract package patterns

Use this when adding shared commands, inputs, enums, or transport-safe rules in
`packages/contract`.

## Ownership

`packages/contract` is a pure boundary package. It owns hand-written inbound Zod
schemas, shared enums, and inferred types consumed by more than one layer. It has
no database, auth, React, oRPC, environment, or network dependencies.

```text
packages/contract/src/<capability>/
  index.ts
  types.ts
```

Export every schema and inferred type as named exports. Prefer command-specific
names such as `ProductCreateInputSchema`. Keep persisted row shapes in Drizzle;
do not mirror whole tables merely to create types.

If a value is only an outbound implementation result, infer it in core or API.
If a schema is app-local, colocate it with the owning hook, component, or route.
