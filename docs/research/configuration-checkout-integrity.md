# Configuration checkout integrity: authoritative evaluation and checkout

## Question

How do Medusa and comparable commerce platforms (commercetools, Saleor, Shopify,
WooCommerce) handle authoritative configuration and checkout price and
availability integrity, and was Album Studio's former whole-input hash suitable
as a price-change acceptance token?

## Answer

**Completed Slice 1 evaluator and contracts provide the correct pure evaluation
seam. Planned Slice 6 must add server-side authoritative reload, reevaluation, and
Order placement. The rejected whole-input SHA fingerprint was not an idiomatic
price-acceptance token and over-captured unrelated changes.**

Every platform computes the authoritative price on the server and never trusts a
client-supplied price. Slice 6 must follow this model by rerunning
`evaluateConfiguration` on the server before Order placement.

The rejected design hashed the _entire evaluation input_ (product definition
including `revision`, all referenced component availability, quantity, currency,
and a redundant evaluator revision) and treated a hash mismatch as a price change
requiring explicit customer re-acceptance. Current contract does not expose that API.
No surveyed platform uses a content hash as a price-acceptance token:

- **Medusa v2** and **Saleor**: no acceptance token at all — server recomputes,
  completion is authoritative, changes surface as recompute/validation errors.
- **commercetools**: optimistic concurrency via a monotonic `version` (409 on
  stale), plus recalc; price-change confirmation is a recovery path built on
  _version + recomputed totals_, not a hash.
- **Shopify** and **WooCommerce** _do_ hash line configuration — but as a line
  **identity/dedup key**, price excluded, and Shopify explicitly documents the
  hash is **not a stable identifier** and changes whenever any characteristic
  changes. That is the exact failure mode the rejected Album Studio design
  invited.

The two things former design conflated — "is your configuration still
valid/available?" and "is the price you agreed to still the price?" — already have
their own correct channels (`CONFIGURATION_INVALID` and an old-vs-new total diff).
Committing to the buyer-facing outcome as `acceptedOrderTotal: Money` instead of
the whole input is narrower, human-meaningful, and needs no hashing dependency.
Current contract follows this exact outcome commitment.

Versions investigated (2026-07-12): Medusa **v2.17.2**, commercetools HTTP API
(release **2025-06-27**), Saleor @ **697b9ec**, Shopify Liquid/AJAX Cart docs
(latest) + Dawn **v15.5.0**, WooCommerce **9.9.3**.

## Evidence

### Every platform: server-authoritative pricing, client price never trusted

- **Medusa v2.17.2** recomputes line unit prices from variant price sets on every
  cart mutation (`getVariantsAndItemsWithPrices` sets `unitPrice = calculated_price.calculated_amount`),
  and order conversion reads `cart.items` / `item.unit_price` computed server-side.
  - <https://github.com/medusajs/medusa/blob/v2.17.2/packages/core/core-flows/src/cart/workflows/get-variants-and-items-with-prices.ts#L86-L142>
  - <https://github.com/medusajs/medusa/blob/v2.17.2/packages/core/core-flows/src/cart/workflows/complete-cart.ts#L406-L420>
- **commercetools** recalculates line price, shipping, discounts, taxes, and totals
  on `POST /carts/:id`; the `Recalculate` update action is the explicit refresh
  trigger.
  - <https://docs.commercetools.com/api/carts-orders-overview#update-a-cart>
- **Saleor** centralizes recompute in `fetch_checkout_data` / `_fetch_checkout_prices_if_expired`
  (TTL via `price_expiration`), and re-reads/refreshes the checkout immediately
  before completion.
  - <https://raw.githubusercontent.com/saleor/saleor/697b9ec6ffb93199f62f783e7bf6c550cd3bcf7e/saleor/checkout/calculations.py#L352-L369>
  - <https://raw.githubusercontent.com/saleor/saleor/697b9ec6ffb93199f62f783e7bf6c550cd3bcf7e/saleor/checkout/complete_checkout.py#L1667-L1687>
- **Shopify** cart/checkout `cost` is an _estimate_ subject to change and resolved
  server-side at checkout; storefront prices are never authoritative.
  - <https://shopify.dev/docs/api/storefront/latest/objects/CartCost>
