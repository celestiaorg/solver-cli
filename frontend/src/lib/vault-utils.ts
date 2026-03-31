import {
  Address,
  createPublicClient,
  formatUnits,
  http,
  PublicClient,
} from 'viem';

import { edenBlockscoutApiUrl, edenRpcUrl } from '@/lib/constants/eden-network';
import {
  IMetaMorpho_ABI,
  IRM_ABI,
  METAMORPHO_ABI,
  MORPHO_BLUE_ABI,
  MORPHO_BLUE_ADDRESS,
} from '@/lib/constants/vault-abi';

interface BlockExplorerAddressData {
  block_number_balance_updated_at: number;
  coin_balance: string;
  creation_status: string | null;
  creation_transaction_hash: string | null;
  creator_address_hash: string | null;
  ens_domain_name: string | null;
  exchange_rate: string;
  has_beacon_chain_withdrawals: boolean;
  has_logs: boolean;
  has_token_transfers: boolean;
  has_tokens: boolean;
  has_validated_blocks: boolean;
  hash: string;
  implementations: unknown[];
  is_contract: boolean;
  is_scam: boolean;
  is_verified: boolean;
  metadata: unknown | null;
  name: string | null;
  private_tags: unknown[];
  proxy_type: string | null;
  public_tags: unknown[];
  token: unknown | null;
  watchlist_address_id: number | null;
  watchlist_names: unknown[];
}

interface NFTMetadataAttribute {
  value: string;
  trait_type: string;
}

interface NFTMetadata {
  year?: number;
  tags?: string[];
  name?: string;
  image_url?: string;
  home_url?: string;
  external_url?: string;
  description?: string;
  attributes?: NFTMetadataAttribute[];
}

interface AddressTag {
  address_hash: string;
  display_name: string;
  label: string;
}

interface WatchlistName {
  display_name: string;
  label: string;
}

interface OwnerMetadata {
  slug: string;
  name: string;
  tagType: string;
  ordinal: number;
  meta: Record<string, unknown>;
}

interface TokenOwner {
  hash: string;
  implementation_name?: string;
  name?: string;
  ens_domain_name?: string;
  metadata?: OwnerMetadata;
  is_contract: boolean;
  private_tags?: AddressTag[];
  watchlist_names?: WatchlistName[];
  public_tags?: AddressTag[];
  is_verified: boolean;
  reputation: string;
}

interface TokenInfo {
  circulating_market_cap?: string;
  icon_url?: string;
  name: string;
  decimals: string;
  symbol: string;
  address_hash: string;
  type: string;
  holders_count: string | number;
  exchange_rate?: string;
  total_supply: string;
  reputation?: string;
}

interface TokenInstance {
  is_unique: boolean;
  id: string;
  holder_address_hash: string;
  image_url?: string;
  animation_url?: string;
  external_app_url?: string;
  metadata?: NFTMetadata;
  owner?: TokenOwner;
  token: TokenInfo;
}

interface BlockExplorerTokenBalance {
  token_instance?: TokenInstance;
  value: string;
  token_id?: string;
  token: TokenInfo;
}

type BlockExplorerBalancesData = BlockExplorerTokenBalance[];

export interface TokenData {
  address_hash: string;
  circulating_market_cap: string | null;
  decimals: string;
  exchange_rate: string | null;
  holders_count: string;
  icon_url: string | null;
  name: string;
  symbol: string;
  total_supply: string;
  type: string;
  volume_24h: string | null;
}

export interface VaultConfiguration {
  // Basic Info
  address: Address;
  name?: string;
  symbol?: string;
  decimals?: number;

  // Asset Info
  asset?: {
    address: Address;
    name: string;
    symbol: string;
    decimals: number;
  };

  // Financial Info
  totalAssets: bigint;
  totalSupply: bigint;
  performanceFee: number; // As percentage

  // Governance & Roles
  owner?: Address | null;
  feeRecipient?: Address | null;
  curator?: Address | null;

  // Queue Lengths
  supplyQueueLength: number;
  withdrawQueueLength: number;
}
type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

type MarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

const rpc = edenRpcUrl;
const Zero = BigInt(0);

const WAD = BigInt(10) ** BigInt(18);
const SECONDS_PER_YEAR = BigInt(31536000);
const VIRTUAL_ASSETS = BigInt(1); // To avoid division by zero
const VIRTUAL_SHARES = BigInt(10) ** BigInt(6); // To avoid division by zero

const wMulDown = (x: bigint, y: bigint): bigint => (x * y) / WAD;
const wDivUp = (x: bigint, y: bigint): bigint => (x * WAD + y - BigInt(1)) / y;

