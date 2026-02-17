Add a frontend to this project (React, Vite) at the same level as solver-cli e.g. ./frontend/*.

The frontend should support the following actions:

- dropdown to select source and destination chain
- enter amount and get a quote from the solver

It should also render all user balances and the solver balances and the flow should be:

- user requests quote
- user accepts quote
- services to their thing

Balances are updated (user sees that in the UI)


Also add a faucet integrated into this frontend in a place where it makes sense so user can:

- claim gas on evolve1 chain 
- claim USDC on evolve1 chain


The only supported token for now is USDC, but feel free to make a dropdown for supported tokens too.

The design should adhere to standards in the blockchain industry and be both minimal and professionally compelling (modern).