- **WooCommerce 9.9.3** recomputes line totals from `product->get_price()` via
  `WC_Cart_Totals` and writes computed `line_total`/`line_tax` back into cart
  contents on cart operations.
  - <https://github.com/woocommerce/woocommerce/blob/9.9.3/plugins/woocommerce/includes/class-wc-cart-totals.php#L236-L239>

This is Album Studio's target contract. Slice 1 evaluator is complete; client use
and Slice 6 server reload and reevaluation remain planned.

### Change detection: monotonic version, not content hash

- **commercetools** — canonical optimistic concurrency: every resource carries a
  numeric `version`; updates/deletes must send the current `version` or receive a
  `409 ConcurrentModification`. Order creation guidance stresses using the latest
  cart version.
  - <https://docs.commercetools.com/api/general-concepts#optimistic-concurrency-control>
  - <https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation>
- **Medusa v2.17.2** — no version/ETag token in cart request payloads; concurrency
  is workflow-level locking (`acquireLockStep`/`releaseLockStep`) and completion
  returns **409** if a completion transaction is already in progress.
  - <https://github.com/medusajs/medusa/blob/v2.17.2/packages/medusa/src/api/store/carts/%5Bid%5D/complete/route.ts#L33-L62>
- **Saleor** — no `version` field on the checkout model; concurrency is DB-row
  locking (`select_for_update`); prices staleness handled by TTL recompute.
  - <https://raw.githubusercontent.com/saleor/saleor/697b9ec6ffb93199f62f783e7bf6c550cd3bcf7e/saleor/checkout/models.py#L271-L275>

Album Studio keeps versioning in its proper domains: Draft `revision` provides
compare-and-swap concurrency, while Product `revision` tracks lifecycle/editor
state. Neither participates in evaluation or price acceptance.

### Explicit price-change acceptance is rare and never hash-based

- **commercetools** is the only platform that documents a buyer-facing
  price-change confirmation, and it is a _recovery path_ on order creation built on
  recomputed totals + latest version — not a content hash. `freeze` is offered when
  fixed pricing is genuinely required.
  - <https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation>
  - <https://docs.commercetools.com/api/carts-orders-overview#freeze-a-cart>
- **Medusa** and **Saleor** have no price re-acceptance handshake: completion
  auto-recomputes and either succeeds or returns validation/stock errors.
  - <https://raw.githubusercontent.com/saleor/saleor/697b9ec6ffb93199f62f783e7bf6c550cd3bcf7e/saleor/checkout/complete_checkout.py#L1667-L1687>

Album Studio's explicit-acceptance requirement is a legitimate product choice;
the _mechanism_ was the issue, not the requirement.

### Hashing precedent exists — for line identity, not price acceptance

- **Shopify** line item `key` = `<variant_id>:<hash of unique characteristics>`,
  and the docs explicitly warn: _"Line item keys are not stable identifiers. The
  line item key will change as characteristics of the line item change. This
  includes, but is not limited to, properties and discount applications."_ Used to
  address/dedup cart lines; price is not in it.
  - <https://shopify.dev/docs/api/liquid/objects/line_item> (property `key`)
- **WooCommerce 9.9.3** `WC_Cart::generate_cart_id()` returns
  `md5( implode( '_', $id_parts ) )` over `product_id`, `variation_id`, the
  variation key/value pairs, and `cart_item_data` — the cart-line identity/merge
  key. Price is **not** hashed; it is recomputed separately by `WC_Cart_Totals`.
  - <https://github.com/woocommerce/woocommerce/blob/9.9.3/plugins/woocommerce/includes/class-wc-cart.php#L1007-L1042>
- **Medusa** dedups line items by `variant_id` + `metadata` + custom-price equality;
  no config digest.
  - <https://github.com/medusajs/medusa/blob/v2.17.2/packages/core/core-flows/src/cart/steps/get-line-item-actions.ts#L56-L84>

Absence is a finding: searches of the commercetools cart/checkout docs and the
Saleor `saleor/checkout/*` tree for `hash|fingerprint|checksum` returned no
price-acceptance or integrity token; Medusa's cart OpenAPI request/response
schemas define no fingerprint field.