const wTaylorCompounded = (x: bigint, n: bigint): bigint => {
  const firstTerm = x * n;
  const secondTerm = (firstTerm * firstTerm) / (BigInt(2) * WAD);
  const thirdTerm = (secondTerm * firstTerm) / (BigInt(3) * WAD);
  return firstTerm + secondTerm + thirdTerm;
};

function handleZeroAddress(address: Address): Address | null {
  return address === '0x0000000000000000000000000000000000000000'
    ? null
    : address;
}

const toAssetsDown = (
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint => {
  if (totalShares === Zero) return shares;
  return (
    (shares * (totalAssets + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES)
  );
};

function accrueInterests(
  marketState: MarketState,
  borrowRate: bigint,
  blockTimestamp: bigint
): MarketState {
  const elapsed = blockTimestamp - marketState.lastUpdate;
  if (elapsed === Zero || marketState.totalBorrowAssets === Zero)
    return marketState;
  const interest = wMulDown(
    marketState.totalBorrowAssets,
    wTaylorCompounded(borrowRate, elapsed)
  );
  return {
    ...marketState,
    totalSupplyAssets: marketState.totalSupplyAssets + interest,
    totalBorrowAssets: marketState.totalBorrowAssets + interest,
  };
}

async function getMarketStateAndApy(
  client: PublicClient,
  marketId: `0x${string}`,
  blockTimestamp: bigint
): Promise<{ state: MarketState; apy: bigint; params: MarketParams }> {
  const marketStateResult = await client.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    functionName: 'market',
    args: [marketId],
  });
  const marketParamsResult = await client.readContract({
    address: MORPHO_BLUE_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    functionName: 'idToMarketParams',
    args: [marketId],
  });

  const staleMarketState: MarketState = {
    totalSupplyAssets: marketStateResult[0],
    totalSupplyShares: marketStateResult[1],
    totalBorrowAssets: marketStateResult[2],
    totalBorrowShares: marketStateResult[3],
    lastUpdate: marketStateResult[4],
    fee: marketStateResult[5],
  };

  const params: MarketParams = {
    loanToken: marketParamsResult[0],
    collateralToken: marketParamsResult[1],
    oracle: marketParamsResult[2],
    irm: marketParamsResult[3],
    lltv: marketParamsResult[4],
  };

  // If the IRM address is zero, the market has no interest model, so APY is 0.
  if (params.irm === '0x0000000000000000000000000000000000000000') {
    return { state: staleMarketState, apy: Zero, params };
  }

  const borrowRate = (await client.readContract({
    address: params.irm,
    abi: IRM_ABI,
    functionName: 'borrowRateView',
    args: [params, staleMarketState],
  })) as bigint;

  const state = accrueInterests(staleMarketState, borrowRate, blockTimestamp);
  const borrowApy = wTaylorCompounded(borrowRate, SECONDS_PER_YEAR);
  const utilization =
    state.totalSupplyAssets > Zero
      ? wDivUp(state.totalBorrowAssets, state.totalSupplyAssets)
      : Zero;
  const apy = wMulDown(wMulDown(borrowApy, utilization), WAD - state.fee);

  return { state, apy, params };
}

export async function getVaultConfiguration(
  client: PublicClient,
  vaultAddress: Address
): Promise<VaultConfiguration> {
  console.log(`Fetching configuration for vault: ${vaultAddress}...`);

  // Individual contract calls to get basic vault information
  /*   const name = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'name',
  });

  const symbol = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'symbol',
  });

  const decimals = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'decimals',
  }); */

  /*   const assetAddress = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'asset',
  }); */

  const totalAssets = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'totalAssets',
  });

  const totalSupply = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'totalSupply',
  });

  /*   const owner = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'owner',
  });

  const curator = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'curator',
  });
 */
  /*  const feeRecipient = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'feeRecipient',
  }); */

  const fee = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'fee',
  });

  const supplyQueueLength = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'supplyQueueLength',
  });

  const withdrawQueueLength = await client.readContract({
    address: vaultAddress,
    abi: METAMORPHO_ABI,
    functionName: 'withdrawQueueLength',
  });

  /*   const assetName = await client.readContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: 'name',
  });

  const assetSymbol = await client.readContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
  });

  const assetDecimals = await client.readContract({
    address: assetAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  }); */

  // Calculate performance fee as percentage
  const performanceFee = Number(formatUnits(fee, 18)) * 100;

  return {
    address: vaultAddress,
    /*   name,
    symbol,
    decimals,
    asset: {
      address: assetAddress,
      name: assetName,
      symbol: assetSymbol,
      decimals: assetDecimals,
    }, */
    totalAssets,
    totalSupply,
    performanceFee,
    /* owner: handleZeroAddress(owner),
    curator: handleZeroAddress(curator), */
    supplyQueueLength: Number(supplyQueueLength),
    withdrawQueueLength: Number(withdrawQueueLength),
  };
}

