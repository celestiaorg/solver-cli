#!/bin/bash
set -e

# Load environment
. ./.env

echo "=== E2E Order Submission Test ==="
echo ""

# 1. Get deployed addresses
USDC_EVOLVE=$(cat .solver/state.json | jq -r '.chains."1234".tokens.USDC.address')
USDC_SEPOLIA=$(cat .solver/state.json | jq -r '.chains."11155111".tokens.USDC.address')
USER_ADDR=$(cast wallet address --private-key $USER_PK)

echo "Deployed addresses:"
echo "  USDC evolve:  $USDC_EVOLVE"
echo "  USDC sepolia: $USDC_SEPOLIA"
echo "  User:         $USER_ADDR"
echo ""

# 2. Convert to ERC-7930 hex format
USER_EVOLVE_HEX=$(python3 scripts/convert_address.py "eip155:1234:$USER_ADDR")
USDC_EVOLVE_HEX=$(python3 scripts/convert_address.py "eip155:1234:$USDC_EVOLVE")
USER_SEPOLIA_HEX=$(python3 scripts/convert_address.py "eip155:11155111:$USER_ADDR")
USDC_SEPOLIA_HEX=$(python3 scripts/convert_address.py "eip155:11155111:$USDC_SEPOLIA")

echo "Converted to ERC-7930:"
echo "  USER_EVOLVE_HEX:  $USER_EVOLVE_HEX"
echo "  USDC_EVOLVE_HEX:  $USDC_EVOLVE_HEX"
echo "  USER_SEPOLIA_HEX: $USER_SEPOLIA_HEX"
echo "  USDC_SEPOLIA_HEX: $USDC_SEPOLIA_HEX"
echo ""

# 3. Request quote
echo "=== Requesting Quote ==="
QUOTE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d "{\"user\":\"$USER_EVOLVE_HEX\",\"intent\":{\"intentType\":\"oif-swap\",\"inputs\":[{\"user\":\"$USER_EVOLVE_HEX\",\"asset\":\"$USDC_EVOLVE_HEX\",\"amount\":\"1000000\"}],\"outputs\":[{\"receiver\":\"$USER_SEPOLIA_HEX\",\"asset\":\"$USDC_SEPOLIA_HEX\"}],\"swapType\":\"exact-input\"},\"supportedTypes\":[\"oif-escrow-v0\"]}")

QUOTE_ID=$(echo $QUOTE_RESPONSE | jq -r '.quotes[0].quoteId // empty')

if [ -z "$QUOTE_ID" ]; then
  echo "ERROR: Failed to get quote"
  echo $QUOTE_RESPONSE | jq
  exit 1
fi

echo "✓ Quote received: $QUOTE_ID"
echo ""

# 4. Extract and sign EIP-712 payload
echo "=== Signing Order ==="
QUOTE=$(echo $QUOTE_RESPONSE | jq -c '.quotes[0]')
echo $QUOTE | jq '.order.payload' > /tmp/eip712_payload.json

SIGNATURE=$(cast wallet sign-typed-data --private-key $USER_PK --data "$(cat /tmp/eip712_payload.json)")
echo "✓ Order signed: $SIGNATURE"
echo ""

# 5. Submit order
echo "=== Submitting Order ==="
ORDER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d "{\"quoteResponse\":$QUOTE,\"signature\":\"$SIGNATURE\"}")

ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.orderId // .error // empty')

if echo $ORDER_RESPONSE | jq -e '.error' > /dev/null; then
  echo "ERROR: Order submission failed"
  echo $ORDER_RESPONSE | jq
  exit 1
fi

echo "✓ Order submitted: $ORDER_ID"
echo ""

# 6. Monitor order status
echo "=== Monitoring Order ==="
echo "Waiting for solver to fill order..."
sleep 5

for i in {1..30}; do
  STATUS=$(curl -s http://localhost:4000/api/v1/orders/$ORDER_ID | jq -r '.status // "unknown"')
  echo "[$i/30] Order status: $STATUS"

  if [ "$STATUS" = "finalized" ]; then
    echo ""
    echo "✓ Order finalized!"
    curl -s http://localhost:4000/api/v1/orders/$ORDER_ID | jq
    break
  fi

  sleep 2
done

echo ""
echo "=== Final Balances ==="
make balances
