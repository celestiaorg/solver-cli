# OIF Aggregator Integration

The OIF Aggregator provides a unified HTTP API for requesting quotes from multiple solvers and submitting orders. This enables price competition between solvers while maintaining reliable order fulfillment.

## Key Concept - Solver Routing

- **Request quotes**: All enabled solvers respond with their best offers
- **Submit order**: Goes **only to the solver** that provided the chosen quote
- **Order tracking**: Each order is tied to a specific solver via `solver_id`

This architecture allows price competition between solvers while ensuring order fulfillment by the selected solver.

## Starting the Aggregator

```bash
# Terminal 1: Start aggregator (port 4000)
make aggregator

# Terminal 2: Start your solver (port 3000)
make solver

# Terminal 3: Start oracle operator
make operator
```

## Quick Test

To quickly test the aggregator API with correct ERC-7930 format:

```bash
./scripts/test_aggregator.sh
```

This script will:
- Convert your deployed addresses to ERC-7930 hex format
- Check solver status
- Request a quote for 1 USDC from evolve → sepolia
- Display the results

## API Endpoints

### Health Check

```bash
curl http://localhost:4000/health
```

### List Solvers

```bash
curl -s http://localhost:4000/api/v1/solvers | jq
```

**Response:**
```json
{
  "solvers": [
    {
      "solver_id": "local-oif-solver",
      "adapter_id": "oif-v1",
      "status": "Active",
      "endpoint": "http://127.0.0.1:3000",
      "name": "Local OIF Solver"
    }
  ]
}
```

### Get Solver Details

```bash
curl http://localhost:4000/api/v1/solvers/local-oif-solver | jq
```

### Request Quotes

**How it works:** This queries **all enabled solvers** for quotes. Each solver returns their best offer.

**Important:** The aggregator uses **ERC-7930 InteropAddress format** (hex-encoded), not CAIP-19 text format.

#### Address Conversion Helper

A conversion script is provided at [`scripts/convert_address.py`](../scripts/convert_address.py):

```bash
# Usage
python3 scripts/convert_address.py "eip155:chainId:0xaddress"

# Example
python3 scripts/convert_address.py "eip155:1234:0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
# Output: 0x000100000204d214cf7ed3acca5a467e9e704c703e8d87f634fb0fc9
```

#### Get Addresses and Convert

```bash
# Get deployed token addresses
USDC_EVOLVE=$(cat .solver/state.json | jq -r '.chains."1234".tokens.USDC.address')
USDC_SEPOLIA=$(cat .solver/state.json | jq -r '.chains."11155111".tokens.USDC.address')
USER_ADDR=$(cast wallet address --private-key $USER_PK)

echo "Text format:"
echo "  USDC evolve:  eip155:1234:$USDC_EVOLVE"
echo "  USDC sepolia: eip155:11155111:$USDC_SEPOLIA"
echo "  User address: eip155:1234:$USER_ADDR"

# Convert to ERC-7930 hex format
USER_EVOLVE_HEX=$(python3 scripts/convert_address.py "eip155:1234:$USER_ADDR")
USDC_EVOLVE_HEX=$(python3 scripts/convert_address.py "eip155:1234:$USDC_EVOLVE")
USER_SEPOLIA_HEX=$(python3 scripts/convert_address.py "eip155:11155111:$USER_ADDR")
USDC_SEPOLIA_HEX=$(python3 scripts/convert_address.py "eip155:11155111:$USDC_SEPOLIA")

echo ""
echo "ERC-7930 hex format:"
echo "  USER_EVOLVE_HEX=$USER_EVOLVE_HEX"
echo "  USDC_EVOLVE_HEX=$USDC_EVOLVE_HEX"
echo "  USER_SEPOLIA_HEX=$USER_SEPOLIA_HEX"
echo "  USDC_SEPOLIA_HEX=$USDC_SEPOLIA_HEX"
```

#### Request Quote

Request quotes for 1 USDC from evolve → sepolia:

```bash
QUOTE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/quotes -H "Content-Type: application/json" -d "{\"user\":\"$USER_EVOLVE_HEX\",\"intent\":{\"intentType\":\"oif-swap\",\"inputs\":[{\"user\":\"$USER_EVOLVE_HEX\",\"asset\":\"$USDC_EVOLVE_HEX\",\"amount\":\"1000000\"}],\"outputs\":[{\"receiver\":\"$USER_SEPOLIA_HEX\",\"asset\":\"$USDC_SEPOLIA_HEX\"}],\"swapType\":\"exact-input\"},\"supportedTypes\":[\"oif-escrow-v0\"]}")

echo "$QUOTE_RESPONSE" | jq
```