export async function getVaultData(vaultAddress: `0x${string}`) {
  try {
    const client = createPublicClient({
      transport: http(rpc, { timeout: 3_000, retryCount: 0 }),
    });
    const vaultConfiguration = await getVaultConfiguration(
      client,
      vaultAddress
    );
    return vaultConfiguration;
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error';

    throw new Error(message);
  }
}

export async function getVaultAPY(
  vaultAddress: `0x${string}`,
  withdrawQueueLength: number
) {
  try {
    const client = createPublicClient({
      transport: http(rpc, { timeout: 3_000, retryCount: 0 }),
    });

    const calls = Array.from(
      { length: Number(withdrawQueueLength) },
      (_, i) => ({
        address: vaultAddress,
        abi: METAMORPHO_ABI,
        functionName: 'withdrawQueue' as const,
        args: [BigInt(i)] as const,
      })
    );
    const marketIds: `0x${string}`[] = [];
    for (const call of calls) {
      const result = await client.readContract(call);
      marketIds.push(result as `0x${string}`);
    }

    const block = await client.getBlock({ blockTag: 'latest' });

    const marketDataPromises = marketIds.map(async marketId => {
      const [{ state, apy, params }, { 0: supplyShares }] = await Promise.all([
        getMarketStateAndApy(client, marketId, block.timestamp),
        client.readContract({
          address: MORPHO_BLUE_ADDRESS,
          abi: MORPHO_BLUE_ABI,
          functionName: 'position',
          args: [marketId, vaultAddress],
        }),
      ]);
      const allocation = toAssetsDown(
        supplyShares as bigint,
        state.totalSupplyAssets,
        state.totalSupplyShares
      );
      return { supplyApy: apy, allocation, params, marketId, supplyShares };
    });

    const marketData = await Promise.all(marketDataPromises);

    let totalWeightedApy = Zero;
    let totalAllocation = Zero;

    const collateralTokens = new Set<Address>();

    marketData.forEach(({ supplyApy, allocation, params }) => {
      collateralTokens.add(params.collateralToken);
      if (allocation > Zero) {
        totalWeightedApy += supplyApy * allocation;
        totalAllocation += allocation;
      }
    });
    let apy = Zero;
    if (totalAllocation !== Zero) {
      apy = totalWeightedApy / totalAllocation;
    }

    return {
      apy: Number(formatUnits(apy, 16)).toFixed(2) + '%',
      collateralTokens,
      marketData,
      totalAllocation,
    };
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error';
    console.log({ message });
    return undefined;
  }
}

export async function isUserVault(
  vaultAddresses: `0x${string}`[],
  userAddress: `0x${string}`
): Promise<`0x${string}`[]> {
  try {
    const client = createPublicClient({
      transport: http(rpc, { timeout: 3_000, retryCount: 0 }),
    });

    // Check all vaults in parallel
    const checks = await Promise.all(
      vaultAddresses.map(async vaultAddress => {
        try {
          const balance = await client.readContract({
            address: vaultAddress,
            abi: IMetaMorpho_ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          });
          return { vaultAddress, isAllocator: balance > BigInt(0) };
        } catch {
          return { vaultAddress, isAllocator: false };
        }
      })
    );

    // Filter and return only vaults where user is allocator
    return checks
      .filter(result => result.isAllocator)
      .map(result => result.vaultAddress);
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error';
    console.error('Error checking user vaults:', message);
    return [];
  }
}

export async function getNativeTokenBalance(
  address: `0x${string}`
): Promise<{ balance: string; exchangeRate: string } | undefined> {
  try {
    const res = await fetch(`${edenBlockscoutApiUrl}/addresses/${address}`);
    const data = (await res.json()) as BlockExplorerAddressData;
    return {
      balance: data.coin_balance,
      exchangeRate: data.exchange_rate,
    };
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error';
    return undefined;
  }
}

export async function getBalances(
  address: `0x${string}`
): Promise<BlockExplorerBalancesData | undefined> {
  try {
    const res = await fetch(
      `${edenBlockscoutApiUrl}/addresses/${address}/token-balances`
    );
    const data = (await res.json()) as BlockExplorerBalancesData;
    return data.filter(
      token =>
        token.token.address_hash !==
        '0xb1F7Bf7E4765CAcc93Fe32A48754314F8B66152e'
    );
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error';
    return undefined;
  }
}

