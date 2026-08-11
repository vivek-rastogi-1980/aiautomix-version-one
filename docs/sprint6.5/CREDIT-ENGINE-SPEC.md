# CREDIT ENGINE SPECIFICATION

## Data
credit_accounts
credit_transactions

## Transaction Types
- GRANT
- DEBIT
- REFUND
- ADJUSTMENT
- EXPIRATION

## Rules
- Atomic balance changes
- Immutable transaction ledger
- Server-side only
- Workspace scoped
- Idempotency for retries
- No browser-controlled balances

Future subscription allowances and credit packs can use this engine.