**Response Example:**
```json
{
  "quotes": [
    {
      "quoteId": "550e8400-e29b-41d4-a716-446655440000",
      "order": {
        "type": "oif-escrow-v0",
        "payload": {
          "signatureType": "eip712",
          "domain": { ... },
          "primaryType": "Intent",
          "message": { ... },
          "types": { ... }
        }
      },
      "validUntil": 1708473600,
      "eta": 30,
      "provider": "local-oif-solver",
      "partialFill": false,
      "preview": {
        "inputs": [{
          "user": "0x000100000204d2148e220e86a7c0c2bca8fa457a571aa01eb324fc46",
          "asset": "0x000100000204d214cf7ed3acca5a467e9e704c703e8d87f634fb0fc9",
          "amount": "1000000"
        }],
        "outputs": [{
          "receiver": "0x0001000003aa36a7148e220e86a7c0c2bca8fa457a571aa01eb324fc46",
          "asset": "0x0001000003aa36a714227c22c05db33e5a88bf587e9febad36c6f92e2b",
          "amount": "1000000"
        }]
      }
    }
  ]
}
```

**Important:** Save the `quoteId` - you'll need it to submit the order to this specific solver.

### Submit Order

**How it works:** The order goes **only to the solver that provided the quote**. Orders require a valid EIP-712 signature from the user.

#### Step 1: Extract EIP-712 Payload

```bash
# Save the quote for signing
QUOTE=$(echo $QUOTE_RESPONSE | jq -c '.quotes[0]')

# Extract the EIP-712 payload from the quote
echo $QUOTE | jq '.order.payload' > /tmp/eip712_payload.json

# View what we're signing
echo "EIP-712 Payload to sign:"
cat /tmp/eip712_payload.json | jq
```

#### Step 2: Sign with EIP-712

The quote contains an EIP-712 typed data structure that needs to be signed with the user's private key:

```bash
# Sign the EIP-712 payload using cast
SIGNATURE=$(cast wallet sign-typed-data --private-key $USER_PK --data "$(cat /tmp/eip712_payload.json)")

echo "Signature: $SIGNATURE"
```

**What's being signed:** The EIP-712 payload is a `ReceiveWithAuthorization` message (ERC-3009 permit) that authorizes the InputSettlerEscrow contract to pull tokens from your address.

#### Step 3: Submit Order with Signature

```bash
# Submit the order with the signature
ORDER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/orders -H "Content-Type: application/json" -d "{\"quoteResponse\":$QUOTE,\"signature\":\"$SIGNATURE\"}")

echo "$ORDER_RESPONSE" | jq
```

**Response Example:**
```json
{
  "orderId": "0xa1b2c3d4e5f6...",
  "status": "accepted",
  "message": "Order accepted and forwarded to solver"
}
```

**What happens next:**
1. The aggregator routes the order to `local-oif-solver` (the solver that gave the quote)
2. Your solver fills the order on sepolia
3. Oracle operator attests the fill
4. Solver claims funds on evolve
5. Order status updates to `Finalized`

### Get Order Status

```bash
# Use the orderId from the submit response
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.orderId')

curl -s http://localhost:4000/api/v1/orders/$ORDER_ID | jq
```

**Response Example (Pending):**
```json
{
  "id": "0xa1b2c3d4e5f6...",
  "status": "pending",
  "createdAt": 1708473500,
  "updatedAt": 1708473500,
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "inputAmounts": [
    {
      "asset": "0x000100000204d214cf7ed3acca5a467e9e704c703e8d87f634fb0fc9",
      "amount": "1000000"
    }
  ],
  "outputAmounts": [
    {
      "asset": "0x0001000003aa36a714227c22c05db33e5a88bf587e9febad36c6f92e2b",
      "amount": "1000000"
    }
  ],
  "settlement": {
    "status": "pending"
  }
}
```

**Response Example (Finalized):**
```json
{
  "id": "0xa1b2c3d4e5f6...",
  "status": "finalized",
  "createdAt": 1708473500,
  "updatedAt": 1708473530,
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "inputAmounts": [...],
  "outputAmounts": [...],
  "settlement": {
    "status": "finalized",
    "fillTransaction": {
      "hash": "0x9f8e7d6c5b4a3210...",
      "chainId": 11155111
    },
    "claimTransaction": {
      "hash": "0x1234567890abcdef...",
      "chainId": 1234
    }
  }
}
```

**Check balances after:**
```bash
make balances
```

## Complete End-to-End Test

This section provides a complete script to test the full order flow through the aggregator's `/orders` endpoint.