export async function getTokens() {
  try {
    const res = await fetch(
      `${edenBlockscoutApiUrl}/tokens?type=ERC-20%2CERC-721%2CERC-1155`
    );
    const data = (await res.json()) as { items: TokenData[] };
    return data.items.reduce(
      (acc, curr) => {
        acc[curr.address_hash] = curr;
        return acc;
      },
      {} as Record<string, TokenData>
    );
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error';

    return undefined;
  }
}

// Transaction Types
interface TransactionFee {
  type: 'maximum' | 'actual';
  value: string;
}

interface TransactionAddress {
  hash: string;
  implementation_name?: string;
  name?: string;
  ens_domain_name?: string;
  metadata?: OwnerMetadata;
  is_contract: boolean;
  private_tags?: AddressTag[];
  watchlist_names?: WatchlistName[];
  public_tags?: AddressTag[];
  is_verified: boolean;
  reputation?: string;
}

interface TokenTotal {
  decimals: string;
  value: string;
}

interface TokenTransfer {
  token_type: string;
  block_hash: string;
  from: TransactionAddress;
  log_index: number;
  method: string;
  timestamp: string;
  to: TransactionAddress;
  token: TokenInfo;
  total: TokenTotal;
  transaction_hash: string;
  type: string;
}

interface LiquidationCallData {
  debt_amount: string;
  debt_symbol: string;
  debt_address: string;
  collateral_amount: string;
  collateral_symbol: string;
  collateral_address: string;
  block_number: number;
}

interface AmountActionData {
  amount: string;
  symbol: string;
  address: string;
  block_number: number;
}

interface CollateralActionData {
  symbol: string;
  address: string;
  block_number: number;
}

interface NFTActionData {
  name: string;
  symbol: string;
  address: string;
  to: string;
  ids: string[];
  block_number: number;
}

interface SwapActionData {
  address0: string;
  address1: string;
  amount0: string;
  amount1: string;
  symbol0: string;
  symbol1: string;
}

type TransactionActionData =
  | LiquidationCallData
  | AmountActionData
  | CollateralActionData
  | NFTActionData
  | SwapActionData;

interface TransactionAction {
  data: TransactionActionData;
  protocol: string;
  type:
    | 'liquidation_call'
    | 'borrow'
    | 'supply'
    | 'withdraw'
    | 'repay'
    | 'flash_loan'
    | 'enable_collateral'
    | 'disable_collateral'
    | 'mint_nft'
    | 'burn'
    | 'collect'
    | 'swap';
}

interface DecodedInputParameter {
  name: string;
  type: string;
  value: string;
}

interface DecodedInput {
  method_call: string;
  method_id: string;
  parameters: DecodedInputParameter[];
}

export interface Transaction {
  timestamp: string;
  fee: TransactionFee;
  gas_limit: number;
  block_number: number;
  status: 'ok' | 'error';
  method: string;
  confirmations: number;
  type: number;
  exchange_rate: string;
  to: TransactionAddress;
  transaction_burnt_fee: string;
  max_fee_per_gas: string;
  result: string;
  hash: string;
  gas_price: string;
  priority_fee: string;
  base_fee_per_gas: string;
  from: TransactionAddress;
  token_transfers: TokenTransfer[];
  transaction_types: (
    | 'token_transfer'
    | 'contract_creation'
    | 'contract_call'
    | 'token_creation'
    | 'coin_transfer'
  )[];
  gas_used: string;
  created_contract?: TransactionAddress;
  position: number;
  nonce: number;
  has_error_in_internal_transactions: boolean;
  actions: TransactionAction[];
  decoded_input: DecodedInput;
  token_transfers_overflow: boolean;
  raw_input: string;
  value: string;
  max_priority_fee_per_gas: string;
  revert_reason: string;
  confirmation_duration: [number, number];
  transaction_tag?: string;
  is_pending_update: boolean;
}

export interface TransactionsResponse {
  items: Transaction[];
  next_page_params: {
    block_number: number;
    index: number;
    items_count: number;
  };
}

export async function getUserTransactions(
  filter: 'from' | 'to',
  address: `0x${string}`
): Promise<TransactionsResponse | undefined> {
  try {
    const res = await fetch(
      `${edenBlockscoutApiUrl}/addresses/${address}/transactions?filter=${filter}`
    );
    const data = (await res.json()) as TransactionsResponse;
    return data;
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Unexpected error';

    return undefined;
  }
}
