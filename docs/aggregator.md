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

## API Endpoints

### Health Check

```bash
curl http://localhost:4000/health
```

### List Solvers

```bash
curl http://localhost:4000/api/v1/solvers | jq
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

First, get your deployed token addresses:
```bash
# Get USDC address on evolve (chain 1234)
USDC_EVOLVE=$(cat .solver/state.json | jq -r '.chains."1234".tokens.USDC.address')

# Get USDC address on sepolia (chain 11155111)
USDC_SEPOLIA=$(cat .solver/state.json | jq -r '.chains."11155111".tokens.USDC.address')

# Get user address
USER_ADDR=$(cast wallet address --private-key $USER_PK)

echo "USDC on evolve: $USDC_EVOLVE"
echo "USDC on sepolia: $USDC_SEPOLIA"
echo "User address: $USER_ADDR"
```

Request quotes for 1 USDC from evolve → sepolia:
```bash
curl -X POST http://localhost:4000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"input\": {
      \"asset\": \"eip155:1234/erc20:$USDC_EVOLVE\",
      \"amount\": \"1000000\"
    },
    \"output\": {
      \"asset\": \"eip155:11155111/erc20:$USDC_SEPOLIA\",
      \"recipient\": \"$USER_ADDR\"
    }
  }" | jq
```

**Response Example:**
```json
{
  "quotes": [
    {
      "quote_id": "0x1a2b3c4d5e6f...",
      "solver_id": "local-oif-solver",
      "input": {
        "asset": "eip155:1234/erc20:0x5fbdb2315678afecb367f032d93f642f64180aa3",
        "amount": "1000000"
      },
      "output": {
        "asset": "eip155:11155111/erc20:0x5fbdb2315678afecb367f032d93f642f64180aa3",
        "amount": "1000000",
        "recipient": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
      },
      "deadline": 1708473600,
      "integrity_hash": "0x7f8e9d..."
    }
  ],
  "metadata": {
    "quote_count": 1,
    "best_quote_id": "0x1a2b3c4d5e6f...",
    "total_solvers_queried": 1
  }
}
```

**Important:** Save the `quote_id` - you'll need it to submit the order to this specific solver.

### Submit Order

**How it works:** The order goes **only to the solver that provided the quote**. Use the `quote_id` from the previous step.

```bash
# Get the quote_id from previous response
QUOTE_ID="0x1a2b3c4d5e6f..."

# Sign the quote (this would normally be done by your wallet)
# For testing, the aggregator may accept unsigned orders
curl -X POST http://localhost:4000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"quote_id\": \"$QUOTE_ID\"
  }" | jq
```

**Response Example:**
```json
{
  "order_id": "0xa1b2c3d4e5f6...",
  "status": "Pending",
  "quote_id": "0x1a2b3c4d5e6f...",
  "solver_id": "local-oif-solver",
  "created_at": 1708473500
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
# Use the order_id from the submit response
ORDER_ID="0xa1b2c3d4e5f6..."

curl http://localhost:4000/api/v1/orders/$ORDER_ID | jq
```

**Response Example (Pending):**
```json
{
  "order_id": "0xa1b2c3d4e5f6...",
  "status": "Pending",
  "solver_id": "local-oif-solver",
  "quote_id": "0x1a2b3c4d5e6f...",
  "created_at": 1708473500,
  "updated_at": 1708473500
}
```

**Response Example (Finalized):**
```json
{
  "order_id": "0xa1b2c3d4e5f6...",
  "status": "Finalized",
  "solver_id": "local-oif-solver",
  "quote_id": "0x1a2b3c4d5e6f...",
  "fill_hash": "0x9f8e7d6c5b4a3210...",
  "claim_hash": "0x1234567890abcdef...",
  "created_at": 1708473500,
  "updated_at": 1708473530,
  "finalized_at": 1708473530
}
```

**Check balances after:**
```bash
make balances
```

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

Assets use the CAIP-19 format: `eip155:{chainId}/{namespace}:{address}`

**Examples:**
- `eip155:1234/erc20:0x5FbDB2315678afecb367f032d93F642f64180aa3` - USDC on local chain (1234)
- `eip155:11155111/erc20:0x5FbDB2315678afecb367f032d93F642f64180aa3` - USDC on Sepolia

**Find your deployed token addresses:**
```bash
cat .solver/state.json | jq '.chains'
```

## Complete Workflow Example

Here's a complete end-to-end example using the aggregator:

```bash
# 1. Get token addresses
USDC_EVOLVE=$(cat .solver/state.json | jq -r '.chains."1234".tokens.USDC.address')
USDC_SEPOLIA=$(cat .solver/state.json | jq -r '.chains."11155111".tokens.USDC.address')
USER_ADDR=$(cast wallet address --private-key $USER_PK)

# 2. Request quotes
QUOTE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"input\": {
      \"asset\": \"eip155:1234/erc20:$USDC_EVOLVE\",
      \"amount\": \"1000000\"
    },
    \"output\": {
      \"asset\": \"eip155:11155111/erc20:$USDC_SEPOLIA\",
      \"recipient\": \"$USER_ADDR\"
    }
  }")

