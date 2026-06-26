# Ops Runbook — Dashboard Performance

## dashboard-slow

Symptoms: customers report the analytics dashboard takes >5s to load.

Likely causes, most common first:

1. ClickHouse query fan-out on wide date ranges — check `query_log` for
   scans > 2s and add a `toStartOfHour` pre-aggregation.
2. Cold Next.js server components after a deploy — first paint is slow until
   the route cache warms. Self-resolves within ~10 minutes of a release.
3. Regional network weather — clients behind congested ISPs (often during
   local storms) see inflated TTFB that looks like a backend regression.

Mitigations:

- Confirm p95 server latency in Grafana before assuming a backend fault.
- If p95 is healthy, the slowness is client-side / network; reassure the
  customer and offer the lightweight dashboard mode.

## billing-discrepancy

Symptoms: invoice total does not match metered usage.
Action: pull the usage ledger for the billing period and reconcile against
the Stripe invoice line items before issuing any credit.
