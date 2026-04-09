import { Abi, Address, parseAbi, parseAbiItem } from 'viem';

// MetaMorpho Factory contract address
export const METAMORPHO_FACTORY_ADDRESS =
  '0xb007ca4AD41874640F9458bF3B5e427c31Be7766'; //0xe3F8380851ee3A0BBcedDD0bCDe92d423812C1Cd

// Block range to search for vault creations
export const START_BLOCK = BigInt(183434);
export const END_BLOCK = BigInt(193433);

// CreateMetaMorpho event ABI
export const CREATE_METAMORPHO_EVENT = parseAbiItem(
  'event CreateMetaMorpho(address indexed metaMorpho, address indexed caller, address initialOwner, uint256 initialTimelock, address indexed asset, string name, string symbol, bytes32 salt)'
);

// Minimal ABI for an ERC-4626 compliant vault to get total assets, supply, and the underlying asset.
export const MINIMAL_VAULT_ABI = parseAbi([
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function asset() external view returns (address)',
]);

// Minimal ABI for an ERC-20 token to get its decimals.
export const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

export const MORPHO_BLUE_ADDRESS: Address =
  '0xe3F8380851ee3A0BBcedDD0bCDe92d423812C1Cd';

export const MORPHO_BLUE_ABI = parseAbi([
  'function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)',
  'function idToMarketParams(bytes32 id) external view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)',
  'function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
]);

export const IRM_ABI = parseAbi([
  'function borrowRateView((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee) market) external view returns (uint256)',
]);

export const METAMORPHO_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function curator() view returns (address)',
  'function guardian() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function skimRecipient() view returns (address)',
  'function fee() view returns (uint96)',
  'function timelock() view returns (uint256)',
  'function lastTotalAssets() view returns (uint256)',
  'function isAllocator(address) view returns (bool)',
  'function supplyQueueLength() view returns (uint256)',
  'function withdrawQueueLength() view returns (uint256)',
  'function supplyQueue(uint256) view returns (bytes32)',
  'function withdrawQueue(uint256) view returns (bytes32)',
  'function pendingTimelock() view returns (uint192 value, uint64 validAt)',
  'function pendingGuardian() view returns (address value, uint64 validAt)',
  'function MORPHO() view returns (address)',
]);

export function createAbi<TAbi extends Abi>(abi: TAbi) {
  return abi;
}

export const IERC20_ABI = /* #__PURE__ */ createAbi([
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      {
        indexed: true,
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        name: 'spender',
        type: 'address',
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256',
      },
    ],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      {
        indexed: true,
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256',
      },
    ],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      {
        name: 'owner',
        type: 'address',
      },
      {
        name: 'spender',
        type: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'spender',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
      {
        name: 'account',
        type: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
      },
    ],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'sender',
        type: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
] as const);

