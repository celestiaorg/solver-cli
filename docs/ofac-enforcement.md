# OFAC Sanctions Enforcement

The solver refuses to fill intents where the **sender** or any **recipient** address appears on the OFAC Specially Designated Nationals (SDN) list. Affected users can reclaim their tokens from the intent escrow contract after expiry.

---

## Updating the sanctions list

Run this command from the project root:

```bash
solver-cli ofac update
```

This downloads the official SDN XML from OFAC, extracts all sanctioned Ethereum addresses, and writes them to `.config/ofac.json`.

**Recommended:** run this before deploying or on a regular schedule (e.g. weekly cron) so the list stays current.

---

## How enforcement works

1. **At solver startup**, if `ofac_list` is set in `solver.toml`, the solver loads `.config/ofac.json` into an in-memory set.
2. **On each incoming intent**, before the intent is stored or filled, the solver checks:
   - The **sender** (`user` field of the EIP-7683 order data)
   - Every **recipient** address in the intent's outputs
3. If any address matches, the intent is **silently skipped** — the solver publishes an `IntentRejected` event (visible in logs) and moves on.
4. The intent remains open on-chain. The submitter can call the escrow contract to reclaim their tokens after the intent's expiry time passes.

---

## Config

`solver-cli configure` (run automatically by `make deploy`) adds the following to `.config/solver.toml` when `.config/ofac.json` exists:

```toml
[solver]
ofac_list = ".config/ofac.json"
```

If the file does not exist, the line is omitted and no OFAC checking is performed.

---

## Source

The SDN list is fetched from the official OFAC API:

```
https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML
```

Only entries tagged `Digital Currency Address - ETH` are extracted.
