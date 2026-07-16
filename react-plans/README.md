# React improvement plans

| Plan                                                                                          | Status | Order | Depends on |
| --------------------------------------------------------------------------------------------- | ------ | ----: | ---------- |
| [001 — Guard unsaved product edits](001-guard-unsaved-product-edits.md)                       | DONE   |     1 | —          |
| [002 — Evict deleted product cache safely](002-evict-deleted-product-cache.md)                | DONE   |     2 | 001        |
| [003 — Remove render-time locale mutation](003-remove-render-time-locale-mutation.md)         | DONE   |     3 | —          |
| [004 — Centralize money formatting](004-centralize-money-formatting.md)                       | DONE   |     4 | —          |
| [005 — Fix catalog dialog reflow](005-fix-catalog-dialog-reflow.md)                           | DONE   |     5 | —          |
| [006 — Associate product guidance and filters](006-associate-product-guidance-and-filters.md) | DONE   |     6 | 001        |
| [007 — Use trusted log client identity](007-use-trusted-log-client-identity.md)               | DONE   |     7 | —          |
| [008 — Enforce cookie mutation origin](008-enforce-cookie-mutation-origin.md)                 | DONE   |     8 | —          |

Execute correctness/security plans first, then shared-policy and accessibility polish. Each plan is stamped against `1f36756`; current uncommitted MVP work is expected context.
