# shadcn preset codes: applicability to shared Album configurations

## Question

Should Album Studio adopt shadcn/ui's self-contained preset codec for sharing
Organization/Product configurations?

## Answer

**No. Copy UX pattern, not codec.** shadcn's codec works because it represents a
small, fixed, visual configuration whose option arrays are part of versioned code.
Album groups, values, numeric inputs, prices, and availability are dynamic domain
data. Their safety requires server lookup, authorization, and current reevaluation.

If sharing is promoted later, store immutable shared-configuration snapshots and
give each one a short lookup code. Keep shared snapshot separate from mutable Draft
and Order acceptance. Defer feature from current MVP unless explicitly promoted.

Evidence below is pinned to shadcn-ui/ui commit
[`3cdaa6e`](https://github.com/shadcn-ui/ui/tree/3cdaa6eb2f0da27aca8598cb752c32d840e06940)
(2026-07-10); CLI behavior comes from official current documentation reviewed
2026-07-12.

## Evidence

### Builder state and shared codec

Create builder defines ten encoded visual dimensions—`style`, `baseColor`,
`theme`, `chartColor`, `iconLibrary`, `font`, `fontHeading`, `radius`,
`menuAccent`, and `menuColor`—while passing unrelated query state through. Reads
decode `?preset=CODE`; writes merge current values, encode a new code, clear
individual visual query keys, and push updated URL state.

- Dimension tuple and non-encoded query keys:
  [search-params.ts lines 99-133](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/apps/v4/app/%28app%29/%28create%29/lib/search-params.ts#L99-L133)
- Decode/overlay path:
  [search-params.ts lines 211-238](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/apps/v4/app/%28app%29/%28create%29/lib/search-params.ts#L211-L238)
- Encode/URL-update path and hook behavior:
  [search-params.ts lines 241-268](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/apps/v4/app/%28app%29/%28create%29/lib/search-params.ts#L241-L268),
  [lines 273-342](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/apps/v4/app/%28app%29/%28create%29/lib/search-params.ts#L273-L342)
- Builder adapter calls shared `shadcn/preset` encoder:
  [preset-code.ts lines 1-33](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/apps/v4/app/%28app%29/%28create%29/lib/preset-code.ts#L1-L33).

### Format: fixed ordinal slots, deterministic local decode

Codec stores each selected option's **array index** in a fixed-width slot. V2's
fixed tuple has ten fields and 51 allocated bits; V1 has eight fields and 40 bits.
Encoder uses arithmetic rather than 32-bit JS bitwise operations, then prefixes
version and base62-encodes packed integer. Same input and option arrays therefore
produce same code. Recognizer accepts 2–10 characters. Implementation is pure,
browser-safe code with no database, KV, Redis, network, or identifier lookup.

- Compatibility rules, including append-only fields/options and 53-bit ceiling:
  [preset.ts lines 1-12](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts#L1-L12)
- V1/V2 fixed field order, widths, and 40/51-bit totals:
  [preset.ts lines 134-151](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts#L134-L151)
- Base62 alphabet and version prefixes:
  [preset.ts lines 170-195](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts#L170-L195)
- Ordinal packing and deterministic version-prefixed output:
  [preset.ts lines 198-215](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts#L198-L215)
- 2–10-character validation:
  [preset.ts lines 251-259](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts#L251-L259).

V1 uses prefix `a`; V2 uses `b`, adds `chartColor` and `fontHeading`, and is
current encoder output. Existing arrays cannot be reordered; options and fields
can only be appended, new field default must occupy index 0, and total must remain
below JS safe-integer's 53-bit limit. This is schema migration encoded directly in
source order, not data migration.

### Decode defaults are intentionally lossy

Malformed/unsupported version or base62 returns `null`. Valid code with an
out-of-range slot silently selects that field's first option; unknown input passed
to encoder also becomes index 0. V1 decode supplies `fontHeading = "inherit"`, and
builder separately restores legacy chart behavior.

- Encoder unknown-value fallback:
  [preset.ts lines 200-214](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts#L200-L214)
- Decode rejection, ordinal extraction, first-option fallback, and V1 default:
  [preset.ts lines 217-248](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts#L217-L248)
- V1 chart compatibility map:
  [preset.ts lines 67-78](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts#L67-L78),
  consumed by builder's decode flow
  [search-params.ts lines 211-235](https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/apps/v4/app/%28app%29/%28create%29/lib/search-params.ts#L211-L235).

**Inference:** fallback is acceptable for visual presets: worst result is a valid
default appearance. It is wrong for Album ordering: silently changing deleted or
reordered selection to first option can change product, quantity, price, or
availability while appearing valid.

### Official CLI behavior

Official docs expose codec as product workflow: `preset decode <code>` inspects
contents (`--json` available); `preset url <code>` prints create URL;
`preset open <code>` opens builder; `apply <code>` applies preset to existing
project, with `--only theme` or `--only font` for partial application. `init
--preset <code>` scaffolds from code.

- [CLI: apply and preset commands](https://ui.shadcn.com/docs/cli#apply)
- [CLI: preset decode](https://ui.shadcn.com/docs/cli#preset-decode)
- [CLI: preset URL and open](https://ui.shadcn.com/docs/cli#preset-url)
- [Preset launch announcement: short code packs and shares design config](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4#introducing---preset)
- [Apply announcement: components/theme/colors/CSS/fonts/icons update while base
  and RTL remain current-project settings](https://ui.shadcn.com/docs/changelog/2026-04-shadcn-apply)

## What this means for us

### Reject direct codec

Album Organization/Product groups and values are dynamic: they can be added,
deleted, reordered, or changed. Numeric values do not fit finite option indexes.
Prices and availability must be current at use time. A self-contained code cannot
authorize Organization access. Therefore fixed ordinal positions, append-only
arrays, lossy defaults, and 53-bit budget are wrong constraints.

Handle dynamic lists with immutable machine IDs and current server reevaluation,
never ordinal bit positions. Labels/order may change without changing identity;
deleted or unavailable IDs must fail validation rather than map to neighbors.

### Retain short share-code UX with DB-backed semantics

**Recommendation (design inference):** if promoted later, create immutable
`SharedConfiguration` snapshot separate from mutable Draft and Order. Short code
resolves snapshot containing Organization ID, Product ID/revision, selected group
and value machine IDs, numeric values, and quantity. On explicit recipient action,
server:

1. resolves code and membership-scopes Organization access;
2. loads current Product and current component/value availability;
3. reevaluates selections and quantity against current definition; and
4. creates recipient's mutable Draft.

Code never carries or trusts price/availability. Snapshot may identify source
Product revision for explanation/audit, but current Product controls validity and
price. Sharing does not replace Draft compare-and-swap revision, autosave, or final
`acceptedOrderTotal` check during Order placement.

For private Organization-only sharing, use random 8-character base58/base62 code
as lookup convenience with database unique constraint, collision retry, and
membership authorization. Code is not secret. **Inference:** public bearer sharing
needs materially more entropy and separate threat-modelled expiry/revocation; eight
base62 characters provide only about 47.6 bits (`log2(62^8)`).

### Decision

Defer from current MVP unless product explicitly promotes sharing. If promoted,
spec DB-backed immutable snapshot flow; do not port shadcn bit packing.

## Sources

Primary sources linked inline. Source links pin exact requested commit; official
documentation links describe current CLI behavior as reviewed 2026-07-12.

- shadcn-ui/ui preset codec:
  <https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/packages/shadcn/src/preset/preset.ts>
- shadcn create builder query flow:
  <https://github.com/shadcn-ui/ui/blob/3cdaa6eb2f0da27aca8598cb752c32d840e06940/apps/v4/app/%28app%29/%28create%29/lib/search-params.ts>
- Official CLI docs: <https://ui.shadcn.com/docs/cli>
- Official preset commands changelog:
  <https://ui.shadcn.com/docs/changelog/2026-04-preset-commands>
