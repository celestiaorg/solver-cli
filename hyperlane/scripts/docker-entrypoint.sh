#!/bin/bash
set -euo pipefail

# Anvil default deployer key (account[0])
export HYP_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export ANVIL1_RPC_URL=http://anvil1:8545
export ANVIL2_RPC_URL=http://anvil2:8546
export CELESTIA_RPC=http://celestia-validator:26657
# Hyperlane domain IDs (NOT the same as EVM chain IDs — avoids hardcoded "test4" for 31337)
export ANVIL1_DOMAIN=131337
export ANVIL2_DOMAIN=31338
export CELESTIA_DOMAIN=69420

CONFIG_FILE="hyperlane-cosmosnative.json"
ADDRESSES_FILE="hyperlane-addresses.json"

if [[ -f "$CONFIG_FILE" ]]; then
  echo "Skipping deployment: $CONFIG_FILE already exists."
  exit 0
fi

# ============================================================================
# Step 1: Deploy MockERC20 USDC on anvil1 (the native/collateral chain)
# ============================================================================
echo "Deploying MockERC20 USDC on anvil1..."

# Deploy using forge create (MockERC20 constructor: name, symbol, decimals)
echo "Running: forge create contracts/MockERC20.sol:MockERC20 --rpc-url $ANVIL1_RPC_URL ..."
MOCK_USDC_OUTPUT=$(forge create \
  contracts/MockERC20.sol:MockERC20 \
  --rpc-url $ANVIL1_RPC_URL \
  --private-key $HYP_KEY \
  --broadcast \
  --constructor-args "USDC" "USDC" 6 2>&1) || {
  echo "forge create failed:"
  echo "$MOCK_USDC_OUTPUT"
  exit 1
}

