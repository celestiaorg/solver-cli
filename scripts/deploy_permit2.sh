#!/bin/bash
set -e

# Load environment and export variables
set -a
. ./.env
set +a

echo "=== Deploying Permit2 ==="
echo ""

# Deploy to evolve (chain 1234)
echo "Deploying to evolve (chain $EVOLVE_CHAIN_ID)..."
cd oif/oif-contracts
PERMIT2_EVOLVE=$(PRIVATE_KEY=0x$EVOLVE_PK forge script script/DeployPermit2.s.sol:DeployPermit2 \
  --rpc-url $EVOLVE_RPC \
  --broadcast \
  --json 2>/dev/null | jq -r '.receipts[0].contractAddress')

echo "✓ Permit2 deployed to evolve: $PERMIT2_EVOLVE"
echo ""

# Deploy to evolve2 (chain 5678)
echo "Deploying to evolve2 (chain $EVOLVE2_CHAIN_ID)..."
PERMIT2_EVOLVE2=$(PRIVATE_KEY=0x$EVOLVE2_PK forge script script/DeployPermit2.s.sol:DeployPermit2 \
  --rpc-url $EVOLVE2_RPC \
  --broadcast \
  --json 2>/dev/null | jq -r '.receipts[0].contractAddress')

echo "✓ Permit2 deployed to evolve2: $PERMIT2_EVOLVE2"
echo ""

cd ../..

# Update state.json with Permit2 addresses
echo "Updating state.json..."
jq --arg addr "$PERMIT2_EVOLVE" '.chains."1234".contracts.permit2 = $addr' .solver/state.json > .solver/state.json.tmp && mv .solver/state.json.tmp .solver/state.json
jq --arg addr "$PERMIT2_EVOLVE2" '.chains."5678".contracts.permit2 = $addr' .solver/state.json > .solver/state.json.tmp && mv .solver/state.json.tmp .solver/state.json

echo "✓ State updated"
echo ""

echo "=== Permit2 Deployment Complete ==="
echo "  evolve:  $PERMIT2_EVOLVE"
echo "  evolve2: $PERMIT2_EVOLVE2"