### Historical evidence: over-capture demonstrated in former tests

Former fingerprint hashed whole input, so acceptance token moved on changes that
did not change buyer's price or configuration validity:

- Availability of a linked component changing from `available` to `low` changed
  the fingerprint even though `low` remained orderable and price was unchanged.
- A `ProductDefinition.revision` bump changed the fingerprint regardless of
  whether anything selected by the customer changed.
- An `evaluationRevision` bump changed the fingerprint even though evaluation
  logic did not read it. It entered the hash through the whole-input spread, so
  the claimed deterministic content fingerprint was revision-stamped: two
  otherwise identical configurations could produce different fingerprints.

Because rejected spec triggered `PRICE_CHANGED` when fingerprint **or** total
differed, each case forced Customer through price re-acceptance for something that
was not a price change. Current spec compares only valid current Order total.

## What this means for us

### Keep

- `evaluateConfiguration` as a pure function run on both client (estimate) and
  server (authoritative) before order placement. This is the universal norm.
- Integer-minor-unit money with explicit safe-integer overflow guards.
- The discriminated valid/invalid result with stable issue codes and issue
  locations for step navigation.
- Cascading invalidation via in-order group evaluation.

### Adopted contract — buyer-outcome commitment

Commit only to what the customer is accepting:

1. **Price acceptance = buyer-facing `acceptedOrderTotal`**, a `Money` value with
   `amountMinor` and `currency`. `PRICE_CHANGED` fires only when current evaluation
   is valid and current Order total differs. The server always reloads, recomputes,
   and compares equality, so nothing is trusted from the client — identical safety,
   no hash needed. The token becomes human-meaningful ("you accepted $435.00")
   instead of an opaque `cfg-v1:9f3a…`.
2. **Route validity/availability regressions through `CONFIGURATION_INVALID`**,
   not the price gate. `low` remains orderable. Only transitions to `out`, or
   another change that makes evaluation invalid, belong there.
3. **Use the existing monotonic `revision` for optimistic concurrency.** Drafts
   use compare-and-swap on `revision`, the commercetools-idiomatic mechanism,
   rather than a second, redundant hash.
4. **No hash dependency or evaluator revision** belongs in evaluator contract.

Order placement receives `acceptedOrderTotal`. Invalid current evaluation routes
through `CONFIGURATION_INVALID`; a valid changed total returns previous/current
breakdowns and current total. Resubmission with current total explicitly accepts
that buyer outcome, subject to another fresh authoritative reevaluation.

## Sources

Primary sources are linked inline. GitHub comparisons are pinned to exact tags or
commit SHAs (Medusa v2.17.2, Saleor 697b9ec, Dawn v15.5.0, WooCommerce 9.9.3) so
later repository changes do not rewrite the evidence; commercetools and Shopify are
official versioned documentation.

- Medusa v2.17.2 — cart pricing, completion, dedup, store routes:
  <https://github.com/medusajs/medusa/tree/v2.17.2/packages/core/core-flows/src/cart>
- commercetools HTTP API — concurrency, cart update/recalculate/freeze, order creation:
  <https://docs.commercetools.com/api/general-concepts> ·
  <https://docs.commercetools.com/api/carts-orders-overview> ·
  <https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation>
- Saleor @ 697b9ec — checkout calculations, completion, models:
  <https://github.com/saleor/saleor/tree/697b9ec6ffb93199f62f783e7bf6c550cd3bcf7e/saleor/checkout>
- Shopify — Liquid `line_item` (key), AJAX Cart, Storefront `CartCost`:
  <https://shopify.dev/docs/api/liquid/objects/line_item> ·
  <https://shopify.dev/docs/api/ajax/reference/cart> ·
  <https://shopify.dev/docs/api/storefront/latest/objects/CartCost>
- WooCommerce 9.9.3 — `generate_cart_id`, `WC_Cart_Totals`:
  <https://github.com/woocommerce/woocommerce/blob/9.9.3/plugins/woocommerce/includes/class-wc-cart.php> ·
  <https://github.com/woocommerce/woocommerce/blob/9.9.3/plugins/woocommerce/includes/class-wc-cart-totals.php>