echo "Quotes received:"
echo $QUOTE_RESPONSE | jq

# 3. Extract quote_id from best quote
QUOTE_ID=$(echo $QUOTE_RESPONSE | jq -r '.metadata.best_quote_id')
echo "Best quote ID: $QUOTE_ID"

# 4. Submit order
ORDER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d "{\"quote_id\": \"$QUOTE_ID\"}")

echo "Order submitted:"
echo $ORDER_RESPONSE | jq

# 5. Extract order_id
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.order_id')
echo "Order ID: $ORDER_ID"

# 6. Poll for order status
echo "Waiting for order to finalize..."
while true; do
  STATUS=$(curl -s http://localhost:4000/api/v1/orders/$ORDER_ID | jq -r '.status')
  echo "Status: $STATUS"

  if [ "$STATUS" = "Finalized" ] || [ "$STATUS" = "Failed" ]; then
    break
  fi

  sleep 5
done

# 7. Check final balances
make balances
```

## Architecture

### How Orders Are Routed

```
User
  │
  │ 1. Request quotes
  ▼
Aggregator (port 4000)
  │
  │ 2. Query all enabled solvers
  ├──────┬──────┬──────┐
  │      │      │      │
  ▼      ▼      ▼      ▼
Solver1 Solver2 Solver3 Solver4
  │      │      │      │
  └──────┴──────┴──────┘
  │
  │ 3. All solvers respond with quotes
  ▼
Aggregator
  │
  │ 4. User selects a quote
  ▼
Aggregator
  │
  │ 5. Routes order ONLY to the solver that provided the quote
  ▼
Selected Solver
  │
  │ 6. Fills order on destination chain
  ▼
Chain B
```

### Benefits

**Price Competition:**
- Multiple solvers compete for orders
- Users get best available prices
- Market-driven solver selection

**Reliability:**
- Circuit breakers automatically disable failing solvers
- Health checks every 5 minutes
- Orders only route to healthy solvers

**Transparency:**
- Each order tracked with specific solver
- Full order history with fill/claim hashes
- Real-time status updates

## Troubleshooting

### Aggregator won't start

**Error: Configuration validation failed**
```bash
# Check INTEGRITY_SECRET is set
grep INTEGRITY_SECRET .env

# If missing, add it:
echo "INTEGRITY_SECRET=$(openssl rand -hex 32)" >> .env
```

**Error: Port 4000 already in use**
```bash
# Find what's using the port
lsof -i :4000

# Stop the aggregator if it's already running
pkill -f oif-aggregator
```

### Solver not appearing in aggregator

1. **Check solver is running:**
   ```bash
   curl http://localhost:3000/tokens
   ```

2. **Check aggregator config:**
   ```bash
   cat config/config.json | jq '.solvers'
   ```

3. **Check aggregator logs:**
   Look for health check failures or connection errors.

### Quotes request returns empty

1. **Check solver status:**
   ```bash
   curl http://localhost:4000/api/v1/solvers | jq
   ```

   Look for `"status": "Active"`. If solver is in another state, check:
   - Solver is running and healthy
   - Solver has supported assets for the requested route
   - Circuit breaker hasn't opened due to failures

2. **Check asset addresses are correct:**
   ```bash
   cat .solver/state.json | jq '.chains'
   ```

### Order stuck in Pending

1. **Check solver logs** for fill errors
2. **Check oracle operator is running** and attesting fills
3. **Check solver has funds** on destination chain:
   ```bash
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
