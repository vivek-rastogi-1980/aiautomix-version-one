# SPRINT 06.5 TEST CASES

## Plan
- Free resolves correctly
- Paid plans resolve correctly
- Unknown plan fails safely

## Entitlements
- Allowed feature succeeds
- Restricted feature denied
- Workspace isolation enforced
- Client cannot grant entitlement

## Credits
- Grant increases balance
- Debit decreases balance
- Insufficient balance rejected
- Refund restores balance
- Adjustment is auditable
- Concurrent debits remain atomic
- Duplicate request does not double-charge

## Usage
- Successful AI request creates usage event
- Failed AI request records failure
- Tokens persist
- Model persists
- Estimated cost persists

## Subscription
- Active subscription grants entitlements
- Canceled subscription changes access correctly
- Past-due state is handled
- Client cannot modify subscription state

## Security
- Cross-workspace access denied
- Client cannot modify credits
- Client cannot change plan
- Client cannot change entitlement
- RLS enforced

## Regression
- Validator works
- Business Plan works
- PDF works
- Workspace works
- Authentication works

## Build Gates
- Typecheck
- Lint
- Test
- Production build
