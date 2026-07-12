# Configurator form normalization

## Question

Do TanStack Form, Zod, or native HTML automatically normalize dependent Product
selections, and can Album Studio avoid its own configuration evaluator?

## Answer

No. TanStack Form stores values, schedules validation, and exposes explicit
mutation APIs. Zod parses and returns output without mutating input. Native HTML
provides input affordances and constraint validity. None understands Album
Studio requirements, Component availability, price rules, or which later
selection must be cleared.

Album Studio still needs one small, pure domain evaluator. It does not need a
generic normalization framework or a collection of helper modules. TanStack
Form can apply evaluator output through its listener API and `setFieldValue`.
The server must run the same evaluator against current authoritative data.

Repository versions at investigation time (2026-07-12):

- `@tanstack/react-form` 1.33.0 (`pnpm-workspace.yaml:42`)
- Zod 4.4.3 (`pnpm-workspace.yaml:87`)

## Evidence

### TanStack Form validates but does not replace values

TanStack Form's validation guide says Standard Schema validation does not expose
transformed values. Its submission guide states `onSubmit` receives schema input
and requires an explicit `schema.parse(value)` to obtain transformed output.
The core implementation discards the successful Standard Schema output and
retains only issues/no issues.

- [TanStack Form validation guide](https://tanstack.com/form/v1/docs/framework/react/guides/validation)
- [TanStack Form submission guide](https://tanstack.com/form/v1/docs/framework/react/guides/submission-handling)
- [TanStack Form Standard Schema validator source](https://github.com/TanStack/form/blob/main/packages/form-core/src/standardSchemaValidator.ts#L789-L847)

Linked fields only trigger revalidation. They do not reset or replace another
field. TanStack's own country/province example uses a listener and an explicit
`form.setFieldValue("province", "")` call when the country changes.

- [TanStack Form linked fields](https://tanstack.com/form/latest/docs/framework/react/guides/linked-fields)
- [TanStack Form listeners](https://tanstack.com/form/latest/docs/framework/react/guides/listeners)
- [TanStack Form `setFieldValue`](https://tanstack.com/form/latest/docs/reference/classes/FormApi#setfieldvalue)

Existing Album Studio sign-in code follows the same controlled-state pattern:
`field.handleChange` writes the value, while Zod runs as an `onSubmit` validator
(`apps/web/src/components/auth/sign-in-form.tsx:58-71,96-137`).

### Zod returns parsed output; it does not mutate form state

Zod `.parse()` returns a cloned parsed value. A transform can change the returned
output type, but callers must use that return value. This cannot silently change
TanStack Form's current store.

- [Zod parsing and transforms](https://zod.dev/basics)

Using a Zod transform as the configuration engine would still require explicit
parsing, would not update live fields during validation, and would mix pricing,
availability, and compatibility behavior into a boundary schema.

### Native HTML validates controls; it does not enforce domain state

`input[type=number]` supports `required`, `min`, `max`, and `step`. Manual values
outside those constraints remain values but fail constraint validation.
`valueAsNumber` converts the control value to a number or `NaN`.

- [HTML number input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number)
- [HTML `valueAsNumber`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/valueAsNumber)

Disabled controls cannot be clicked and are omitted from native submission, but
disabling a control does not define how a controlled React/TanStack value should
be cleared. Client constraint validation is also not a security boundary.

- [HTML disabled attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled)
- [HTML form-validation security](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#security-forms)

### Mature storefronts also implement domain selection logic

Shopify Dawn has no form library performing variant resolution. Its JavaScript
reads selected option IDs, requests authoritative Product HTML, then replaces
the picker, selected variant, price, inventory, quantity rules, and submit state.
Liquid renders Shopify-derived availability; native inputs do not derive it.

- [Dawn option change](https://github.com/Shopify/dawn/blob/83d5e6b4094d8019820bffafe04b242d0602ffe2/assets/global.js#L1063-L1082)
- [Dawn Product refresh](https://github.com/Shopify/dawn/blob/83d5e6b4094d8019820bffafe04b242d0602ffe2/assets/product-info.js#L63-L80)
- [Dawn Product state replacement](https://github.com/Shopify/dawn/blob/83d5e6b4094d8019820bffafe04b242d0602ffe2/assets/product-info.js#L157-L226)
- [Dawn variant option rendering](https://github.com/Shopify/dawn/blob/83d5e6b4094d8019820bffafe04b242d0602ffe2/snippets/product-variant-options.liquid#L23-L40)
- [Dawn server add-to-cart](https://github.com/Shopify/dawn/blob/83d5e6b4094d8019820bffafe04b242d0602ffe2/assets/product-form.js#L20-L69)

Saleor Storefront explicitly computes compatibility and stock, then removes
conflicting selections when a new value is chosen. React renders the result; no
form or schema library supplies this behavior.

- [Saleor compatibility and adjusted selections](https://github.com/saleor/storefront/blob/d5c78314b24a1d415a46cbd855455fdbffa3ca31/src/ui/components/pdp/variant-selection/utils.ts#L364-L454)
- [Saleor selection orchestration](https://github.com/saleor/storefront/blob/d5c78314b24a1d415a46cbd855455fdbffa3ca31/src/ui/components/pdp/variant-selection/variant-selection-section.tsx#L99-L143)
- [Saleor option rendering](https://github.com/saleor/storefront/blob/d5c78314b24a1d415a46cbd855455fdbffa3ca31/src/ui/components/pdp/variant-selection/renderers/button-option.tsx#L15-L80)

Medusa's DTC starter is simpler because every sellable combination is a
precomputed variant. It matches the selected option map to one variant and
disables Add when no valid in-stock variant exists. The server receives a
variant ID and quantity.

- [Medusa variant matching and Product actions](https://github.com/medusajs/dtc-starter/blob/3f82d1045a4c7e21e9c47033432b9cfa45574627/apps/storefront/src/modules/products/components/product-actions/index.tsx#L39-L184)
- [Medusa server cart action](https://github.com/medusajs/dtc-starter/blob/3f82d1045a4c7e21e9c47033432b9cfa45574627/apps/storefront/src/lib/data/cart.ts#L117-L158)

## What this means for Album Studio

### Keep

- One pure `evaluateConfiguration(input)` function.
- Product-definition and evaluation Zod schemas at package boundaries.
- Native `required`, `min`, `max`, `step`, and `valueAsNumber` for UI affordance.
- Explicit TanStack Form listener or change handler applying cleared selections.
- Server-side re-evaluation with current Product, prices, and Component status.
- Deterministic fingerprint because approved checkout requires price-change
  acceptance (`docs/specs/album-studio-mvp.md:87-94`).

### Cut

- Generic form-normalization layer.
- Separate pricing, requirements, availability, or money helper modules with one
  call site.
- Zod transforms intended to mutate live form state.
- Browser fallback values for missing authoritative Component state.
- Preview debounce before measurement.
- Slice 4 UI or Slice 6 API work inside Slice 1.

### Smallest correct responsibility split

1. Native HTML converts and constrains individual inputs for user experience.
2. TanStack Form owns current editable values, field metadata, and explicit
   clearing through `setFieldValue`.
3. Zod validates transport and Product-definition shape.
4. Configuration evaluator owns compatibility, effective availability, numeric
   pricing, invalidated selections, totals, issues, and fingerprint.
5. Server reloads current data and reruns evaluator before Order creation.

## Slice boundaries and user flow

Slice 1 itself adds no route, screen, click, API, or database table. Customers,
Platform Admins, Organization Owners, and Managers see no new UI. It produces
the contract and pure engine consumed later (`docs/specs/album-studio-mvp.md:138-142`).

- Slice 4 adds private catalog, Product view, configurator UI, and live local
  evaluation (`docs/specs/album-studio-mvp.md:156-160`).
- Slice 5 adds Draft creation, autosave, resume, and revision conflicts
  (`docs/specs/album-studio-mvp.md:162-166`).
- Slice 6 adds server-authoritative Order placement and fingerprint acceptance
  (`docs/specs/album-studio-mvp.md:168-172`).
- Slice 8 supplies current inventory state (`docs/specs/album-studio-mvp.md:180-184`).
- Slice 9 adds Owner/Manager Product editing and evaluator-backed preview
  (`docs/specs/album-studio-mvp.md:186-190`).

## Sources

Primary sources are linked inline. GitHub comparisons are pinned to exact commit
SHAs so later repository changes do not rewrite the evidence.