echo "$MOCK_USDC_OUTPUT"
MOCK_USDC_ADDR=$(echo "$MOCK_USDC_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
echo "MockERC20 USDC deployed on anvil1: $MOCK_USDC_ADDR"

# Mint initial supply to deployer (100M USDC = 100000000 * 10^6)
cast send $MOCK_USDC_ADDR \
  "mint(address,uint256)" \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  100000000000000 \
  --rpc-url $ANVIL1_RPC_URL \
  --private-key $HYP_KEY

echo "Minted 100M USDC to deployer on anvil1"

# ============================================================================
# Step 2: Deploy Hyperlane core contracts to both EVM chains
# ============================================================================
echo "Deploying Hyperlane core contracts to anvil1..."
hyperlane core deploy --chain anvil1 --registry ./registry --yes

echo "Deploying Hyperlane core contracts to anvil2..."
hyperlane core deploy --chain anvil2 --registry ./registry --yes

# Read EVM addresses from deployment artifacts
ANVIL1_MAILBOX=$(grep "^mailbox:" ./registry/chains/anvil1/addresses.yaml | awk '{print $NF}' | tr -d '"')
ANVIL1_MERKLE_HOOK=$(grep "^merkleTreeHook:" ./registry/chains/anvil1/addresses.yaml | awk '{print $NF}' | tr -d '"')
ANVIL1_VALIDATOR_ANNOUNCE=$(grep "^validatorAnnounce:" ./registry/chains/anvil1/addresses.yaml | awk '{print $NF}' | tr -d '"')

ANVIL2_MAILBOX=$(grep "^mailbox:" ./registry/chains/anvil2/addresses.yaml | awk '{print $NF}' | tr -d '"')
ANVIL2_MERKLE_HOOK=$(grep "^merkleTreeHook:" ./registry/chains/anvil2/addresses.yaml | awk '{print $NF}' | tr -d '"')
ANVIL2_VALIDATOR_ANNOUNCE=$(grep "^validatorAnnounce:" ./registry/chains/anvil2/addresses.yaml | awk '{print $NF}' | tr -d '"')

echo "Anvil1 Mailbox: $ANVIL1_MAILBOX"
echo "Anvil2 Mailbox: $ANVIL2_MAILBOX"

# ============================================================================
# Step 3: Deploy warp route on EVM chains (collateral on anvil1, synthetic on anvil2)
# ============================================================================
echo "Updating warp-config.yaml with MockERC20 address..."
sed -i '' "s|MOCK_USDC_ADDRESS_PLACEHOLDER|$MOCK_USDC_ADDR|" ./configs/warp-config.yaml

echo "Deploying Hyperlane warp route (collateral on anvil1, synthetic on anvil2)..."
hyperlane warp deploy --config ./configs/warp-config.yaml --registry ./registry --yes

# Read warp token addresses (parse by chainName, not line order — Hyperlane CLI order is not guaranteed)
WARP_CONFIG=./registry/deployments/warp_routes/USDC/warp-config-config.yaml
read ANVIL1_WARP_TOKEN ANVIL2_WARP_TOKEN <<< $(node -e "
  const y = require('fs').readFileSync('$WARP_CONFIG','utf8');
  // Split into token blocks on '- ' list items
  const blocks = y.split(/^\s*-\s/m).filter(Boolean);
  const addrs = {};
  for (const b of blocks) {
    const chain = (b.match(/chainName:\s*['\"]?(\w+)/) || [])[1];
    const addr = (b.match(/addressOrDenom:\s*['\"]?(0x[0-9a-fA-F]+)/) || [])[1];
    if (chain && addr) addrs[chain] = addr;
  }
  console.log((addrs.anvil1 || '') + ' ' + (addrs.anvil2 || ''));
")

echo "Anvil1 warp token (HypCollateral): $ANVIL1_WARP_TOKEN"
echo "Anvil2 warp token (HypSynthetic): $ANVIL2_WARP_TOKEN"

# ============================================================================
# Step 4: Deploy cosmosnative Hyperlane on Celestia with SYNTHETIC token
# ============================================================================
echo "Deploying Hyperlane cosmosnative stack with synthetic token on Celestia..."
hyp deploy-syntheticism $CELESTIA_RPC

# Read Celestia addresses from deployment output
CEL_MAILBOX=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')); console.log(c.mailbox_id)")
CEL_MERKLE_HOOK=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')); console.log(c.required_hook_id)")
CEL_ISM=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')); console.log(c.ism_id)")
CEL_DEFAULT_HOOK=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')); console.log(c.default_hook_id)")
CEL_TOKEN=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')); console.log(c.synthetic_token_id)")

echo "Celestia Mailbox: $CEL_MAILBOX"
echo "Celestia Token (synthetic): $CEL_TOKEN"

# ============================================================================
# Step 5: Enroll remote routers between all 3 chains
# ============================================================================

# Anvil1 warp token <-> Celestia synthetic token
echo "Enrolling remote router: anvil1 -> celestia..."
cast send $ANVIL1_WARP_TOKEN \
  "enrollRemoteRouter(uint32,bytes32)" \
  $CELESTIA_DOMAIN $CEL_TOKEN \
  --private-key $HYP_KEY \
  --rpc-url $ANVIL1_RPC_URL

echo "Enrolling remote router: celestia -> anvil1..."
ANVIL1_WARP_LOWERCASE=$(echo $ANVIL1_WARP_TOKEN | tr '[:upper:]' '[:lower:]' | cut -c 3-)
hyp enroll-remote-router $CELESTIA_RPC $CEL_TOKEN $ANVIL1_DOMAIN 0x000000000000000000000000$ANVIL1_WARP_LOWERCASE

# Anvil2 warp token <-> Celestia synthetic token
echo "Enrolling remote router: anvil2 -> celestia..."
cast send $ANVIL2_WARP_TOKEN \
  "enrollRemoteRouter(uint32,bytes32)" \
  $CELESTIA_DOMAIN $CEL_TOKEN \
  --private-key $HYP_KEY \
  --rpc-url $ANVIL2_RPC_URL

echo "Enrolling remote router: celestia -> anvil2..."
ANVIL2_WARP_LOWERCASE=$(echo $ANVIL2_WARP_TOKEN | tr '[:upper:]' '[:lower:]' | cut -c 3-)
hyp enroll-remote-router $CELESTIA_RPC $CEL_TOKEN $ANVIL2_DOMAIN 0x000000000000000000000000$ANVIL2_WARP_LOWERCASE

# ============================================================================
# Step 6: Update relayer-config.json with actual deployed addresses
# ============================================================================
echo "Updating relayer-config.json with deployed addresses..."
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('relayer-config.json', 'utf8'));

// Update anvil1 addresses
config.chains.anvil1.mailbox = '$ANVIL1_MAILBOX';
config.chains.anvil1.merkleTreeHook = '$ANVIL1_MERKLE_HOOK';
config.chains.anvil1.validatorAnnounce = '$ANVIL1_VALIDATOR_ANNOUNCE';
config.chains.anvil1.interchainGasPaymaster = '$ANVIL1_MERKLE_HOOK';

// Update anvil2 addresses
config.chains.anvil2.mailbox = '$ANVIL2_MAILBOX';
config.chains.anvil2.merkleTreeHook = '$ANVIL2_MERKLE_HOOK';
config.chains.anvil2.validatorAnnounce = '$ANVIL2_VALIDATOR_ANNOUNCE';
config.chains.anvil2.interchainGasPaymaster = '$ANVIL2_MERKLE_HOOK';

// Update celestiadev addresses
config.chains.celestiadev.mailbox = '$CEL_MAILBOX';
config.chains.celestiadev.merkleTreeHook = '$CEL_MERKLE_HOOK';
config.chains.celestiadev.interchainSecurityModule = '$CEL_ISM';
config.chains.celestiadev.interchainGasPaymaster = '$CEL_DEFAULT_HOOK';
config.chains.celestiadev.validatorAnnounce = '$CEL_MAILBOX';

fs.writeFileSync('relayer-config.json', JSON.stringify(config, null, 4) + '\n');
console.log('relayer-config.json updated successfully');
"

# ============================================================================
# Step 7: Write deployed addresses to shared file for solver-cli
# ============================================================================
echo "Writing deployed addresses to $ADDRESSES_FILE..."
node -e "
const fs = require('fs');
const addresses = {
  anvil1: {
    chain_id: 31337,
    domain_id: $ANVIL1_DOMAIN,
    mock_usdc: '$MOCK_USDC_ADDR',
    warp_token: '$ANVIL1_WARP_TOKEN',
    warp_token_type: 'collateral',
    mailbox: '$ANVIL1_MAILBOX',
    merkle_tree_hook: '$ANVIL1_MERKLE_HOOK',
    validator_announce: '$ANVIL1_VALIDATOR_ANNOUNCE'
  },
  anvil2: {
    chain_id: 31338,
    domain_id: $ANVIL2_DOMAIN,
    warp_token: '$ANVIL2_WARP_TOKEN',
    warp_token_type: 'synthetic',
    mailbox: '$ANVIL2_MAILBOX',
    merkle_tree_hook: '$ANVIL2_MERKLE_HOOK',
    validator_announce: '$ANVIL2_VALIDATOR_ANNOUNCE'
  },
  celestiadev: {
    domain_id: $CELESTIA_DOMAIN,
    synthetic_token: '$CEL_TOKEN',
    mailbox: '$CEL_MAILBOX',
    merkle_tree_hook: '$CEL_MERKLE_HOOK',
    ism: '$CEL_ISM',
    default_hook: '$CEL_DEFAULT_HOOK'
  }
};
fs.writeFileSync('$ADDRESSES_FILE', JSON.stringify(addresses, null, 2) + '\n');
console.log('Addresses written to $ADDRESSES_FILE');
"

echo ""
echo "=============================="
echo "  Hyperlane Deployment Complete"
echo "=============================="
echo "  Anvil1 (31337, domain $ANVIL1_DOMAIN):"
echo "    MockERC20 USDC: $MOCK_USDC_ADDR"
echo "    HypCollateral:  $ANVIL1_WARP_TOKEN"
echo "    Mailbox:        $ANVIL1_MAILBOX"
echo ""
echo "  Anvil2 (31338, domain $ANVIL2_DOMAIN):"
echo "    HypSynthetic:   $ANVIL2_WARP_TOKEN"
echo "    Mailbox:        $ANVIL2_MAILBOX"
echo ""
echo "  Celestia (69420):"
echo "    Synthetic:      $CEL_TOKEN"
echo "    Mailbox:        $CEL_MAILBOX"
echo "=============================="
