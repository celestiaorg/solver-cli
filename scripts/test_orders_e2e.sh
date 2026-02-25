#!/bin/bash
set -e

# Load environment
. ./.env

echo "=== E2E Order Submission Test ==="
echo ""

# 1. Get deployed addresses
USDC_ANVIL1=$(cat .config/state.json | jq -r '.chains."31337".tokens.USDC.address')
USDC_ANVIL12=$(cat .config/state.json | jq -r '.chains."31338".tokens.USDC.address')
USER_ADDR=$(cast wallet address --private-key $USER_PK)

echo "Deployed addresses:"
echo "  USDC anvil1:  $USDC_ANVIL1"
echo "  USDC anvil2: $USDC_ANVIL12"
echo "  User:         $USER_ADDR"
echo ""

# 2. Convert to ERC-7930 hex format
USER_ANVIL1_HEX=$(python3 scripts/convert_address.py "eip155:31337:$USER_ADDR")
USDC_ANVIL1_HEX=$(python3 scripts/convert_address.py "eip155:31337:$USDC_ANVIL1")
USER_ANVIL12_HEX=$(python3 scripts/convert_address.py "eip155:31338:$USER_ADDR")
USDC_ANVIL12_HEX=$(python3 scripts/convert_address.py "eip155:31338:$USDC_ANVIL12")

echo "Converted to ERC-7930:"
echo "  USER_ANVIL1_HEX:  $USER_ANVIL1_HEX"
echo "  USDC_ANVIL1_HEX:  $USDC_ANVIL1_HEX"
echo "  USER_ANVIL12_HEX: $USER_ANVIL12_HEX"
echo "  USDC_ANVIL12_HEX: $USDC_ANVIL12_HEX"
echo ""

# 3. Approve USDC for Permit2 (canonical address on all chains)
echo "=== Approving USDC ==="
PERMIT2="0x000000000022D473030F116dDEE9F6B43aC78BA3"
echo "Approving Permit2 ($PERMIT2) to spend USDC..."
cast send --rpc-url $ANVIL1_RPC --private-key $USER_PK $USDC_ANVIL1 "approve(address,uint256)" $PERMIT2 100000000 > /dev/null 2>&1
echo "✓ USDC approved for Permit2"
echo ""

# 4. Request quote (without permit2 scheme - let solver decide)
echo "=== Requesting Quote ==="
QUOTE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d "{\"user\":\"$USER_ANVIL1_HEX\",\"intent\":{\"intentType\":\"oif-swap\",\"inputs\":[{\"user\":\"$USER_ANVIL1_HEX\",\"asset\":\"$USDC_ANVIL1_HEX\",\"amount\":\"1000000\"}],\"outputs\":[{\"receiver\":\"$USER_ANVIL12_HEX\",\"asset\":\"$USDC_ANVIL12_HEX\",\"amount\":\"1000000\"}],\"swapType\":\"exact-input\"},\"supportedTypes\":[\"oif-escrow-v0\"]}")

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
# Extract payload, ensure chainId is numeric (don't inject version - Permit2 domain has no version)
echo $QUOTE | jq '.order.payload | .domain.chainId = (.domain.chainId | tonumber)' > /tmp/eip712_payload.json

# Sign EIP-712 typed data
RAW_SIGNATURE=$(cast wallet sign --data --from-file /tmp/eip712_payload.json --private-key $USER_PK)

# Derive signature type prefix from primaryType: 0x00=Permit2, 0x01=EIP-3009
PRIMARY_TYPE=$(echo $QUOTE | jq -r '.order.payload.primaryType')
if echo "$PRIMARY_TYPE" | grep -q "Permit"; then
  SIG_PREFIX="00"
else
  SIG_PREFIX="01"
fi
SIGNATURE="0x${SIG_PREFIX}${RAW_SIGNATURE#0x}"
echo "✓ Order signed (${PRIMARY_TYPE}, prefix=0x${SIG_PREFIX})"
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
