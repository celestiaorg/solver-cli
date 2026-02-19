# Moving from POC to MVP
This is an implementation plan that you should execute with great attention to detail to 
move us from the current POC stage with mock tokens up to a real MVP with real Hyperlane tokens.

## What the tokens are
We have a token that lives natively on one of our local EVM chains (e.g. evolve) and is bridged through
Celestia's forwarding module e.g. lock on evolve => mint on celestia => forward on celestia to evolve2 (where it will be minted).

When going back we burn on evolve2, mint on Celestia, burn on Celestia and unlock on evolve.

So it's a Hyperlane bridge that uses Celestia as an intermediary step with an additional Synthetic token.

## Reference
You can look at Desktop/forwarding-relayer and take great inspiration from the Hyperlane setup there, which uses the forwarding module
in a 2 chain setup to go from Celestia to some local EVM chain (that's half of what we need already).

I want you to replicate this flow in our solver-cli project so that the Hyperlane relayer relays between all 3 chains (evolve, evolve2, celestia)
and the integration should extend config_gen.rs with a config for the Hyperlane relayer.

In order to achieve this you should use the forwarding relayer docker image with the backend & relayer e.g. it should start alongside the chains
in make start and be readily available. (study this in depth so you don't screw it up).

## Goal
Bridge a real hyperlane token instead of our current mock USDC token -> start hyperlane relayer, Celestia, forwarding relayer alongside the local anvil / evolve chains.
For the current MVP / front-end we don't really need any of this Hyperlane stuff. Hyperlane bridging through Celestia forwarding has nothing to do with 
solving. For the solver part we just want to use the real Hyperlane tokens instead of the mock USDC. However we do need to have an end to end test for moving solver funds 
e.g. the hyperlane USDC token from one chain to another. This additional e2e will be sort of a rebalancer demo but very simple just move from chain A to chain B the solver
funds in the hyperlane token denom.

So outcome should be:

Solver aggregator oracle etc. do the exact same thing as now, just on a different token

and we have a new end to end test to move solver USDC from one chain to another.

By the end of this there should be only the hyperlane USDC, no more mock USDC used in our entire codebase.