### Prerequisites

1. All services running:
   ```bash
   # Terminal 1
   make aggregator

   # Terminal 2
   make solver

   # Terminal 3
   make operator
   ```

2. Wait 5-10 seconds after starting the aggregator for asset discovery to complete

3. Verify solver is available:
   ```bash
   curl -s http://localhost:4000/api/v1/solvers/local-oif-solver | jq '.supportedAssets'
   ```

### Complete Test Script

```bash
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
```

Save this as `scripts/test_orders_e2e.sh` and run:

```bash
chmod +x scripts/test_orders_e2e.sh
./scripts/test_orders_e2e.sh
```

### Expected Flow

1. **Quote**: Aggregator queries solver, receives quote with EIP-712 payload
2. **Sign**: User signs the EIP-712 typed data with their private key
3. **Submit**: Order sent to aggregator → forwarded to solver's `/orders` endpoint (port 5001 → port 5002)
4. **Fill**: Solver fills order on destination chain
5. **Attest**: Oracle operator signs attestation of fill
6. **Claim**: Solver claims escrowed funds on origin chain
7. **Finalize**: Order status updated to "finalized"

### Troubleshooting

**"No solvers available for quote aggregation"**
- Wait 5-10 seconds after starting aggregator for asset discovery
- Check solver status: `curl -s http://localhost:4000/api/v1/solvers/local-oif-solver | jq`
- Ensure solver API is responding: `curl -s http://localhost:5001/api/v1/tokens | jq`

**"Failed to extract sponsor: Empty signature provided"**
- Signature is required! Use `cast wallet sign-typed-data` to sign the EIP-712 payload
- Don't use `"signature":"0x"` - that will be rejected

**Quote succeeds but order fails with HTTP 400**
- Your environment variables may have stale addresses from a previous deployment
- Regenerate hex addresses from current `state.json` (see script above)

## Configuration

### Adding Multiple Solvers

Edit `config/config.json` to register multiple solvers:

```json
{
  "solvers": {
    "local-oif-solver": {
      "solver_id": "local-oif-solver",
      "adapter_id": "oif-v1",
      "endpoint": "http://127.0.0.1:3000",
      "enabled": true
    },
    "second-solver": {
      "solver_id": "second-solver",
      "adapter_id": "oif-v1",
      "endpoint": "http://127.0.0.1:3001",
      "enabled": true
    }
  }
}
```

The aggregator will automatically:
- Aggregate quotes from all enabled solvers
- Select the best quote based on output amount
- Monitor solver health with circuit breakers
- Discover supported assets from each solver

### Environment Setup

Add to your `.env` file:

```bash
# OIF Aggregator Configuration
# Secret key for integrity verification (min 32 chars)
# Generate with: openssl rand -hex 32
INTEGRITY_SECRET=your_secret_key_here_min_32_characters_required
```

## Asset Format

**Important:** The aggregator uses **ERC-7930 InteropAddress format** (hex-encoded binary), not CAIP-19 text format.

### ERC-7930 InteropAddress Structure

Binary format (encoded as hex string):
```
Version(2 bytes) | ChainType(2 bytes) | ChainRefLen(1 byte) | ChainRef(variable) | AddrLen(1 byte) | Address(20 bytes)
```

**Examples:**
- Chain 1234, address 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9:
  - Text: `eip155:1234:0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
  - Hex: `0x000100000204d214cf7ed3acca5a467e9e704c703e8d87f634fb0fc9`

- Chain 11155111, address 0x227c22c05Db33E5A88Bf587E9fEbAd36c6f92e2B:
  - Text: `eip155:11155111:0x227c22c05Db33E5A88Bf587E9fEbAd36c6f92e2B`
  - Hex: `0x0001000003aa36a714227c22c05db33e5a88bf587e9febad36c6f92e2b`

### Conversion Helper

Use the provided Python script to convert addresses:

```bash
python3 scripts/convert_address.py "eip155:1234:0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
# Output: 0x000100000204d214cf7ed3acca5a467e9e704c703e8d87f634fb0fc9
```

**Find your deployed token addresses:**
```bash
cat .solver/state.json | jq '.chains'
```

## Complete Workflow Example

Here's a complete end-to-end example using the aggregator:

```bash
# 1. Ensure conversion script exists
if [ ! -f scripts/convert_address.py ]; then
  echo "Error: scripts/convert_address.py not found. See 'Request Quotes' section to create it."
  exit 1
fi

