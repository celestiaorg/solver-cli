import { WalletType } from 'graz';

// interface GetSupportedChainIds {
// 	getSupportedChainIds: () => Promise<string[]>;
// }

const allSupportedChainIds = [
  'akashnet-2',
  'archway-1',
  'axelar-dojo-1',
  'aura_6322-2',
  'carbon-1',
  'celestia',
  'mocha-4',
  'cheqd-mainnet-1',
  'coreum-mainnet-1',
  'cosmoshub-4',
  'dydx-mainnet-1',
  'dymension_1100-1',
  'injective-1',
  'juno-1',
  'kaiyo-1',
  'migaloo-1',
  'neutron-1',
  'cataclysm-1',
  'noble-1',
  'omniflixhub-1',
  'osmosis-1',
  'centauri-1',
  'ssc-1',
  'pacific-1',
  'stargaze-1',
  'stride-1',
  'umee-1',
  'lava-mainnet-1',
  'mantra-1',
  '1',
  '984122',
  '42161',
  '137',
  '8453',
  '10',
  '81457',
  '169',
  '1890',
  '130',
  '3652501241',
  '253368190',
  'elys-1',
  'bbn-1',
  'interwoven-1',
  '2741',
  '80094',
  '1514',
];

const basicSupportedChains = [
  'agoric-3',
  'akashnet-2',
  'axelar-dojo-1',
  'celestia',
  'mocha-4',
  'chihuahua-1',
  'cosmoshub-4',
  'dydx-mainnet-1',
  'dymension_1100-1',
  'evmos_9001-2',
  'injective-1',
  'juno-1',
  'kava_2222-10',
  'lava-mainnet-1',
  'neutron-1',
  'noble-1',
  'omniflixhub-1',
  'osmosis-1',
  'passage-2',
  'core-1',
  'pryzm-1',
  'quicksilver-2',
  'secret-4',
  'sentinelhub-2',
  'sommelier-3',
  'stargaze-1',
  'stride-1',
  'phoenix-1',
  'umee-1',
];

const leapSupportedChains = [
  'akashnet-2',
  'archway-1',
  'mantle-1',
  'axelar-dojo-1',
  'aura_6322-2',
  'bitcanna-1',
  'carbon-1',
  'celestia',
  'mocha-4',
  'perun-1',
  'cheqd-mainnet-1',
  'chihuahua-1',
  'comdex-1',
  'cosmoshub-4',
  'crescent-1',
  'mainnet-3',
  'dydx-mainnet-1',
  'emoney-3',
  'empowerchain-1',
  'fetchhub-4',
  'gravity-bridge-3',
  'gitopia',
  'irishub-1',
  'ixo-5',
  'jackal-1',
  'juno-1',
  'kichain-2',
  'kaiyo-1',
  'kyve-1',
  'likecoin-mainnet-2',
  'migaloo-1',
  'neutron-1',
  'cataclysm-1',
  'noble-1',
  'pirin-1',
  'nomic-stakenet-3',
  'odin-mainnet-freya',
  'omniflixhub-1',
  'onomy-mainnet-1',
  'osmosis-1',
  'passage-2',
  'core-1',
  'centauri-1',
  'pryzm-1',
  'quicksilver-2',
  'ssc-1',
  'pacific-1',
  'sentinelhub-2',
  'sgenet-1',
  'sifchain-1',
  'sommelier-3',
  'stargaze-1',
  'stride-1',
  'teritori-1',
  'umee-1',
  'lava-mainnet-1',
  'mantra-1',
  'elys-1',
  'bbn-1',
  'milkyway',
  'nillion-1',
  'iov-mainnet-ibc',
  'phoenix-1',
  'kava_2222-10',
  'laozi-mainnet',
  'pio-mainnet-1',
  'secret-4',
  'agoric-3',
  'bitsong-2b',
  'desmos-mainnet',
  'mayachain-mainnet-v1',
  'thorchain-1',
  'coreum-mainnet-1',
  'canto_7700-1',
  'dymension_1100-1',
  'evmos_9001-2',
  'injective-1',
  'planq_7070-2',
  'dimension_37-1',
  'humans_1089-1',
];

const SNAPS_SUPPORTED_CHAIN_IDS = [
  'akashnet-2',
  'archway-1',
  'axelar-dojo-1',
  'bitcanna-1',
  'carbon-1',
  'celestia',
  'mocha-4',
  'cheqd-mainnet-1',
  'comdex-1',
  'cosmoshub-4',
  'crescent-1',
  'mainnet-3',
  'emoney-3',
  'empowerchain-1',
  'fetchhub-4',
  'gravity-bridge-3',
  'gitopia',
  'irishub-1',
  'ixo-5',
  'jackal-1',
  'juno-1',
  'kichain-2',
  'kaiyo-1',
  'kyve-1',
  'likecoin-mainnet-2',
  'migaloo-1',
  'neutron-1',
  'noble-1',
  'pirin-1',
  'odin-mainnet-freya',
  'omniflixhub-1',
  'onomy-mainnet-1',
  'osmosis-1',
  'passage-2',
  'core-1',
  'centauri-1',
  'quicksilver-2',
  'pacific-1',
  'sentinelhub-2',
  'sommelier-3',
  'stargaze-1',
  'stride-1',
  'teritori-1',
  'umee-1',
  'pio-mainnet-1',
  'secret-4',
  'coreum-mainnet-1',
];

const noBasicChains: string[] = [];

export async function getSupportedChains(wallet: WalletType) {
  let supportedChains = [];
  switch (wallet) {
    case WalletType.LEAP: {
      // const leap = window.leap! as unknown as GetSupportedChainIds;
      // return leap.getSupportedChainIds();
      supportedChains = leapSupportedChains;
      break;
    }
    case WalletType.KEPLR: {
      const keplr = window.keplr!;
      const chainInfos = await keplr.getChainInfosWithoutEndpoints();
      supportedChains = chainInfos
        .filter(c => !c.chainId.startsWith('eip155:'))
        .map(c => c.chainId);
      break;
    }
    case WalletType.COMPASS: {
      // const compass = window.compass! as unknown as GetSupportedChainIds;
      // return compass.getSupportedChainIds();
      supportedChains = ['pacific-1'];
      break;
    }
    case WalletType.COSMOSTATION: {
      supportedChains = basicSupportedChains;
      break;
    }
    case WalletType.METAMASK_SNAP_LEAP: {
      supportedChains = SNAPS_SUPPORTED_CHAIN_IDS;
      break;
    }
    default:
      supportedChains = noBasicChains;
      break;
  }
  return supportedChains.filter(chain => allSupportedChainIds.includes(chain));
}