export const IMetaMorpho_ABI = /* #__PURE__ */ createAbi([
  {
    type: 'constructor',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'morpho',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'initialTimelock',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_asset',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_symbol',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'DECIMALS_OFFSET',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MORPHO',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IMorpho',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'acceptCap',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        internalType: 'struct MarketParams',
        components: [
          {
            name: 'loanToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'collateralToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'oracle',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'irm',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'lltv',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptGuardian',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptTimelock',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'asset',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'config',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
    outputs: [
      {
        name: 'cap',
        type: 'uint184',
        internalType: 'uint184',
      },
      {
        name: 'enabled',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'removableAt',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'convertToAssets',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'convertToShares',
    inputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'curator',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'eip712Domain',
    inputs: [],
    outputs: [
      {
        name: 'fields',
        type: 'bytes1',
        internalType: 'bytes1',
      },
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'version',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'extensions',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fee',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint96',
        internalType: 'uint96',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'guardian',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAllocator',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastTotalAssets',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lostAssets', // Only defined for MetaMorpho V1.1 vaults.
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxDeposit',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxMint',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxRedeem',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxWithdraw',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'multicall',
    inputs: [
      {
        name: 'data',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    outputs: [
      {
        name: 'results',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingCap',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
    outputs: [
      {
        name: 'value',
        type: 'uint192',
        internalType: 'uint192',
      },
      {
        name: 'validAt',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingGuardian',
    inputs: [],
    outputs: [
      {
        name: 'value',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'validAt',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingOwner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingTimelock',
    inputs: [],
    outputs: [
      {
        name: 'value',
        type: 'uint192',
        internalType: 'uint192',
      },
      {
        name: 'validAt',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permit',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'previewDeposit',
    inputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewMint',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewRedeem',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewWithdraw',
    inputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reallocate',
    inputs: [
      {
        name: 'allocations',
        type: 'tuple[]',
        internalType: 'struct MarketAllocation[]',
        components: [
          {
            name: 'marketParams',
            type: 'tuple',
            internalType: 'struct MarketParams',
            components: [
              {
                name: 'loanToken',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'collateralToken',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'oracle',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'irm',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'lltv',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
          {
            name: 'assets',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokePendingCap',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokePendingGuardian',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokePendingMarketRemoval',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokePendingTimelock',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setCurator',
    inputs: [
      {
        name: 'newCurator',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setFee',
    inputs: [
      {
        name: 'newFee',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setFeeRecipient',
    inputs: [
      {
        name: 'newFeeRecipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setIsAllocator',
    inputs: [
      {
        name: 'newAllocator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'newIsAllocator',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSkimRecipient',
    inputs: [
      {
        name: 'newSkimRecipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSupplyQueue',
    inputs: [
      {
        name: 'newSupplyQueue',
        type: 'bytes32[]',
        internalType: 'Id[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'skim',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'skimRecipient',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'submitCap',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        internalType: 'struct MarketParams',
        components: [
          {
            name: 'loanToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'collateralToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'oracle',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'irm',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'lltv',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
      {
        name: 'newSupplyCap',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitGuardian',
    inputs: [
      {
        name: 'newGuardian',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitMarketRemoval',
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        internalType: 'struct MarketParams',
        components: [
          {
            name: 'loanToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'collateralToken',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'oracle',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'irm',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'lltv',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitTimelock',
    inputs: [
      {
        name: 'newTimelock',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'supplyQueue',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'supplyQueueLength',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'timelock',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAssets',
    inputs: [],
    outputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      {
        name: 'from',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateWithdrawQueue',
    inputs: [
      {
        name: 'indexes',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawQueue',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'withdrawQueueLength',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AccrueInterest',
    inputs: [
      {
        name: 'newTotalAssets',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'feeShares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'assets',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'shares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EIP712DomainChanged',
    inputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferStarted',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ReallocateSupply',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'id',
        type: 'bytes32',
        indexed: true,
        internalType: 'Id',
      },
      {
        name: 'suppliedAssets',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'suppliedShares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ReallocateWithdraw',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'id',
        type: 'bytes32',
        indexed: true,
        internalType: 'Id',
      },
      {
        name: 'withdrawnAssets',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'withdrawnShares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RevokePendingCap',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'id',
        type: 'bytes32',
        indexed: true,
        internalType: 'Id',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RevokePendingGuardian',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RevokePendingMarketRemoval',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'id',
        type: 'bytes32',
        indexed: true,
        internalType: 'Id',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RevokePendingTimelock',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetCap',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'id',
        type: 'bytes32',
        indexed: true,
        internalType: 'Id',
      },
      {
        name: 'cap',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetCurator',
    inputs: [
      {
        name: 'newCurator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetFee',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetFeeRecipient',
    inputs: [
      {
        name: 'newFeeRecipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetGuardian',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'guardian',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetIsAllocator',
    inputs: [
      {
        name: 'allocator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'isAllocator',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetName',
    inputs: [
      {
        name: 'name',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetSymbol',
    inputs: [
      {
        name: 'symbol',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetSkimRecipient',
    inputs: [
      {
        name: 'newSkimRecipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetSupplyQueue',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newSupplyQueue',
        type: 'bytes32[]',
        indexed: false,
        internalType: 'Id[]',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetTimelock',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newTimelock',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetWithdrawQueue',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newWithdrawQueue',
        type: 'bytes32[]',
        indexed: false,
        internalType: 'Id[]',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Skim',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SubmitCap',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'id',
        type: 'bytes32',
        indexed: true,
        internalType: 'Id',
      },
      {
        name: 'cap',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SubmitGuardian',
    inputs: [
      {
        name: 'newGuardian',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SubmitMarketRemoval',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'id',
        type: 'bytes32',
        indexed: true,
        internalType: 'Id',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SubmitTimelock',
    inputs: [
      {
        name: 'newTimelock',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      {
        name: 'from',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'UpdateLastTotalAssets',
    inputs: [
      {
        name: 'updatedTotalAssets',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Withdraw',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'receiver',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'assets',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'shares',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AboveMaxTimelock',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AddressEmptyCode',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AddressInsufficientBalance',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllCapsReached',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadyPending',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadySet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BelowMinTimelock',
    inputs: [],
  },
  {
    type: 'error',
    name: 'DuplicateMarket',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureLength',
    inputs: [
      {
        name: 'length',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureS',
    inputs: [
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InsufficientAllowance',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'allowance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'needed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InsufficientBalance',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'needed',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidApprover',
    inputs: [
      {
        name: 'approver',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidReceiver',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidSender',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InvalidSpender',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC2612ExpiredSignature',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC2612InvalidSigner',
    inputs: [
      {
        name: 'signer',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC4626ExceededMaxDeposit',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'max',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC4626ExceededMaxMint',
    inputs: [
      {
        name: 'receiver',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'max',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC4626ExceededMaxRedeem',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'shares',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'max',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ERC4626ExceededMaxWithdraw',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'assets',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'max',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'FailedInnerCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InconsistentAsset',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'InconsistentReallocation',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAccountNonce',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'currentNonce',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidMarketRemovalNonZeroCap',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidMarketRemovalNonZeroSupply',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidMarketRemovalTimelockNotElapsed',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidShortString',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketNotCreated',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MarketNotEnabled',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'MathOverflowedMulDiv',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MaxFeeExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'MaxQueueLengthExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoPendingValue',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NonZeroCap',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotAllocatorRole',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotCuratorNorGuardianRole',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotCuratorRole',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotEnoughLiquidity',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotGuardianRole',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PendingCap',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'PendingRemoval',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeCastOverflowedUintDowncast',
    inputs: [
      {
        name: 'bits',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StringTooLong',
    inputs: [
      {
        name: 'str',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
  {
    type: 'error',
    name: 'SupplyCapExceeded',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'TimelockNotElapsed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnauthorizedMarket',
    inputs: [
      {
        name: 'id',
        type: 'bytes32',
        internalType: 'Id',
      },
    ],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroFeeRecipient',
    inputs: [],
  },
] as const);