# 2. Get token addresses from deployment
USDC_EVOLVE=$(cat .solver/state.json | jq -r '.chains."1234".tokens.USDC.address')
USDC_SEPOLIA=$(cat .solver/state.json | jq -r '.chains."11155111".tokens.USDC.address')
USER_ADDR=$(cast wallet address --private-key $USER_PK)

echo "Deployed addresses:"
echo "  USDC evolve:  $USDC_EVOLVE"
echo "  USDC sepolia: $USDC_SEPOLIA"
echo "  User:         $USER_ADDR"

# 3. Convert to ERC-7930 hex format
USER_EVOLVE_HEX=$(python3 scripts/convert_address.py "eip155:1234:$USER_ADDR")
USDC_EVOLVE_HEX=$(python3 scripts/convert_address.py "eip155:1234:$USDC_EVOLVE")
USER_SEPOLIA_HEX=$(python3 scripts/convert_address.py "eip155:11155111:$USER_ADDR")
USDC_SEPOLIA_HEX=$(python3 scripts/convert_address.py "eip155:11155111:$USDC_SEPOLIA")

echo ""
echo "Converted to ERC-7930:"
echo "  USER_EVOLVE_HEX:  $USER_EVOLVE_HEX"
echo "  USDC_EVOLVE_HEX:  $USDC_EVOLVE_HEX"
echo "  USER_SEPOLIA_HEX: $USER_SEPOLIA_HEX"
echo "  USDC_SEPOLIA_HEX: $USDC_SEPOLIA_HEX"

# 4. Request quotes
echo "Requesting quotes..."
QUOTE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/quotes -H "Content-Type: application/json" -d "{\"user\":\"$USER_EVOLVE_HEX\",\"intent\":{\"intentType\":\"oif-swap\",\"inputs\":[{\"user\":\"$USER_EVOLVE_HEX\",\"asset\":\"$USDC_EVOLVE_HEX\",\"amount\":\"1000000\"}],\"outputs\":[{\"receiver\":\"$USER_SEPOLIA_HEX\",\"asset\":\"$USDC_SEPOLIA_HEX\"}],\"swapType\":\"exact-input\"},\"supportedTypes\":[\"oif-escrow-v0\"]}")

echo "Quotes received:"
echo $QUOTE_RESPONSE | jq

# 5. Extract quoteId and order from first quote
QUOTE_ID=$(echo $QUOTE_RESPONSE | jq -r '.quotes[0].quoteId')
QUOTE_ORDER=$(echo $QUOTE_RESPONSE | jq '.quotes[0].order')
echo ""
echo "Selected quote ID: $QUOTE_ID"

# 6. Submit order
echo ""
echo "Submitting order..."
ORDER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/orders -H "Content-Type: application/json" -d "{\"quoteResponse\":$(echo $QUOTE_RESPONSE | jq -c '.quotes[0]'),\"signature\":\"0x\"}")

echo "Order submitted:"
echo $ORDER_RESPONSE | jq

# 7. Extract orderId
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.orderId')
echo ""
echo "Order ID: $ORDER_ID"

# 8. Poll for order status
echo ""
echo "Waiting for order to finalize..."
while true; do
  ORDER_STATUS_RESPONSE=$(curl -s http://localhost:4000/api/v1/orders/$ORDER_ID)
  STATUS=$(echo $ORDER_STATUS_RESPONSE | jq -r '.status')
  echo "Status: $STATUS"

  if [ "$STATUS" = "finalized" ] || [ "$STATUS" = "failed" ]; then
    echo ""
    echo "Final order details:"
    echo $ORDER_STATUS_RESPONSE | jq
    break
  fi

  sleep 5
done

# 9. Check final balances
echo ""
echo "Checking balances..."
make balances
```

## Advanced Configuration

### Circuit Breaker Settings

Edit `config/config.json`:

```json
{
  "circuit_breaker": {
    "enabled": true,
    "failure_threshold": 5,
    "success_rate_threshold": 0.3,
    "base_timeout_seconds": 30,
    "max_timeout_seconds": 600
  }
}
```

**Parameters:**
- `failure_threshold`: Open circuit after N consecutive failures
- `success_rate_threshold`: Open if success rate drops below this (0.3 = 30%)
- `base_timeout_seconds`: Initial cooldown when circuit opens
- `max_timeout_seconds`: Maximum cooldown duration

### Rate Limiting

```json
{
  "environment": {
    "rate_limiting": {
      "enabled": true,
      "requests_per_minute": 1000,
      "burst_size": 100
    }
  }
}
```

### Metrics Configuration

```json
{
  "metrics": {
    "retention_hours": 168,
    "cleanup_interval_hours": 24,
    "aggregation_interval_minutes": 5
  }
}
```
