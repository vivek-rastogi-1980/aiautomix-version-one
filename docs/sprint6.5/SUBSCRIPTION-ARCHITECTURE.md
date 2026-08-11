# SUBSCRIPTION ARCHITECTURE

## Flow
Workspace → Subscription → Plan → Entitlements

## States
- trialing
- active
- past_due
- canceled
- expired

## Provider Abstraction
Application → Payment Service → Provider Adapter

Future adapters:
- Stripe
- Razorpay

Sprint 6.5 does not implement payment providers.
