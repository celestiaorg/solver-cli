#!/bin/bash
set -e

# Load environment
. ./.env

echo "=== E2E Order Submission Test ==="
echo ""

# 1. Get deployed addresses
USDC_EVOLVE=$(cat .solver/state.json | jq -r '.chains."31337".tokens.USDC.address')
USDC_EVOLVE2=$(cat .solver/state.json | jq -r '.chains."31338".tokens.USDC.address')
USER_ADDR=$(cast wallet address --private-key $USER_PK)

echo "Deployed addresses:"
echo "  USDC evolve:  $USDC_EVOLVE"
echo "  USDC evolve2: $USDC_EVOLVE2"
echo "  User:         $USER_ADDR"
echo ""

# 2. Convert to ERC-7930 hex format
USER_EVOLVE_HEX=$(python3 scripts/convert_address.py "eip155:31337:$USER_ADDR")
USDC_EVOLVE_HEX=$(python3 scripts/convert_address.py "eip155:31337:$USDC_EVOLVE")
USER_EVOLVE2_HEX=$(python3 scripts/convert_address.py "eip155:31338:$USER_ADDR")
USDC_EVOLVE2_HEX=$(python3 scripts/convert_address.py "eip155:31338:$USDC_EVOLVE2")

echo "Converted to ERC-7930:"
echo "  USER_EVOLVE_HEX:  $USER_EVOLVE_HEX"
echo "  USDC_EVOLVE_HEX:  $USDC_EVOLVE_HEX"
echo "  USER_EVOLVE2_HEX: $USER_EVOLVE2_HEX"
echo "  USDC_EVOLVE2_HEX: $USDC_EVOLVE2_HEX"
echo ""

# 3. Approve USDC for InputSettlerEscrow
echo "=== Approving USDC ==="
INPUT_SETTLER=$(cat .solver/state.json | jq -r '.chains."31337".contracts.input_settler_escrow')
echo "Approving InputSettlerEscrow ($INPUT_SETTLER) to spend USDC..."
cast send --rpc-url $EVOLVE_RPC --private-key $USER_PK $USDC_EVOLVE "approve(address,uint256)" $INPUT_SETTLER 100000000 > /dev/null 2>&1
echo "✓ USDC approved for InputSettlerEscrow"
echo ""

# 4. Request quote (without permit2 scheme - let solver decide)
echo "=== Requesting Quote ==="
QUOTE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d "{\"user\":\"$USER_EVOLVE_HEX\",\"intent\":{\"intentType\":\"oif-swap\",\"inputs\":[{\"user\":\"$USER_EVOLVE_HEX\",\"asset\":\"$USDC_EVOLVE_HEX\",\"amount\":\"1000000\"}],\"outputs\":[{\"receiver\":\"$USER_EVOLVE2_HEX\",\"asset\":\"$USDC_EVOLVE2_HEX\",\"amount\":\"1000000\"}],\"swapType\":\"exact-input\"},\"supportedTypes\":[\"oif-escrow-v0\"]}")

QUOTE_ID=$(echo $QUOTE_RESPONSE | jq -r '.quotes[0].quoteId // empty')

if [ -z "$QUOTE_ID" ]; then
  echo "ERROR: Failed to get quote"
  echo $QUOTE_RESPONSE | jq
  exit 1
fi

echo "✓ Quote received: $QUOTE_ID"
echo ""

# 5. Extract and sign EIP-712 payload
echo "=== Signing Order ==="
QUOTE=$(echo $QUOTE_RESPONSE | jq -c '.quotes[0]')
echo $QUOTE | jq '.order.payload' > /tmp/eip712_payload.json

# Sign EIP-712 typed data - aggregator expects just the raw signature
RAW_SIGNATURE=$(cast wallet sign --data --from-file /tmp/eip712_payload.json --private-key $USER_PK)
# Prepend signature type byte for ERC-3009 (0x01)
SIGNATURE="0x01${RAW_SIGNATURE#0x}"
echo "✓ Order signed: $RAW_SIGNATURE"
echo "✓ Signature with type prefix: $SIGNATURE"
echo ""

# 6. Submit order
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

# 7. Monitor order status
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
