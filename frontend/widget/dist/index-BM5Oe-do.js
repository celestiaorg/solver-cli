import { jsx as m, Fragment as ye, jsxs as S } from "react/jsx-runtime";
import { AnimatePresence as vt, motion as Ee } from "framer-motion";
import * as gr from "react";
import ut, { Component as Ji, createContext as qi, useMemo as R, useCallback as ie, useRef as yr, useEffect as $, useState as he, memo as ji } from "react";
import { useQuery as Ce } from "@tanstack/react-query";
import { cosmoshub as Yi, edentestnet as Ki, eclipsemainnetAddresses as Qi, eclipsemainnet as Hi, solanamainnetAddresses as Xi, solanamainnet as $i, chainMetadata as qo, warpRouteConfigs as _i, GithubRegistry as ea, PartialRegistry as ta, chainAddresses as na } from "@hyperlane-xyz/registry";
import jo, { HTTPError as Qt } from "ky";
import { ChainStatus as ra, TOKEN_COLLATERALIZED_STANDARDS as eo, ProviderType as we, MultiProtocolCore as oa, ChainMetadataSchema as sa, mergeChainMetadataMap as to, RpcUrlSchema as ia, WarpCoreConfigSchema as aa, validateZodResult as ca, WarpCore as Vn, MultiProtocolProvider as Lt, TokenAmount as ua, WarpTxCategory as lt } from "@hyperlane-xyz/sdk";
import { ProtocolType as D, isHttpsUrl as la, isRelativeUrl as da, normalizeAddress as no, toTitleCase as Wn, objFilter as fa, promiseObjAll as ha, objMap as ro, tryParseJsonOrYaml as ma, objMerge as pa, toWei as br, assert as ga } from "@hyperlane-xyz/utils";
import X from "bignumber.js";
import { clsx as ya } from "clsx";
import { twMerge as ba } from "tailwind-merge";
import { create as Tt } from "zustand";
import { z as oo } from "zod";
import { ArrowLeft as Bt, X as Yo, Lightning as wa, CheckCircle as xa, Question as so } from "@phosphor-icons/react";
import { Slot as Aa } from "@radix-ui/react-slot";
import { cva as Ca } from "class-variance-authority";
import { ArrowUpDown as va, ChevronDown as an, Timer as Ia, ChevronRight as Ko, X as Ea } from "lucide-react";
import * as io from "@solana/spl-token";
import { Connection as wr, PublicKey as Zn } from "@solana/web3.js";
import { erc20Abi as ao, isAddress as ka, createClient as Sa, custom as Ta, hexToString as Ba } from "viem";
import { useAccount as Jt, usePublicClient as Na, useConfig as Fa, useWalletClient as Ma, useSwitchChain as Ra } from "wagmi";
import { useWallet as qt, useConnection as za } from "@solana/wallet-adapter-react";
import { useAccount as xr, useOfflineSigners as Ua, useCosmWasmSigningClient as Da, useStargateSigningClient as Pa, WalletType as de } from "graz";
import * as Ar from "@radix-ui/react-avatar";
import * as co from "@radix-ui/react-switch";
import * as La from "@radix-ui/react-label";
import { bech32 as Oa } from "bech32";
import { SigningStargateClient as Ga, GasPrice as uo } from "@cosmjs/stargate";
import { CosmosNativeSigner as Va } from "@hyperlane-xyz/cosmos-sdk";
import { BigNumber as Wa, logger as Za } from "ethers";
import Ja from "bowser";
import * as qa from "@radix-ui/react-separator";
import lo from "fuse.js";
import { getClient as ja, createClient as Ya, MAINNET_RELAY_API as Ka, configureViemChain as Qa } from "@relayprotocol/relay-sdk";
import { adaptSolanaWallet as Ha } from "@relayprotocol/relay-svm-wallet-adapter";
class Xa extends Ji {
  constructor(t) {
    super(t), this.state = { hasError: !1 };
  }
  static getDerivedStateFromError() {
    return { hasError: !0 };
  }
  componentDidCatch(t, n) {
    console.error("Error caught by boundary:", t, n);
  }
  render() {
    return this.state.hasError ? this.props.fallback || /* @__PURE__ */ m("div", { className: "m-auto rounded-lg bg-white p-6 text-center shadow-sm", children: /* @__PURE__ */ m("p", { className: "text-black", children: "Something went wrong. Please refresh the page or try again." }) }) : this.props.children;
  }
}
const q = {
  debug: (...e) => console.debug(...e),
  info: (...e) => console.info(...e),
  warn: (...e) => console.warn(...e),
  error: (e, t, ...n) => {
    console.error(e, t, ...n);
  }
}, $a = !1, _a = "0.0.0", ec = "https://api.github.com/repos/celestiaorg/hyperlane-ops", tc = "main", nc = "https://proxy.hyperlane.xyz", rc = "", oc = "", sc = JSON.parse(
  "{}"
), ic = "", ac = void 0, We = Object.freeze({
  chainWalletWhitelists: sc,
  enableExplorerLink: !1,
  defaultOriginChain: void 0,
  defaultDestinationChain: void 0,
  isDevMode: $a,
  registryUrl: ec,
  registryBranch: tc,
  registryProxyUrl: nc,
  showAddRouteButton: !0,
  showAddChainButton: !0,
  showDisabledTokens: !1,
  showTipBox: !0,
  version: _a,
  transferBlacklist: oc,
  walletConnectProjectId: rc,
  walletProtocols: [
    D.Ethereum,
    D.Sealevel,
    D.Cosmos
  ],
  shouldDisableChains: !1,
  rpcOverrides: ic,
  leapApiBaseUrl: ac
}), Cr = {
  imgPath: "https://cdn.jsdelivr.net/gh/hyperlane-xyz/hyperlane-registry@main"
}, kn = (e) => e.startsWith("0x") ? parseInt(e, 16).toString() : e, cc = async (e) => {
  try {
    return [await e, null];
  } catch (t) {
    return [null, t];
  }
}, Ae = (e, t = 0, n = 2, r = "standard") => {
  const o = new X(e), s = new X(10).pow(-n);
  if (o.isNaN())
    return "";
  if (o.isZero())
    return "0";
  if (o.isLessThan(s))
    return `< ${s}`;
  const i = o.isGreaterThanOrEqualTo(100) ? 2 : t;
  return Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: r,
    maximumFractionDigits: o.isGreaterThanOrEqualTo(100) ? i : n,
    minimumFractionDigits: i
  }).format(o.toNumber()).slice(1);
}, Qo = (e, t, n = 0, r = 2, o = "standard") => {
  const s = Ae(
    e,
    n,
    r,
    o
  );
  return s.startsWith("<") ? `< ${t}${s.slice(2)}` : `${t}${s}`;
};
function uc(e) {
  return !We.shouldDisableChains || !e ? !1 : e.availability?.status === ra.Disabled;
}
function lc(e, t, n = !1) {
  if (!t) return "Unknown";
  const r = e.tryGetChainMetadata(t);
  return r ? (n ? r.displayNameShort : r.displayName) || r.displayName || Wn(r.name) : "Unknown";
}
function dc(e, t) {
  return e.filter((r) => r.isMultiChainToken()).reduce(
    (r, o) => {
      if (!o.connections || !o.connections.length) return r;
      if (r[o.symbol] || (r[o.symbol] = {
        chains: {},
        tokenInformation: o
      }), !r[o.symbol].chains[o.chainName]) {
        const s = t.tryGetChainMetadata(
          o.chainName
        );
        if (uc(s)) return r;
        r[o.symbol].chains[o.chainName] = {
          token: o,
          metadata: s
        };
      }
      return r;
    },
    {}
  );
}
function fc(e, t) {
  if (!e.collateralAddressOrDenom || !eo.includes(e.standard))
    return !1;
  const n = typeof t == "string" ? e.getConnectionForChain(t)?.token : t;
  return !(!n || !n.collateralAddressOrDenom || !eo.includes(n.standard));
}
function hc(e, t) {
  return e.reduce(
    (n, r) => {
      const o = r;
      if (!fc(
        o,
        t
      ))
        return { ...n, tokens: [...n.tokens, r] };
      const i = o.getConnectionForChain(t).token, u = no(
        o.collateralAddressOrDenom,
        o.protocol
      ), d = no(
        i.collateralAddressOrDenom,
        i.protocol
      );
      return n.multiCollateralTokenMap[u] ||= {}, n.multiCollateralTokenMap[u][d] || (n.multiCollateralTokenMap[u][d] = [], n.tokens.push(r)), n.multiCollateralTokenMap[u][d].push(
        o
      ), n;
    },
    { tokens: [], multiCollateralTokenMap: {} }
  );
}
function It(e) {
  return e ? la(e) ? e : da(e) ? `${Cr.imgPath}${e}` : null : null;
}
function mc(e, t, n) {
  try {
    if (n.type === we.CosmJs) return;
    n.type === we.Starknet && (n = {
      type: we.Starknet,
      receipt: n.receipt
    }), n.type === we.Viem && (n = {
      type: we.EthersV5,
      receipt: n.receipt
    });
    const r = e.getKnownChainNames().reduce((i, u) => (i[u] = {
      validatorAnnounce: "",
      proxyAdmin: "",
      mailbox: ""
    }, i), {}), s = new oa(e, r).extractMessageIds(t, n);
    if (s.length) {
      const i = s[0].messageId;
      return q.debug("Message id found in logs", i), i;
    } else {
      q.warn("No messages found in logs");
      return;
    }
  } catch (r) {
    q.error("Could not get msgId from transfer receipt", r);
    return;
  }
}
function se(...e) {
  return ba(ya(e));
}
function pc(e, t) {
  if (!t) return;
  const n = Object.values(e.metadata), r = t.toLowerCase();
  return n.find(
    (o) => !!o.rpcUrls.find((s) => s.http.toLowerCase().includes(r))
  );
}
function fo(e, t) {
  return Object.values(e.metadata).filter(
    (n) => n.protocol === t
  );
}
function gc(e) {
  return [
    ...fo(e, D.Cosmos),
    ...fo(e, D.CosmosNative),
    Yi
  ];
}
function yc(e) {
  return gc(e).reduce((n, r) => (n[r.name] = r, n), {});
}
const Ot = (e) => new X(10).exponentiatedBy(e);
function xt(e) {
  let t = e;
  return e === "solana" && (t = cn.solana), Number(t);
}
function bc(e) {
  switch (e) {
    case "evm":
      return D.Ethereum;
    case "svm":
      return D.Sealevel;
    default:
      return;
  }
}
var cn = /* @__PURE__ */ ((e) => (e.solana = "792703809", e.bitcoin = "8253038", e))(cn || {}), Ho = /* @__PURE__ */ ((e) => (e.EXACT_INPUT = "EXACT_INPUT", e.EXACT_OUTPUT = "EXACT_OUTPUT", e.EXPECTED_OUTPUT = "EXPECTED_OUTPUT", e))(Ho || {});
const wc = "https://api.relay.link";
class ze {
  static ky = jo.create({
    prefixUrl: wc,
    timeout: !1
  });
  static async getChains(t = "") {
    try {
      return {
        success: !0,
        chains: (await (await ze.ky.get("chains", {
          searchParams: {
            includeChains: t
          }
        })).json()).chains
      };
    } catch (n) {
      return n instanceof Qt && n.response ? {
        success: !1,
        error: (await n.response.json()).message
      } : {
        success: !1,
        error: n.message
      };
    }
  }
  static async getSupportedChains() {
    const t = await this.getChains();
    return t.success ? {
      success: !0,
      chains: t.chains.map(
        (r) => ({
          chainId: r.id.toString() === "792703809" ? "solana" : r.id.toString(),
          baseDenom: r.currency?.address,
          name: r.displayName,
          displayName: r.displayName,
          logoURI: r?.iconUrl,
          chainType: bc(r.vmType),
          icon: r?.iconUrl,
          isTestnet: !1,
          nativeToken: {
            id: r.currency?.id,
            address: r.currency?.address,
            symbol: r.currency?.symbol,
            chainId: r.id,
            decimals: r.currency?.decimals,
            name: r.currency?.name
          },
          multicallAddress: r?.contracts?.multicall3,
          pfmEnabled: !1,
          explorerUrl: r.explorerUrl,
          rpcUrl: r.httpRpcUrl || "",
          bech32Prefix: ""
        })
      ),
      _raw: t.chains
    } : t;
  }
  static async getSupportedAssets(t) {
    try {
      const r = await (await ze.ky.post("currencies/v1", {
        json: {
          defaultList: t.defaultList ?? !0,
          depositAddressOnly: t.depositAddressOnly ?? !1,
          limit: t.limit ?? 1e3,
          term: t.term ?? ""
        }
      })).json(), o = {};
      return r.forEach((s) => {
        s.forEach((i) => {
          const u = i.chainId.toString() === "792703809" ? "solana" : i.chainId.toString();
          o[u] || (o[u] = []), o[u].push({
            chainId: u,
            denom: i.address,
            originChainId: u,
            originDenom: i.address,
            symbol: i.symbol ?? i.address,
            name: i.name ?? null,
            logoUri: i.metadata.logoURI ?? "",
            trace: "",
            priceUSD: "",
            tokenContract: i.address,
            decimals: i.decimals,
            coingeckoId: void 0
          });
        });
      }), {
        success: !0,
        assets: o
      };
    } catch (n) {
      return n instanceof Qt && n.response ? {
        success: !1,
        error: (await n.response.json()).message
      } : {
        success: !1,
        error: n.message
      };
    }
  }
  static async getRoute(t) {
    try {
      const r = await (await ze.ky.post("quote", {
        json: {
          user: t.user,
          recipient: t.recipient,
          originChainId: xt(String(t.originChainId)),
          destinationChainId: xt(String(t.destinationChainId)),
          originCurrency: t.originCurrency,
          destinationCurrency: t.destinationCurrency,
          amount: t.amount,
          tradeType: t.tradeType,
          txs: t.txs,
          referrer: t.referrer,
          refundTo: t.refundTo,
          refundOnOrigin: t.refundOnOrigin,
          useReceiver: t.useReceiver,
          useExternalLiquidity: t.useExternalLiquidity,
          usePermit: t.usePermit,
          useDepositAddress: t.useDepositAddress,
          slippageTolerance: t.slippageTolerance,
          appFees: t.appFees,
          gasLimitForDepositSpecifiedTxs: t.gasLimitForDepositSpecifiedTxs,
          userOperationGasOverhead: t.userOperationGasOverhead,
          forceSolverExecution: t.forceSolverExecution
        }
      })).json();
      return {
        success: !0,
        route: {
          ...r,
          does_swap: r.details.operation === "swap",
          swap_price_impact_percent: r.details.swapImpact.percent,
          request: t
        }
      };
    } catch (n) {
      return console.error(n), n instanceof Qt && n.response ? {
        success: !1,
        error: (await n.response.json()).message
      } : {
        success: !1,
        error: `Error getting route - ${n.message ?? "unknown error"}`
      };
    }
  }
  static async trackTransaction(t) {
    try {
      return {
        success: !0,
        response: await (await ze.ky.get("intents/status/v2", {
          searchParams: {
            requestId: t.requestId
          }
        })).json()
      };
    } catch (n) {
      return n instanceof Qt && n.response ? {
        success: !1,
        error: (await n.response.json()).message
      } : {
        success: !1,
        error: n.message
      };
    }
  }
  static async getTokenPrice(t, n) {
    if (!t || !n)
      return -1;
    const r = xt(n);
    return await ze.ky.get("currencies/token/price", {
      searchParams: {
        address: t,
        chainId: r
      }
    }).then((i) => i.json()).then((i) => {
      const u = i.price;
      return new Promise((d) => {
        d(u);
      });
    }).catch(() => -1);
  }
}
const xc = {
  solanamainnet: {
    ...$i,
    // SVM chains require mailbox addresses for the token adapters
    mailbox: Xi.mailbox,
    rpcUrls: [
      {
        http: "https://sly-wider-valley.solana-mainnet.quiknode.pro/9017f727c4fc429840553a9222ee33471f855e14"
      }
    ]
  },
  eclipsemainnet: {
    ...Hi,
    mailbox: Qi.mailbox
  },
  edentestnet: {
    ...Ki,
    domainId: 2147483647,
    rpcUrls: [
      {
        http: "https://eden-rpc-proxy-production.up.railway.app/rpc"
      }
    ]
  }
}, Xo = [
  "1",
  "1399811149",
  "8453",
  "42161",
  "2741",
  "1408864445",
  "celestia",
  "9286185",
  // eclipse from relay
  "solana",
  cn.solana,
  "11124",
  "84532",
  "arabica-11",
  "mocha-4",
  "421614",
  "1399811151",
  "239092742",
  "3735928814"
];
BigInt(Math.round(4019e-8 * 10 ** 9)), BigInt(Math.round(411336e-8 * 10 ** 9)), BigInt(Math.round(411336e-8 * 10 ** 9)), BigInt(Math.round(355e-8 * 10 ** 9));
var ne = /* @__PURE__ */ ((e) => (e.Preparing = "preparing", e.CreatingTxs = "creating-txs", e.SigningApprove = "signing-approve", e.SigningRevoke = "signing-revoke", e.ConfirmingRevoke = "confirming-revoke", e.ConfirmingApprove = "confirming-approve", e.SigningTransfer = "signing-transfer", e.ConfirmingTransfer = "confirming-transfer", e.ConfirmedTransfer = "confirmed-transfer", e.Delivered = "delivered", e.Failed = "failed", e))(ne || {});
const Ac = [
  "confirmed-transfer",
  "delivered"
  /* Delivered */
], Cc = [
  ...Ac,
  "failed"
  /* Failed */
];
var Q = /* @__PURE__ */ ((e) => (e.TOKEN = "TOKEN", e.FIAT = "FIAT", e))(Q || {}), pe = /* @__PURE__ */ ((e) => (e.FAST = "FAST", e.ADVANCED = "ADVANCED", e))(pe || {}), Ve = /* @__PURE__ */ ((e) => (e.IDLE = "IDLE", e.NEEDS_APPROVAL = "NEEDS_APPROVAL", e.CONFIRMING_ALLOWANCE = "CONFIRMING_ALLOWANCE", e.SIGNED = "SIGNED", e.BROADCASTING = "BROADCASTING", e.BROADCASTED = "BROADCASTED", e))(Ve || {});
async function vc(e, t, n) {
  const r = oo.record(sa).safeParse({
    ...xc
  });
  if (!r.success)
    throw q.warn("Invalid chain metadata", r.error), new Error(`Invalid chain metadata: ${r.error.toString()}`);
  const o = r.data;
  let s;
  We.registryUrl ? (q.debug(
    "Using custom registry chain metadata from:",
    We.registryUrl
  ), s = await t.getMetadata()) : (q.debug("Using default published registry for chain metadata"), s = qo), s = fa(
    s,
    (y, g) => e.includes(y)
  ), s = await ha(
    ro(
      s,
      async (y, g) => ({
        ...g,
        logoURI: `${Cr.imgPath}/chains/${y}/logo.svg`
      })
    )
  );
  const i = to(
    s,
    o
  ), u = ma(We.rpcOverrides), d = oo.record(ia).safeParse(
    u.success && u.data
  );
  We.rpcOverrides && !d.success && q.warn("Invalid RPC overrides config", d.error);
  const h = ro(i, (y, g) => {
    const b = d.success && d.data[y] ? d.data[y] : void 0;
    if (!b) return g;
    const x = g.protocol === D.Ethereum ? [...g.rpcUrls, b] : [b, ...g.rpcUrls];
    return { ...g, rpcUrls: x };
  }), l = to(
    h,
    n
  );
  return { chainMetadata: h, chainMetadataWithOverrides: l };
}
const Ic = {
  tokens: [
    // TIA Celestia to Neutron and Stride
    // {
    //   chainName: "celestia",
    //   standard: TokenStandard.CosmosIbc,
    //   name: "TIA",
    //   symbol: "TIA",
    //   decimals: 6,
    //   addressOrDenom: "utia",
    //   logoURI: "/deployments/warp_routes/TIA/logo.svg",
    //   connections: [
    //     // To Neutron
    //     {
    //       token:
    //         "cosmos|neutron|ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7",
    //       type: TokenConnectionType.Ibc,
    //       sourcePort: "transfer",
    //       sourceChannel: "channel-8",
    //     },
    //     // To Arbitrum via Neutron
    //     {
    //       token: "ethereum|arbitrum|0xD56734d7f9979dD94FAE3d67C7e928234e71cD4C",
    //       type: TokenConnectionType.IbcHyperlane,
    //       sourcePort: "transfer",
    //       sourceChannel: "channel-8",
    //       intermediateChainName: "neutron",
    //       intermediateRouterAddress:
    //         "neutron1jyyjd3x0jhgswgm6nnctxvzla8ypx50tew3ayxxwkrjfxhvje6kqzvzudq",
    //       intermediateIbcDenom:
    //         "ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7",
    //     },
    //     // To Manta Pacific via Neutron
    //     {
    //       token:
    //         "ethereum|mantapacific|0x6Fae4D9935E2fcb11fC79a64e917fb2BF14DaFaa",
    //       type: TokenConnectionType.IbcHyperlane,
    //       sourcePort: "transfer",
    //       sourceChannel: "channel-8",
    //       intermediateChainName: "neutron",
    //       intermediateRouterAddress:
    //         "neutron1ch7x3xgpnj62weyes8vfada35zff6z59kt2psqhnx9gjnt2ttqdqtva3pa",
    //       intermediateIbcDenom:
    //         "ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7",
    //     },
    //     // To Stride
    //     {
    //       token:
    //         "cosmos|stride|ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801",
    //       type: TokenConnectionType.Ibc,
    //       sourcePort: "transfer",
    //       sourceChannel: "channel-4",
    //     },
    //     // To Eclipse via Stride
    //     {
    //       token:
    //         "sealevel|eclipsemainnet|BpXHAiktwjx7fN6M9ST9wr6qKAsH27wZFhdHEhReJsR6",
    //       type: TokenConnectionType.IbcHyperlane,
    //       sourcePort: "transfer",
    //       sourceChannel: "channel-4",
    //       intermediateChainName: "stride",
    //       intermediateRouterAddress:
    //         "stride1pvtesu3ve7qn7ctll2x495mrqf2ysp6fws68grvcu6f7n2ajghgsh2jdj6",
    //       intermediateIbcDenom:
    //         "ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801",
    //     },
    //   ],
    // },
    // // TIA on Neutron from Celestia
    // {
    //   chainName: "neutron",
    //   standard: TokenStandard.CosmosIbc,
    //   name: "TIA.n",
    //   symbol: "TIA.n",
    //   decimals: 6,
    //   addressOrDenom:
    //     "ibc/773B4D0A3CD667B2275D5A4A7A2F0909C0BA0F4059C0B9181E680DDF4965DCC7",
    //   logoURI: "/deployments/warp_routes/TIA/logo.svg",
    //   connections: [
    //     {
    //       token: "cosmos|celestia|utia",
    //       type: TokenConnectionType.Ibc,
    //       sourcePort: "transfer",
    //       sourceChannel: "channel-35",
    //     },
    //   ],
    // },
    // // TIA on Stride from Celestia
    // {
    //   chainName: "stride",
    //   standard: TokenStandard.CosmosIbc,
    //   name: "Celestia",
    //   symbol: "TIA",
    //   decimals: 6,
    //   addressOrDenom:
    //     "ibc/BF3B4F53F3694B66E13C23107C84B6485BD2B96296BB7EC680EA77BBA75B4801",
    //   logoURI: "/deployments/warp_routes/TIA/logo.svg",
    //   connections: [
    //     {
    //       token: "cosmos|celestia|utia",
    //       type: TokenConnectionType.Ibc,
    //       sourcePort: "transfer",
    //       sourceChannel: "channel-162",
    //     },
    //   ],
    // },
    // // EDEN Token Route: edentestnet (native) <-> celestiatestnet (synthetic)
    // {
    //   chainName: "edentestnet",
    //   standard: TokenStandard.EvmHypNative,
    //   addressOrDenom: "0x43505da95A74Fa577FB9bB0Ce29E293FdF575011",
    //   decimals: 18,
    //   name: "TIA",
    //   symbol: "TIA",
    //   logoURI: "/deployments/warp_routes/TIA/logo.svg",
    //   connections: [
    //     {
    //       token:
    //         "cosmosnative|celestiatestnet|0x726f757465725f6170700000000000000000000000000001000000000000001a",
    //     },
    //   ],
    // },
    // {
    //   chainName: "celestiatestnet",
    //   standard: "CosmosNativeHypCollateral" as any,
    //   collateralAddressOrDenom: "utia",
    //   addressOrDenom:
    //     "0x726f757465725f6170700000000000000000000000000001000000000000001a",
    //   decimals: 6,
    //   name: "TIA",
    //   symbol: "TIA",
    //   logoURI: "/deployments/warp_routes/TIA/logo.svg",
    //   connections: [
    //     {
    //       token:
    //         "ethereum|edentestnet|0x43505da95A74Fa577FB9bB0Ce29E293FdF575011",
    //     },
    //   ],
    // },
  ],
  options: {
    interchainFeeConstants: [
      {
        origin: "celestia",
        destination: "arbitrum",
        amount: 27e4,
        addressOrDenom: "utia"
      },
      {
        origin: "celestia",
        destination: "mantapacific",
        amount: 27e4,
        addressOrDenom: "utia"
      },
      {
        origin: "celestia",
        destination: "eclipsemainnet",
        amount: 5e5,
        addressOrDenom: "utia"
      }
    ]
  }
};
async function Ec(e) {
  const t = aa.safeParse(Ic), n = ca(t, "warp core typescript config");
  let r;
  try {
    if (We.registryUrl)
      q.debug(
        "Using custom registry warp routes from:",
        We.registryUrl
      ), r = await e.getWarpRoutes();
    else
      throw new Error("No custom registry URL provided");
  } catch {
    q.debug("Using default published registry for warp routes"), r = _i;
  }
  const s = Object.values(r), i = s.map((g) => g.tokens).flat(), u = s.map((g) => g.options).flat(), d = [...i, ...n.tokens], h = kc(d), l = [...u, n.options], y = Sc(l);
  if (!h.length)
    throw new Error(
      "No warp route configs provided. Please check your registry, warp route whitelist, and custom route configs for issues."
    );
  return { tokens: h, options: y };
}
function kc(e) {
  const t = {};
  for (const n of e) {
    const r = `${n.chainName}|${n.addressOrDenom?.toLowerCase()}`;
    t[r] = pa(t[r] || {}, n);
  }
  return Object.values(t);
}
function Sc(e) {
  return e.reduce((t, n) => {
    if (!n || !t) return t;
    for (const r of Object.keys(n)) {
      const o = r, s = t[o], i = n[o];
      t[o] = (s || []).concat(
        i || []
      );
    }
    return t;
  }, {});
}
const vr = Tt()((e, t) => ({
  // Chains and providers
  chainMetadata: {},
  multiProvider: new Lt({}),
  registry: new ea({
    uri: "https://github.com/celestiaorg/hyperlane-ops"
  }),
  warpCore: new Vn(new Lt({}), []),
  setWarpContext: (n) => {
    q.debug("Setting warp context in store"), e(n);
  },
  initializeWarpContext: async () => {
    q.debug("Initializing warp context");
    try {
      const n = t(), r = await Tc(n);
      n.setWarpContext(r), q.debug("Warp context initialization complete");
    } catch (n) {
      q.error("Error during warp context initialization", n);
    }
  },
  originChainName: "",
  setOriginChainName: (n) => {
    e(() => ({ originChainName: n }));
  },
  tokensBySymbolChainMap: {},
  routerAddressesByChainMap: {}
}));
async function Tc({
  registry: e
}) {
  let t = e;
  try {
    await t.listRegistryContent();
  } catch (n) {
    t = new ta({
      chainAddresses: na,
      chainMetadata: qo
    }), q.warn(
      "Failed to list registry content using GithubRegistry, will continue with PartialRegistry.",
      n
    );
  }
  try {
    const n = await Ec(t), r = Array.from(
      new Set(n.tokens.map((l) => l.chainName))
    ), { chainMetadata: o, chainMetadataWithOverrides: s } = await vc(r, t), i = new Lt(s), u = Vn.FromConfig(i, n), d = dc(
      u.tokens,
      i
    ), h = Bc(
      n.tokens
    );
    return {
      registry: e,
      chainMetadata: o,
      multiProvider: i,
      warpCore: u,
      tokensBySymbolChainMap: d,
      routerAddressesByChainMap: h
    };
  } catch (n) {
    return q.error("Error initializing warp context", n), {
      registry: e,
      chainMetadata: {},
      multiProvider: new Lt({}),
      warpCore: new Vn(new Lt({}), []),
      tokensBySymbolChainMap: {},
      routerAddressesByChainMap: {}
    };
  }
}
function Bc(e) {
  return e.reduce((t, n) => (t[n.chainName] ||= /* @__PURE__ */ new Set(), n.addressOrDenom && t[n.chainName].add(n.addressOrDenom), t), {});
}
const $o = qi(null), Nc = ({
  children: e,
  connectWallet: t,
  isTestnet: n,
  defaultSourceChain: r,
  defaultSourceToken: o,
  defaultDestinationChain: s,
  defaultDestinationToken: i,
  defaultTab: u,
  showDefaultTabOnly: d,
  excludedChains: h,
  excludedTokens: l
}) => {
  const y = R(
    () => ({
      connectWallet: t,
      isTestnet: n,
      defaultSourceChain: r,
      defaultSourceToken: o,
      defaultDestinationChain: s,
      defaultDestinationToken: i,
      defaultTab: u,
      showDefaultTabOnly: d,
      excludedChains: h,
      excludedTokens: l
    }),
    [
      t,
      n,
      r,
      o,
      s,
      i,
      u,
      d,
      h,
      l
    ]
  );
  return /* @__PURE__ */ m($o.Provider, { value: y, children: e });
}, st = () => {
  const e = ut.useContext($o);
  if (!e)
    throw new Error(
      "useWidgetWalletClientContext must be used within a WidgetWalletConnectProvider"
    );
  return e;
};
function it() {
  return vr((e) => e.warpCore);
}
function Ir(e, t, n) {
  const r = it(), { excludedTokens: o } = st();
  if (!t || !n) return [];
  const s = r.tokens.filter(
    (y) => y.chainName === "edentestnet" || y.isMultiChainToken()
  ), i = r.getTokensForRoute(t, n), d = s.map((y) => ({
    token: y,
    disabled: !i.includes(y)
  })).filter((y) => We.showDisabledTokens ? !0 : !y.disabled).map((y) => y.token), { tokens: h } = hc(
    d,
    n
  );
  let l = h.map((y) => ({
    chainId: e.toString(),
    chainName: y.chainName,
    denom: y.addressOrDenom,
    originDenom: y.addressOrDenom,
    originChainId: e.toString(),
    symbol: y.symbol,
    logoUri: Cr.imgPath + y.logoURI || "",
    name: y.name,
    decimals: y.decimals,
    coingeckoId: y.coinGeckoId,
    tokenContract: y.collateralAddressOrDenom || y.addressOrDenom
  }));
  if (o?.length) {
    const y = new Set(o.map((g) => g.key));
    l = l.filter(
      (g) => !y.has(g.originDenom) && !y.has(g.denom)
    );
  }
  return l;
}
function un(e, t, n) {
  return t ? e.tokens.find(
    (o) => o.addressOrDenom === t && (n ? o.chainName === n : !0)
  ) : void 0;
}
function jt(e, t = !0) {
  const { excludedTokens: n } = st(), { data: r, isLoading: o, error: s } = Ce({
    queryKey: ["relayTokens"],
    enabled: t,
    queryFn: async () => {
      const u = await ze.getSupportedAssets({
        defaultList: !0,
        depositAddressOnly: !1
      });
      if (u?.success)
        return u.assets;
      throw new Error("Failed to fetch relay tokens");
    }
  });
  return {
    tokens: R(() => {
      const u = r;
      if (!u || !n?.length) return u;
      const d = new Set(n.map((h) => h.key));
      return Object.fromEntries(
        Object.entries(u).map(
          ([h, l]) => [
            h,
            l.filter(
              (y) => !d.has(y.originDenom) && !d.has(y.denom)
            )
          ]
        )
      );
    }, [r, e, n]),
    isLoading: o,
    error: s
  };
}
const Fc = (e) => {
  const { tokens: t } = jt(void 0, e === pe.FAST);
  return t || [];
};
function Nt() {
  return vr((e) => e.multiProvider);
}
function _o() {
  const e = Nt();
  if (e.getKnownChainNames().length)
    return e;
}
function ln() {
  const e = Nt(), { isTestnet: t, excludedChains: n } = st();
  return R(() => {
    const r = n?.length ? new Set(n.map((o) => o.key)) : null;
    return Object.values(e.metadata).filter(
      (o) => (t === void 0 || t === o.isTestnet) && // ChainsToDisplay.includes(String(v.chainId)) &&
      (!r || !r.has(String(o.chainId)))
    ).map((o) => ({
      chainId: String(o.chainId),
      name: o.name,
      displayName: o.displayName,
      logoURI: o.logoURI || "",
      bech32Prefix: o.bech32Prefix || "",
      chainType: o.protocol || void 0,
      icon: o.logoURI || "",
      baseDenom: o.nativeToken?.denom,
      nativeToken: o.nativeToken || void 0,
      isTestnet: o.isTestnet,
      explorerUrl: o?.blockExplorers?.[0].url || void 0,
      rpcUrl: o.rpcUrls?.[0]?.http,
      restUrl: o.restUrls?.[0].http
    }));
  }, [e.metadata, n, t]);
}
function Mc() {
  const e = Nt();
  return R(
    () => Object.values(e.metadata).filter(
      (t) => !t.isTestnet && Xo.includes(String(t.chainId))
    ),
    [e.metadata]
  );
}
function Et(e) {
  return ln().find((n) => n.chainId == e);
}
function Pe(e) {
  const t = _o();
  if (!t) return null;
  const n = Object.values(t.metadata).find((r) => r.chainId == e);
  return n ? n.name : null;
}
function Rc() {
  const e = Nt();
  return ie(
    (t) => {
      if (!t) return null;
      const n = Object.values(e.metadata).find((r) => r.chainId == t);
      return n ? n.name : null;
    },
    [e.metadata]
  );
}
function zc(e, t = !1) {
  const n = it(), r = Rc();
  return R(() => {
    if (t && n)
      return (o, s) => {
        const i = s || e, u = r(i);
        return u ? o.filter((d) => d.chainId === i ? !1 : n.getTokensForRoute(
          u,
          d.name
        ).length > 0) : [];
      };
  }, [n, r, e]);
}
const at = (e = !0) => {
  const { excludedChains: t } = st();
  return Ce({
    queryKey: ["relay-chains"],
    enabled: e,
    queryFn: async () => {
      const n = await ze.getSupportedChains();
      if (n.success) {
        const r = t?.length ? new Set(t.map((o) => o.key)) : null;
        return {
          chains: n.chains.filter(
            (o) => Xo.includes(o.chainId) && (!r || !r.has(o.chainId))
          ),
          _raw: n._raw
        };
      } else
        return {
          chains: [],
          _raw: []
        };
    }
  });
}, Uc = (e) => {
  const { data: t } = at(e === pe.FAST), n = ln(), { excludedChains: r } = st();
  return R(() => {
    let o = e === pe.FAST ? t?.chains || [] : n;
    if (r?.length) {
      const s = new Set(r.map((i) => i.key));
      o = o.filter((i) => !s.has(i.chainId));
    }
    return o;
  }, [e, t, n, r]);
};
function Dc(e, t) {
  const n = yr(e);
  $(() => {
    n.current = e;
  }, [e]), $(() => {
    const r = setTimeout(() => n.current(), t);
    return () => clearTimeout(r);
  }, [t]);
}
const Pc = 1e4;
function Lc({ children: e }) {
  const t = vr(
    (i) => i.initializeWarpContext
  ), n = !!_o(), r = yr(!1), [o, s] = he(!1);
  if (Dc(() => s(!0), Pc), $(() => {
    n || r.current || (r.current = !0, t().catch((i) => {
      console.error("Error initializing warp context:", i);
    }));
  }, [t, n]), !n && o)
    throw new Error(
      "Failed to initialize warp context. Please check your registry URL and connection status."
    );
  return /* @__PURE__ */ m(ye, { children: e });
}
const De = { duration: 0.15, type: "easeInOut" }, _e = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};
function Oc(e, t) {
  let n;
  try {
    n = e();
  } catch {
    return;
  }
  return {
    getItem: (o) => {
      var s;
      const i = (d) => d === null ? null : JSON.parse(d, void 0), u = (s = n.getItem(o)) != null ? s : null;
      return u instanceof Promise ? u.then(i) : i(u);
    },
    setItem: (o, s) => n.setItem(
      o,
      JSON.stringify(s, void 0)
    ),
    removeItem: (o) => n.removeItem(o)
  };
}
const Jn = (e) => (t) => {
  try {
    const n = e(t);
    return n instanceof Promise ? n : {
      then(r) {
        return Jn(r)(n);
      },
      catch(r) {
        return this;
      }
    };
  } catch (n) {
    return {
      then(r) {
        return this;
      },
      catch(r) {
        return Jn(r)(n);
      }
    };
  }
}, Gc = (e, t) => (n, r, o) => {
  let s = {
    storage: Oc(() => localStorage),
    partialize: (v) => v,
    version: 0,
    merge: (v, k) => ({
      ...k,
      ...v
    }),
    ...t
  }, i = !1;
  const u = /* @__PURE__ */ new Set(), d = /* @__PURE__ */ new Set();
  let h = s.storage;
  if (!h)
    return e(
      (...v) => {
        console.warn(
          `[zustand persist middleware] Unable to update item '${s.name}', the given storage is currently unavailable.`
        ), n(...v);
      },
      r,
      o
    );
  const l = () => {
    const v = s.partialize({ ...r() });
    return h.setItem(s.name, {
      state: v,
      version: s.version
    });
  }, y = o.setState;
  o.setState = (v, k) => {
    y(v, k), l();
  };
  const g = e(
    (...v) => {
      n(...v), l();
    },
    r,
    o
  );
  o.getInitialState = () => g;
  let b;
  const x = () => {
    var v, k;
    if (!h) return;
    i = !1, u.forEach((I) => {
      var F;
      return I((F = r()) != null ? F : g);
    });
    const A = ((k = s.onRehydrateStorage) == null ? void 0 : k.call(s, (v = r()) != null ? v : g)) || void 0;
    return Jn(h.getItem.bind(h))(s.name).then((I) => {
      if (I)
        if (typeof I.version == "number" && I.version !== s.version) {
          if (s.migrate)
            return [
              !0,
              s.migrate(
                I.state,
                I.version
              )
            ];
          console.error(
            "State loaded from storage couldn't be migrated since no migrate function was provided"
          );
        } else
          return [!1, I.state];
      return [!1, void 0];
    }).then((I) => {
      var F;
      const [B, M] = I;
      if (b = s.merge(
        M,
        (F = r()) != null ? F : g
      ), n(b, !0), B)
        return l();
    }).then(() => {
      A?.(b, void 0), b = r(), i = !0, d.forEach((I) => I(b));
    }).catch((I) => {
      A?.(void 0, I);
    });
  };
  return o.persist = {
    setOptions: (v) => {
      s = {
        ...s,
        ...v
      }, v.storage && (h = v.storage);
    },
    clearStorage: () => {
      h?.removeItem(s.name);
    },
    getOptions: () => s,
    rehydrate: () => x(),
    hasHydrated: () => i,
    onHydrate: (v) => (u.add(v), () => {
      u.delete(v);
    }),
    onFinishHydration: (v) => (d.add(v), () => {
      d.delete(v);
    })
  }, s.skipHydration || x(), b || g;
}, Er = Gc, Vc = {
  tab: pe.FAST
}, Ft = Tt(
  Er(
    (e, t) => ({
      inputState: Vc,
      setInputState: (n) => e((r) => ({
        inputState: { ...r.inputState, ...n }
      }))
    }),
    {
      name: "global-state:v1",
      partialize: (e) => ({
        inputState: {
          tab: e.inputState.tab
        },
        setInputState: e.setInputState
      })
    }
  )
), Sn = {
  screen: "home",
  from: {
    chain: {
      key: "mocha-4",
      displayName: "Celestia Testnet",
      logoURI: It("/chains/celestiatestnet/logo.svg") || void 0
    },
    token: void 0,
    amount: ""
  },
  to: {
    chain: {
      key: "3735928814",
      displayName: "Eden Testnet",
      logoURI: It("/chains/edentestnet/logo.svg") || void 0
    },
    token: void 0,
    amount: ""
  },
  amountDisplayFormat: Q.TOKEN
}, W = Tt(
  Er(
    (e) => ({
      state: Sn,
      setScreen: (t) => e((n) => ({
        state: { ...n.state, screen: t }
      })),
      setFromChain: (t) => e((n) => ({
        state: { ...n.state, from: { ...n.state.from, chain: t } }
      })),
      setToChain: (t) => e((n) => ({
        state: { ...n.state, to: { ...n.state.to, chain: t } }
      })),
      switchChains: () => e((t) => ({
        state: {
          ...t.state,
          from: {
            ...t.state.from,
            chain: t.state.to.chain
          },
          to: { ...t.state.to, chain: t.state.from.chain }
        }
      })),
      setFromToken: (t) => e((n) => ({
        state: { ...n.state, from: { ...n.state.from, token: t } }
      })),
      setToToken: (t) => e((n) => ({
        state: { ...n.state, to: { ...n.state.to, token: t } }
      })),
      switchTokens: () => e((t) => ({
        state: {
          ...t.state,
          from: { ...t.state.from, token: t.state.to.token },
          to: { ...t.state.to, token: t.state.from.token }
        }
      })),
      setFromAmount: (t) => e((n) => ({
        state: { ...n.state, from: { ...n.state.from, amount: t } }
      })),
      swapSides: () => e((t) => ({
        state: {
          ...t.state,
          from: t.state.to,
          to: t.state.from
        }
      })),
      setToAddress: (t) => e((n) => ({
        state: { ...n.state, to: { ...n.state.to, address: t } }
      })),
      setAmountDisplayFormat: (t) => e((n) => ({
        state: { ...n.state, amountDisplayFormat: t }
      }))
    }),
    {
      name: "hyperlane-flow-state:v1",
      merge: (e, t) => {
        const n = {
          ...t,
          ...typeof e == "object" && e !== null ? e : {}
        }, r = n.state;
        if (r) {
          const o = r.from?.chain?.key ? r.from.chain : Sn.from.chain, s = r.to?.chain?.key ? r.to.chain : Sn.to.chain;
          n.state = {
            ...r,
            from: { ...r.from, chain: o },
            to: { ...r.to, chain: s }
          };
        }
        return n;
      },
      partialize: (e) => ({
        state: {
          ...e.state,
          from: { ...e.state.from, amount: "" },
          to: { ...e.state.to, amount: "" }
        },
        setScreen: e.setScreen,
        setFromChain: e.setFromChain,
        setToChain: e.setToChain,
        switchChains: e.switchChains,
        setFromToken: e.setFromToken,
        setToToken: e.setToToken,
        switchTokens: e.switchTokens,
        setFromAmount: e.setFromAmount,
        swapSides: e.swapSides,
        setToAddress: e.setToAddress,
        setAmountDisplayFormat: e.setAmountDisplayFormat
      })
    }
  )
), es = ({ message: e, subtext: t, icon: n = null, className: r }) => /* @__PURE__ */ S("div", { className: "text-foreground [&>svg]:text-foreground bg-background-2/40 rounded-md2 mx-auto flex h-auto w-fit flex-none flex-col items-center px-20 py-12 backdrop-blur-sm", children: [
  /* @__PURE__ */ m("div", { className: "bg-secondary flex size-16 items-center justify-center rounded-full [&>svg]:size-6", children: n }),
  /* @__PURE__ */ m(
    "h2",
    {
      className: se(
        "text-center text-lg font-bold break-all",
        !!n && "mt-4",
        r
      ),
      children: e
    }
  ),
  t ? /* @__PURE__ */ m("p", { className: "mt-3 max-w-3xs text-center text-sm", children: t }) : null
] }), ho = ({ message: e, subtext: t, icon: n = null, className: r }) => /* @__PURE__ */ S("div", { className: "text-foreground [&>svg]:text-foreground mt-2 flex flex-col items-center justify-center", children: [
  /* @__PURE__ */ m("div", { className: "bg-secondary flex size-16 items-center justify-center rounded-full [&>svg]:size-6", children: n }),
  /* @__PURE__ */ m(
    "h2",
    {
      className: se(
        "text-center text-lg font-bold break-all",
        !!n && "mt-4",
        r
      ),
      children: e
    }
  ),
  t ? /* @__PURE__ */ m("p", { className: "mt-3 max-w-3xs text-center text-sm", children: t }) : null
] }), ts = ({ fromToken: e }) => /* @__PURE__ */ m("div", { className: "text-xs", children: `1 ${e?.symbol} = 1 ${e?.symbol}` }), Wc = Ca(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive rounded-full cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        glass: "bg-foreground/20 hover:bg-foreground/25",
        ghost: "hover:bg-foreground/10 hover:text-accent-foreground dark:hover:bg-foreground/10",
        mono: "bg-foreground hover:bg-foreground/90 text-background disabled:opacity-75",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        xs: "h-6 gap-1 px-2 has-[>svg]:px-1.5",
        lg: "h-14 px-6 has-[>svg]:px-4 font-bold text-[1.125rem]",
        icon: "size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
), oe = gr.forwardRef(function({ className: t, variant: n, size: r, asChild: o = !1, ...s }, i) {
  return /* @__PURE__ */ m(
    o ? Aa : "button",
    {
      ref: i,
      "data-slot": "button",
      className: se(Wc({ variant: n, size: r, className: t })),
      ...s
    }
  );
});
oe.displayName = "Button";
const Zc = ({
  className: e
}) => {
  const t = W((n) => n.setScreen);
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ S("div", { className: "mb-4 flex items-center gap-2 text-foreground", children: [
      /* @__PURE__ */ m(
        "button",
        {
          type: "button",
          onClick: () => t("home"),
          "aria-label": "Back",
          className: "text-foreground/80 hover:bg-foreground/10 rounded-full p-1",
          children: /* @__PURE__ */ m(Bt, { className: "size-4 text-foreground" })
        }
      ),
      /* @__PURE__ */ m("div", { className: "text-sm font-semibold", children: "Back" })
    ] }),
    /* @__PURE__ */ m(
      es,
      {
        icon: /* @__PURE__ */ m(Yo, { className: "size-8 text-red-500" }),
        message: "Transaction Failed",
        subtext: "Something went wrong during the transaction. Please try again."
      }
    ),
    /* @__PURE__ */ m(
      oe,
      {
        className: "mt-auto w-full",
        size: "lg",
        onClick: () => t("home"),
        children: "Try Again"
      }
    )
  ] });
};
function Jc(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var ns = { exports: {} }, re = ns.exports = {}, Me, Re;
function qn() {
  throw new Error("setTimeout has not been defined");
}
function jn() {
  throw new Error("clearTimeout has not been defined");
}
(function() {
  try {
    typeof setTimeout == "function" ? Me = setTimeout : Me = qn;
  } catch {
    Me = qn;
  }
  try {
    typeof clearTimeout == "function" ? Re = clearTimeout : Re = jn;
  } catch {
    Re = jn;
  }
})();
function rs(e) {
  if (Me === setTimeout)
    return setTimeout(e, 0);
  if ((Me === qn || !Me) && setTimeout)
    return Me = setTimeout, setTimeout(e, 0);
  try {
    return Me(e, 0);
  } catch {
    try {
      return Me.call(null, e, 0);
    } catch {
      return Me.call(this, e, 0);
    }
  }
}
function qc(e) {
  if (Re === clearTimeout)
    return clearTimeout(e);
  if ((Re === jn || !Re) && clearTimeout)
    return Re = clearTimeout, clearTimeout(e);
  try {
    return Re(e);
  } catch {
    try {
      return Re.call(null, e);
    } catch {
      return Re.call(this, e);
    }
  }
}
var Ze = [], At = !1, dt, $t = -1;
function jc() {
  !At || !dt || (At = !1, dt.length ? Ze = dt.concat(Ze) : $t = -1, Ze.length && os());
}
function os() {
  if (!At) {
    var e = rs(jc);
    At = !0;
    for (var t = Ze.length; t; ) {
      for (dt = Ze, Ze = []; ++$t < t; )
        dt && dt[$t].run();
      $t = -1, t = Ze.length;
    }
    dt = null, At = !1, qc(e);
  }
}
re.nextTick = function(e) {
  var t = new Array(arguments.length - 1);
  if (arguments.length > 1)
    for (var n = 1; n < arguments.length; n++)
      t[n - 1] = arguments[n];
  Ze.push(new ss(e, t)), Ze.length === 1 && !At && rs(os);
};
function ss(e, t) {
  this.fun = e, this.array = t;
}
ss.prototype.run = function() {
  this.fun.apply(null, this.array);
};
re.title = "browser";
re.browser = !0;
re.env = {};
re.argv = [];
re.version = "";
re.versions = {};
function Ye() {
}
re.on = Ye;
re.addListener = Ye;
re.once = Ye;
re.off = Ye;
re.removeListener = Ye;
re.removeAllListeners = Ye;
re.emit = Ye;
re.prependListener = Ye;
re.prependOnceListener = Ye;
re.listeners = function(e) {
  return [];
};
re.binding = function(e) {
  throw new Error("process.binding is not supported");
};
re.cwd = function() {
  return "/";
};
re.chdir = function(e) {
  throw new Error("process.chdir is not supported");
};
re.umask = function() {
  return 0;
};
var Yc = ns.exports;
const is = /* @__PURE__ */ Jc(Yc);
`${is.env.NEXT_PUBLIC_APP_DOMAIN}`;
is.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
const Kc = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bytes", name: "callData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Call[]",
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "aggregate",
    outputs: [
      { internalType: "uint256", name: "blockNumber", type: "uint256" },
      { internalType: "bytes[]", name: "returnData", type: "bytes[]" }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bool", name: "allowFailure", type: "bool" },
          { internalType: "bytes", name: "callData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Call3[]",
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "success", type: "bool" },
          { internalType: "bytes", name: "returnData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Result[]",
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bool", name: "allowFailure", type: "bool" },
          { internalType: "uint256", name: "value", type: "uint256" },
          { internalType: "bytes", name: "callData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Call3Value[]",
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "aggregate3Value",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "success", type: "bool" },
          { internalType: "bytes", name: "returnData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Result[]",
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bytes", name: "callData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Call[]",
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "blockAndAggregate",
    outputs: [
      { internalType: "uint256", name: "blockNumber", type: "uint256" },
      { internalType: "bytes32", name: "blockHash", type: "bytes32" },
      {
        components: [
          { internalType: "bool", name: "success", type: "bool" },
          { internalType: "bytes", name: "returnData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Result[]",
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [],
    name: "getBasefee",
    outputs: [{ internalType: "uint256", name: "basefee", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "blockNumber", type: "uint256" }],
    name: "getBlockHash",
    outputs: [{ internalType: "bytes32", name: "blockHash", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getBlockNumber",
    outputs: [
      { internalType: "uint256", name: "blockNumber", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getChainId",
    outputs: [{ internalType: "uint256", name: "chainid", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getCurrentBlockCoinbase",
    outputs: [{ internalType: "address", name: "coinbase", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getCurrentBlockDifficulty",
    outputs: [{ internalType: "uint256", name: "difficulty", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getCurrentBlockGasLimit",
    outputs: [{ internalType: "uint256", name: "gaslimit", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getCurrentBlockTimestamp",
    outputs: [{ internalType: "uint256", name: "timestamp", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "addr", type: "address" }],
    name: "getEthBalance",
    outputs: [{ internalType: "uint256", name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getLastBlockHash",
    outputs: [{ internalType: "bytes32", name: "blockHash", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bool", name: "requireSuccess", type: "bool" },
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bytes", name: "callData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Call[]",
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "tryAggregate",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "success", type: "bool" },
          { internalType: "bytes", name: "returnData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Result[]",
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bool", name: "requireSuccess", type: "bool" },
      {
        components: [
          { internalType: "address", name: "target", type: "address" },
          { internalType: "bytes", name: "callData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Call[]",
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "tryBlockAndAggregate",
    outputs: [
      { internalType: "uint256", name: "blockNumber", type: "uint256" },
      { internalType: "bytes32", name: "blockHash", type: "bytes32" },
      {
        components: [
          { internalType: "bool", name: "success", type: "bool" },
          { internalType: "bytes", name: "returnData", type: "bytes" }
        ],
        internalType: "struct Multicall3.Result[]",
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "payable",
    type: "function"
  }
], ct = Tt((e) => ({
  cosmos: null,
  evm: null,
  solana: null,
  isConnected: !1,
  setAddress: (t) => e((n) => {
    const { chain: r, address: o } = t;
    if (n[r] === o) return n;
    const s = {
      ...n,
      [r]: o
    }, i = !!s.cosmos && Object.values(s.cosmos).some(Boolean) || !!s.evm || !!s.solana;
    return {
      ...s,
      isConnected: i
    };
  })
})), mo = "0x0000000000000000000000000000000000000000", Qc = ({
  chainId: e,
  assets: t,
  chainMetadata: n,
  enabled: r = !1
}) => {
  const { address: o } = Jt(), s = Na({
    chainId: r && e ? Number(e) : void 0
  });
  return Ce({
    queryKey: ["evmChainBalances", e, o, t?.length],
    queryFn: async () => {
      if (!s || !t || !o || !e)
        throw new Error("Missing required parameters");
      const u = e === "984122" ? "0xd53C6FFB123F7349A32980F87faeD8FfDc9ef079" : "0xcA11bde05977b3631167028862bE2a173976CA11";
      if (t?.some(
        (g) => g.chainName === "edentestnet"
      )) {
        const g = await s.getBalance({
          address: o
        }), b = {};
        for (const x of t ?? [])
          if (x.originDenom.includes("native") || !x.originDenom || x.originDenom === mo)
            b[x.originDenom] = {
              value: g.toString(),
              amount: new X(g.toString()).dividedBy(
                Ot(x.decimals)
              )
            };
          else
            try {
              const v = await s.readContract({
                address: x.originDenom,
                abi: ao,
                functionName: "balanceOf",
                args: [o]
              });
              b[x.originDenom] = {
                value: v.toString(),
                amount: new X(v.toString()).dividedBy(
                  Ot(x.decimals)
                )
              };
            } catch {
              b[x.originDenom] = {
                value: "0",
                amount: new X(0)
              };
            }
        return {
          chainId: e,
          balances: b
        };
      }
      const h = t?.map((g) => g.originDenom.includes("native") || !g.originDenom || g.originDenom === mo ? {
        address: u,
        abi: Kc,
        functionName: "getEthBalance",
        args: [o]
      } : {
        address: g.originDenom,
        abi: ao,
        functionName: "balanceOf",
        args: [o]
      }) ?? [], l = await s.multicall({
        multicallAddress: u,
        contracts: h
      }), y = t?.reduce(
        (g, b, x) => (g[b.originDenom] = {
          value: l[x].result?.toString() || "0",
          amount: new X(
            l[x].result?.toString() || "0"
          ).dividedBy(Ot(b.decimals))
        }, g),
        {}
      );
      return {
        chainId: e,
        balances: y
      };
    },
    retry: !1,
    enabled: !!(e && o && s && t && r),
    refetchInterval: 3e4
  });
}, Hc = ({
  chainId: e,
  assets: t,
  chainMetadata: n,
  enabled: r = !1
}) => {
  const { solana: o } = ct(), s = o;
  return Ce({
    queryKey: [
      "svmChainBalances",
      e,
      s,
      t?.length,
      n?.rpcUrl
    ],
    queryFn: async () => {
      if (!e || !s || !t || !n)
        throw new Error("Missing required parameters");
      const i = n.chainId === "solana" || n.chainId == "1399811149" ? "https://mainnet.helius-rpc.com/?api-key=5175da47-fc80-456d-81e2-81e6e7459f73" : n?.rpcUrl, u = new wr(i), d = await u.getBalance(new Zn(s)), h = {};
      h["11111111111111111111111111111111"] = d.toString(), (await u.getTokenAccountsByOwner(
        new Zn(s),
        { programId: io.TOKEN_PROGRAM_ID }
      )).value.forEach((g) => {
        const b = io.AccountLayout.decode(
          g.account.data
        ), x = b.mint.toBase58();
        h[x] = b.amount.toString();
      });
      const y = t?.reduce(
        (g, b) => {
          const x = b.tokenContract || b.originDenom;
          return g[b.originDenom] = {
            value: h[x] || "0",
            amount: new X(h[x] || "0").dividedBy(
              Ot(b.decimals)
            )
          }, g;
        },
        {}
      );
      return {
        chainId: e,
        balances: y
      };
    },
    retry: !1,
    enabled: !!(e && s && t && r),
    refetchOnWindowFocus: !1,
    refetchInterval: 3e4
  });
}, Xc = ({
  chainId: e,
  assets: t,
  chainMetadata: n,
  enabled: r = !1
}) => {
  const { cosmos: o } = ct(), s = o?.[e];
  return Ce({
    queryKey: [
      "cosmosChainBalances",
      e,
      s,
      t?.length,
      n
    ],
    queryFn: async () => {
      if (!e || !s || !t || !n)
        throw new Error("Missing required parameters");
      const i = n?.restUrl, u = {}, d = await fetch(
        `${i}/cosmos/bank/v1beta1/spendable_balances/${s}?pagination.limit=250`
      ), { balances: h } = await d.json();
      h.forEach((y) => {
        u[y.denom] = y.amount;
      });
      const l = t?.reduce(
        (y, g) => {
          const b = g.tokenContract || g.originDenom;
          return y[g.originDenom] = {
            value: u[b] || "0",
            amount: new X(u[b] || "0").dividedBy(
              Ot(g.decimals)
            )
          }, y;
        },
        {}
      );
      return {
        chainId: e,
        balances: l
      };
    },
    retry: !1,
    enabled: !!(e && s && t && r),
    refetchOnWindowFocus: !1,
    refetchInterval: 3e4
  });
}, dn = ({
  chainId: e,
  assets: t
}, n = !0) => {
  const { inputState: r } = Ft(), s = Uc(r.tab).find((l) => l.chainId === e), i = Fc(r.tab);
  t = t || i?.[e.toString()] || [];
  const u = Xc({
    chainId: e,
    assets: t,
    chainMetadata: s,
    enabled: n && s?.chainType === D.Cosmos || s?.chainType === D.CosmosNative
  }), d = Qc({
    chainId: e,
    assets: t,
    chainMetadata: s,
    enabled: n && s?.chainType === D.Ethereum
  }), h = Hc({
    chainId: e,
    assets: t,
    chainMetadata: s,
    enabled: n && s?.chainType === D.Sealevel
  });
  return s?.chainType === D.Cosmos || s?.chainType === D.CosmosNative ? u : s?.chainType === D.Ethereum ? d : h;
};
var as = {}, fn = {};
fn.byteLength = eu;
fn.toByteArray = nu;
fn.fromByteArray = su;
var Ue = [], xe = [], $c = typeof Uint8Array < "u" ? Uint8Array : Array, Tn = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (var yt = 0, _c = Tn.length; yt < _c; ++yt)
  Ue[yt] = Tn[yt], xe[Tn.charCodeAt(yt)] = yt;
xe[45] = 62;
xe[95] = 63;
function cs(e) {
  var t = e.length;
  if (t % 4 > 0)
    throw new Error("Invalid string. Length must be a multiple of 4");
  var n = e.indexOf("=");
  n === -1 && (n = t);
  var r = n === t ? 0 : 4 - n % 4;
  return [n, r];
}
function eu(e) {
  var t = cs(e), n = t[0], r = t[1];
  return (n + r) * 3 / 4 - r;
}
function tu(e, t, n) {
  return (t + n) * 3 / 4 - n;
}
function nu(e) {
  var t, n = cs(e), r = n[0], o = n[1], s = new $c(tu(e, r, o)), i = 0, u = o > 0 ? r - 4 : r, d;
  for (d = 0; d < u; d += 4)
    t = xe[e.charCodeAt(d)] << 18 | xe[e.charCodeAt(d + 1)] << 12 | xe[e.charCodeAt(d + 2)] << 6 | xe[e.charCodeAt(d + 3)], s[i++] = t >> 16 & 255, s[i++] = t >> 8 & 255, s[i++] = t & 255;
  return o === 2 && (t = xe[e.charCodeAt(d)] << 2 | xe[e.charCodeAt(d + 1)] >> 4, s[i++] = t & 255), o === 1 && (t = xe[e.charCodeAt(d)] << 10 | xe[e.charCodeAt(d + 1)] << 4 | xe[e.charCodeAt(d + 2)] >> 2, s[i++] = t >> 8 & 255, s[i++] = t & 255), s;
}
function ru(e) {
  return Ue[e >> 18 & 63] + Ue[e >> 12 & 63] + Ue[e >> 6 & 63] + Ue[e & 63];
}
function ou(e, t, n) {
  for (var r, o = [], s = t; s < n; s += 3)
    r = (e[s] << 16 & 16711680) + (e[s + 1] << 8 & 65280) + (e[s + 2] & 255), o.push(ru(r));
  return o.join("");
}
function su(e) {
  for (var t, n = e.length, r = n % 3, o = [], s = 16383, i = 0, u = n - r; i < u; i += s)
    o.push(ou(e, i, i + s > u ? u : i + s));
  return r === 1 ? (t = e[n - 1], o.push(
    Ue[t >> 2] + Ue[t << 4 & 63] + "=="
  )) : r === 2 && (t = (e[n - 2] << 8) + e[n - 1], o.push(
    Ue[t >> 10] + Ue[t >> 4 & 63] + Ue[t << 2 & 63] + "="
  )), o.join("");
}
var kr = {};
kr.read = function(e, t, n, r, o) {
  var s, i, u = o * 8 - r - 1, d = (1 << u) - 1, h = d >> 1, l = -7, y = n ? o - 1 : 0, g = n ? -1 : 1, b = e[t + y];
  for (y += g, s = b & (1 << -l) - 1, b >>= -l, l += u; l > 0; s = s * 256 + e[t + y], y += g, l -= 8)
    ;
  for (i = s & (1 << -l) - 1, s >>= -l, l += r; l > 0; i = i * 256 + e[t + y], y += g, l -= 8)
    ;
  if (s === 0)
    s = 1 - h;
  else {
    if (s === d)
      return i ? NaN : (b ? -1 : 1) * (1 / 0);
    i = i + Math.pow(2, r), s = s - h;
  }
  return (b ? -1 : 1) * i * Math.pow(2, s - r);
};
kr.write = function(e, t, n, r, o, s) {
  var i, u, d, h = s * 8 - o - 1, l = (1 << h) - 1, y = l >> 1, g = o === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, b = r ? 0 : s - 1, x = r ? 1 : -1, v = t < 0 || t === 0 && 1 / t < 0 ? 1 : 0;
  for (t = Math.abs(t), isNaN(t) || t === 1 / 0 ? (u = isNaN(t) ? 1 : 0, i = l) : (i = Math.floor(Math.log(t) / Math.LN2), t * (d = Math.pow(2, -i)) < 1 && (i--, d *= 2), i + y >= 1 ? t += g / d : t += g * Math.pow(2, 1 - y), t * d >= 2 && (i++, d /= 2), i + y >= l ? (u = 0, i = l) : i + y >= 1 ? (u = (t * d - 1) * Math.pow(2, o), i = i + y) : (u = t * Math.pow(2, y - 1) * Math.pow(2, o), i = 0)); o >= 8; e[n + b] = u & 255, b += x, u /= 256, o -= 8)
    ;
  for (i = i << o | u, h += o; h > 0; e[n + b] = i & 255, b += x, i /= 256, h -= 8)
    ;
  e[n + b - x] |= v * 128;
};
(function(e) {
  const t = fn, n = kr, r = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom") : null;
  e.Buffer = l, e.SlowBuffer = M, e.INSPECT_MAX_BYTES = 50;
  const o = 2147483647;
  e.kMaxLength = o;
  const { Uint8Array: s, ArrayBuffer: i, SharedArrayBuffer: u } = globalThis;
  l.TYPED_ARRAY_SUPPORT = d(), !l.TYPED_ARRAY_SUPPORT && typeof console < "u" && typeof console.error == "function" && console.error(
    "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
  );
  function d() {
    try {
      const f = new s(1), a = { foo: function() {
        return 42;
      } };
      return Object.setPrototypeOf(a, s.prototype), Object.setPrototypeOf(f, a), f.foo() === 42;
    } catch {
      return !1;
    }
  }
  Object.defineProperty(l.prototype, "parent", {
    enumerable: !0,
    get: function() {
      if (l.isBuffer(this))
        return this.buffer;
    }
  }), Object.defineProperty(l.prototype, "offset", {
    enumerable: !0,
    get: function() {
      if (l.isBuffer(this))
        return this.byteOffset;
    }
  });
  function h(f) {
    if (f > o)
      throw new RangeError('The value "' + f + '" is invalid for option "size"');
    const a = new s(f);
    return Object.setPrototypeOf(a, l.prototype), a;
  }
  function l(f, a, c) {
    if (typeof f == "number") {
      if (typeof a == "string")
        throw new TypeError(
          'The "string" argument must be of type string. Received type number'
        );
      return x(f);
    }
    return y(f, a, c);
  }
  l.poolSize = 8192;
  function y(f, a, c) {
    if (typeof f == "string")
      return v(f, a);
    if (i.isView(f))
      return A(f);
    if (f == null)
      throw new TypeError(
        "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof f
      );
    if (Ne(f, i) || f && Ne(f.buffer, i) || typeof u < "u" && (Ne(f, u) || f && Ne(f.buffer, u)))
      return I(f, a, c);
    if (typeof f == "number")
      throw new TypeError(
        'The "value" argument must not be of type number. Received type number'
      );
    const p = f.valueOf && f.valueOf();
    if (p != null && p !== f)
      return l.from(p, a, c);
    const w = F(f);
    if (w) return w;
    if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof f[Symbol.toPrimitive] == "function")
      return l.from(f[Symbol.toPrimitive]("string"), a, c);
    throw new TypeError(
      "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof f
    );
  }
  l.from = function(f, a, c) {
    return y(f, a, c);
  }, Object.setPrototypeOf(l.prototype, s.prototype), Object.setPrototypeOf(l, s);
  function g(f) {
    if (typeof f != "number")
      throw new TypeError('"size" argument must be of type number');
    if (f < 0)
      throw new RangeError('The value "' + f + '" is invalid for option "size"');
  }
  function b(f, a, c) {
    return g(f), f <= 0 ? h(f) : a !== void 0 ? typeof c == "string" ? h(f).fill(a, c) : h(f).fill(a) : h(f);
  }
  l.alloc = function(f, a, c) {
    return b(f, a, c);
  };
  function x(f) {
    return g(f), h(f < 0 ? 0 : B(f) | 0);
  }
  l.allocUnsafe = function(f) {
    return x(f);
  }, l.allocUnsafeSlow = function(f) {
    return x(f);
  };
  function v(f, a) {
    if ((typeof a != "string" || a === "") && (a = "utf8"), !l.isEncoding(a))
      throw new TypeError("Unknown encoding: " + a);
    const c = T(f, a) | 0;
    let p = h(c);
    const w = p.write(f, a);
    return w !== c && (p = p.slice(0, w)), p;
  }
  function k(f) {
    const a = f.length < 0 ? 0 : B(f.length) | 0, c = h(a);
    for (let p = 0; p < a; p += 1)
      c[p] = f[p] & 255;
    return c;
  }
  function A(f) {
    if (Ne(f, s)) {
      const a = new s(f);
      return I(a.buffer, a.byteOffset, a.byteLength);
    }
    return k(f);
  }
  function I(f, a, c) {
    if (a < 0 || f.byteLength < a)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (f.byteLength < a + (c || 0))
      throw new RangeError('"length" is outside of buffer bounds');
    let p;
    return a === void 0 && c === void 0 ? p = new s(f) : c === void 0 ? p = new s(f, a) : p = new s(f, a, c), Object.setPrototypeOf(p, l.prototype), p;
  }
  function F(f) {
    if (l.isBuffer(f)) {
      const a = B(f.length) | 0, c = h(a);
      return c.length === 0 || f.copy(c, 0, 0, a), c;
    }
    if (f.length !== void 0)
      return typeof f.length != "number" || En(f.length) ? h(0) : k(f);
    if (f.type === "Buffer" && Array.isArray(f.data))
      return k(f.data);
  }
  function B(f) {
    if (f >= o)
      throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + o.toString(16) + " bytes");
    return f | 0;
  }
  function M(f) {
    return +f != f && (f = 0), l.alloc(+f);
  }
  l.isBuffer = function(a) {
    return a != null && a._isBuffer === !0 && a !== l.prototype;
  }, l.compare = function(a, c) {
    if (Ne(a, s) && (a = l.from(a, a.offset, a.byteLength)), Ne(c, s) && (c = l.from(c, c.offset, c.byteLength)), !l.isBuffer(a) || !l.isBuffer(c))
      throw new TypeError(
        'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
      );
    if (a === c) return 0;
    let p = a.length, w = c.length;
    for (let C = 0, E = Math.min(p, w); C < E; ++C)
      if (a[C] !== c[C]) {
        p = a[C], w = c[C];
        break;
      }
    return p < w ? -1 : w < p ? 1 : 0;
  }, l.isEncoding = function(a) {
    switch (String(a).toLowerCase()) {
      case "hex":
      case "utf8":
      case "utf-8":
      case "ascii":
      case "latin1":
      case "binary":
      case "base64":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return !0;
      default:
        return !1;
    }
  }, l.concat = function(a, c) {
    if (!Array.isArray(a))
      throw new TypeError('"list" argument must be an Array of Buffers');
    if (a.length === 0)
      return l.alloc(0);
    let p;
    if (c === void 0)
      for (c = 0, p = 0; p < a.length; ++p)
        c += a[p].length;
    const w = l.allocUnsafe(c);
    let C = 0;
    for (p = 0; p < a.length; ++p) {
      let E = a[p];
      if (Ne(E, s))
        C + E.length > w.length ? (l.isBuffer(E) || (E = l.from(E)), E.copy(w, C)) : s.prototype.set.call(
          w,
          E,
          C
        );
      else if (l.isBuffer(E))
        E.copy(w, C);
      else
        throw new TypeError('"list" argument must be an Array of Buffers');
      C += E.length;
    }
    return w;
  };
  function T(f, a) {
    if (l.isBuffer(f))
      return f.length;
    if (i.isView(f) || Ne(f, i))
      return f.byteLength;
    if (typeof f != "string")
      throw new TypeError(
        'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof f
      );
    const c = f.length, p = arguments.length > 2 && arguments[2] === !0;
    if (!p && c === 0) return 0;
    let w = !1;
    for (; ; )
      switch (a) {
        case "ascii":
        case "latin1":
        case "binary":
          return c;
        case "utf8":
        case "utf-8":
          return In(f).length;
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return c * 2;
        case "hex":
          return c >>> 1;
        case "base64":
          return _r(f).length;
        default:
          if (w)
            return p ? -1 : In(f).length;
          a = ("" + a).toLowerCase(), w = !0;
      }
  }
  l.byteLength = T;
  function U(f, a, c) {
    let p = !1;
    if ((a === void 0 || a < 0) && (a = 0), a > this.length || ((c === void 0 || c > this.length) && (c = this.length), c <= 0) || (c >>>= 0, a >>>= 0, c <= a))
      return "";
    for (f || (f = "utf8"); ; )
      switch (f) {
        case "hex":
          return Ui(this, a, c);
        case "utf8":
        case "utf-8":
          return Oe(this, a, c);
        case "ascii":
          return Yt(this, a, c);
        case "latin1":
        case "binary":
          return zi(this, a, c);
        case "base64":
          return ae(this, a, c);
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return Di(this, a, c);
        default:
          if (p) throw new TypeError("Unknown encoding: " + f);
          f = (f + "").toLowerCase(), p = !0;
      }
  }
  l.prototype._isBuffer = !0;
  function z(f, a, c) {
    const p = f[a];
    f[a] = f[c], f[c] = p;
  }
  l.prototype.swap16 = function() {
    const a = this.length;
    if (a % 2 !== 0)
      throw new RangeError("Buffer size must be a multiple of 16-bits");
    for (let c = 0; c < a; c += 2)
      z(this, c, c + 1);
    return this;
  }, l.prototype.swap32 = function() {
    const a = this.length;
    if (a % 4 !== 0)
      throw new RangeError("Buffer size must be a multiple of 32-bits");
    for (let c = 0; c < a; c += 4)
      z(this, c, c + 3), z(this, c + 1, c + 2);
    return this;
  }, l.prototype.swap64 = function() {
    const a = this.length;
    if (a % 8 !== 0)
      throw new RangeError("Buffer size must be a multiple of 64-bits");
    for (let c = 0; c < a; c += 8)
      z(this, c, c + 7), z(this, c + 1, c + 6), z(this, c + 2, c + 5), z(this, c + 3, c + 4);
    return this;
  }, l.prototype.toString = function() {
    const a = this.length;
    return a === 0 ? "" : arguments.length === 0 ? Oe(this, 0, a) : U.apply(this, arguments);
  }, l.prototype.toLocaleString = l.prototype.toString, l.prototype.equals = function(a) {
    if (!l.isBuffer(a)) throw new TypeError("Argument must be a Buffer");
    return this === a ? !0 : l.compare(this, a) === 0;
  }, l.prototype.inspect = function() {
    let a = "";
    const c = e.INSPECT_MAX_BYTES;
    return a = this.toString("hex", 0, c).replace(/(.{2})/g, "$1 ").trim(), this.length > c && (a += " ... "), "<Buffer " + a + ">";
  }, r && (l.prototype[r] = l.prototype.inspect), l.prototype.compare = function(a, c, p, w, C) {
    if (Ne(a, s) && (a = l.from(a, a.offset, a.byteLength)), !l.isBuffer(a))
      throw new TypeError(
        'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof a
      );
    if (c === void 0 && (c = 0), p === void 0 && (p = a ? a.length : 0), w === void 0 && (w = 0), C === void 0 && (C = this.length), c < 0 || p > a.length || w < 0 || C > this.length)
      throw new RangeError("out of range index");
    if (w >= C && c >= p)
      return 0;
    if (w >= C)
      return -1;
    if (c >= p)
      return 1;
    if (c >>>= 0, p >>>= 0, w >>>= 0, C >>>= 0, this === a) return 0;
    let E = C - w, G = p - c;
    const ee = Math.min(E, G), H = this.slice(w, C), te = a.slice(c, p);
    for (let K = 0; K < ee; ++K)
      if (H[K] !== te[K]) {
        E = H[K], G = te[K];
        break;
      }
    return E < G ? -1 : G < E ? 1 : 0;
  };
  function P(f, a, c, p, w) {
    if (f.length === 0) return -1;
    if (typeof c == "string" ? (p = c, c = 0) : c > 2147483647 ? c = 2147483647 : c < -2147483648 && (c = -2147483648), c = +c, En(c) && (c = w ? 0 : f.length - 1), c < 0 && (c = f.length + c), c >= f.length) {
      if (w) return -1;
      c = f.length - 1;
    } else if (c < 0)
      if (w) c = 0;
      else return -1;
    if (typeof a == "string" && (a = l.from(a, p)), l.isBuffer(a))
      return a.length === 0 ? -1 : L(f, a, c, p, w);
    if (typeof a == "number")
      return a = a & 255, typeof s.prototype.indexOf == "function" ? w ? s.prototype.indexOf.call(f, a, c) : s.prototype.lastIndexOf.call(f, a, c) : L(f, [a], c, p, w);
    throw new TypeError("val must be string, number or Buffer");
  }
  function L(f, a, c, p, w) {
    let C = 1, E = f.length, G = a.length;
    if (p !== void 0 && (p = String(p).toLowerCase(), p === "ucs2" || p === "ucs-2" || p === "utf16le" || p === "utf-16le")) {
      if (f.length < 2 || a.length < 2)
        return -1;
      C = 2, E /= 2, G /= 2, c /= 2;
    }
    function ee(te, K) {
      return C === 1 ? te[K] : te.readUInt16BE(K * C);
    }
    let H;
    if (w) {
      let te = -1;
      for (H = c; H < E; H++)
        if (ee(f, H) === ee(a, te === -1 ? 0 : H - te)) {
          if (te === -1 && (te = H), H - te + 1 === G) return te * C;
        } else
          te !== -1 && (H -= H - te), te = -1;
    } else
      for (c + G > E && (c = E - G), H = c; H >= 0; H--) {
        let te = !0;
        for (let K = 0; K < G; K++)
          if (ee(f, H + K) !== ee(a, K)) {
            te = !1;
            break;
          }
        if (te) return H;
      }
    return -1;
  }
  l.prototype.includes = function(a, c, p) {
    return this.indexOf(a, c, p) !== -1;
  }, l.prototype.indexOf = function(a, c, p) {
    return P(this, a, c, p, !0);
  }, l.prototype.lastIndexOf = function(a, c, p) {
    return P(this, a, c, p, !1);
  };
  function j(f, a, c, p) {
    c = Number(c) || 0;
    const w = f.length - c;
    p ? (p = Number(p), p > w && (p = w)) : p = w;
    const C = a.length;
    p > C / 2 && (p = C / 2);
    let E;
    for (E = 0; E < p; ++E) {
      const G = parseInt(a.substr(E * 2, 2), 16);
      if (En(G)) return E;
      f[c + E] = G;
    }
    return E;
  }
  function Y(f, a, c, p) {
    return Kt(In(a, f.length - c), f, c, p);
  }
  function _(f, a, c, p) {
    return Kt(Gi(a), f, c, p);
  }
  function O(f, a, c, p) {
    return Kt(_r(a), f, c, p);
  }
  function le(f, a, c, p) {
    return Kt(Vi(a, f.length - c), f, c, p);
  }
  l.prototype.write = function(a, c, p, w) {
    if (c === void 0)
      w = "utf8", p = this.length, c = 0;
    else if (p === void 0 && typeof c == "string")
      w = c, p = this.length, c = 0;
    else if (isFinite(c))
      c = c >>> 0, isFinite(p) ? (p = p >>> 0, w === void 0 && (w = "utf8")) : (w = p, p = void 0);
    else
      throw new Error(
        "Buffer.write(string, encoding, offset[, length]) is no longer supported"
      );
    const C = this.length - c;
    if ((p === void 0 || p > C) && (p = C), a.length > 0 && (p < 0 || c < 0) || c > this.length)
      throw new RangeError("Attempt to write outside buffer bounds");
    w || (w = "utf8");
    let E = !1;
    for (; ; )
      switch (w) {
        case "hex":
          return j(this, a, c, p);
        case "utf8":
        case "utf-8":
          return Y(this, a, c, p);
        case "ascii":
        case "latin1":
        case "binary":
          return _(this, a, c, p);
        case "base64":
          return O(this, a, c, p);
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return le(this, a, c, p);
        default:
          if (E) throw new TypeError("Unknown encoding: " + w);
          w = ("" + w).toLowerCase(), E = !0;
      }
  }, l.prototype.toJSON = function() {
    return {
      type: "Buffer",
      data: Array.prototype.slice.call(this._arr || this, 0)
    };
  };
  function ae(f, a, c) {
    return a === 0 && c === f.length ? t.fromByteArray(f) : t.fromByteArray(f.slice(a, c));
  }
  function Oe(f, a, c) {
    c = Math.min(f.length, c);
    const p = [];
    let w = a;
    for (; w < c; ) {
      const C = f[w];
      let E = null, G = C > 239 ? 4 : C > 223 ? 3 : C > 191 ? 2 : 1;
      if (w + G <= c) {
        let ee, H, te, K;
        switch (G) {
          case 1:
            C < 128 && (E = C);
            break;
          case 2:
            ee = f[w + 1], (ee & 192) === 128 && (K = (C & 31) << 6 | ee & 63, K > 127 && (E = K));
            break;
          case 3:
            ee = f[w + 1], H = f[w + 2], (ee & 192) === 128 && (H & 192) === 128 && (K = (C & 15) << 12 | (ee & 63) << 6 | H & 63, K > 2047 && (K < 55296 || K > 57343) && (E = K));
            break;
          case 4:
            ee = f[w + 1], H = f[w + 2], te = f[w + 3], (ee & 192) === 128 && (H & 192) === 128 && (te & 192) === 128 && (K = (C & 15) << 18 | (ee & 63) << 12 | (H & 63) << 6 | te & 63, K > 65535 && K < 1114112 && (E = K));
        }
      }
      E === null ? (E = 65533, G = 1) : E > 65535 && (E -= 65536, p.push(E >>> 10 & 1023 | 55296), E = 56320 | E & 1023), p.push(E), w += G;
    }
    return Z(p);
  }
  const Qe = 4096;
  function Z(f) {
    const a = f.length;
    if (a <= Qe)
      return String.fromCharCode.apply(String, f);
    let c = "", p = 0;
    for (; p < a; )
      c += String.fromCharCode.apply(
        String,
        f.slice(p, p += Qe)
      );
    return c;
  }
  function Yt(f, a, c) {
    let p = "";
    c = Math.min(f.length, c);
    for (let w = a; w < c; ++w)
      p += String.fromCharCode(f[w] & 127);
    return p;
  }
  function zi(f, a, c) {
    let p = "";
    c = Math.min(f.length, c);
    for (let w = a; w < c; ++w)
      p += String.fromCharCode(f[w]);
    return p;
  }
  function Ui(f, a, c) {
    const p = f.length;
    (!a || a < 0) && (a = 0), (!c || c < 0 || c > p) && (c = p);
    let w = "";
    for (let C = a; C < c; ++C)
      w += Wi[f[C]];
    return w;
  }
  function Di(f, a, c) {
    const p = f.slice(a, c);
    let w = "";
    for (let C = 0; C < p.length - 1; C += 2)
      w += String.fromCharCode(p[C] + p[C + 1] * 256);
    return w;
  }
  l.prototype.slice = function(a, c) {
    const p = this.length;
    a = ~~a, c = c === void 0 ? p : ~~c, a < 0 ? (a += p, a < 0 && (a = 0)) : a > p && (a = p), c < 0 ? (c += p, c < 0 && (c = 0)) : c > p && (c = p), c < a && (c = a);
    const w = this.subarray(a, c);
    return Object.setPrototypeOf(w, l.prototype), w;
  };
  function ce(f, a, c) {
    if (f % 1 !== 0 || f < 0) throw new RangeError("offset is not uint");
    if (f + a > c) throw new RangeError("Trying to access beyond buffer length");
  }
  l.prototype.readUintLE = l.prototype.readUIntLE = function(a, c, p) {
    a = a >>> 0, c = c >>> 0, p || ce(a, c, this.length);
    let w = this[a], C = 1, E = 0;
    for (; ++E < c && (C *= 256); )
      w += this[a + E] * C;
    return w;
  }, l.prototype.readUintBE = l.prototype.readUIntBE = function(a, c, p) {
    a = a >>> 0, c = c >>> 0, p || ce(a, c, this.length);
    let w = this[a + --c], C = 1;
    for (; c > 0 && (C *= 256); )
      w += this[a + --c] * C;
    return w;
  }, l.prototype.readUint8 = l.prototype.readUInt8 = function(a, c) {
    return a = a >>> 0, c || ce(a, 1, this.length), this[a];
  }, l.prototype.readUint16LE = l.prototype.readUInt16LE = function(a, c) {
    return a = a >>> 0, c || ce(a, 2, this.length), this[a] | this[a + 1] << 8;
  }, l.prototype.readUint16BE = l.prototype.readUInt16BE = function(a, c) {
    return a = a >>> 0, c || ce(a, 2, this.length), this[a] << 8 | this[a + 1];
  }, l.prototype.readUint32LE = l.prototype.readUInt32LE = function(a, c) {
    return a = a >>> 0, c || ce(a, 4, this.length), (this[a] | this[a + 1] << 8 | this[a + 2] << 16) + this[a + 3] * 16777216;
  }, l.prototype.readUint32BE = l.prototype.readUInt32BE = function(a, c) {
    return a = a >>> 0, c || ce(a, 4, this.length), this[a] * 16777216 + (this[a + 1] << 16 | this[a + 2] << 8 | this[a + 3]);
  }, l.prototype.readBigUInt64LE = He(function(a) {
    a = a >>> 0, gt(a, "offset");
    const c = this[a], p = this[a + 7];
    (c === void 0 || p === void 0) && zt(a, this.length - 8);
    const w = c + this[++a] * 2 ** 8 + this[++a] * 2 ** 16 + this[++a] * 2 ** 24, C = this[++a] + this[++a] * 2 ** 8 + this[++a] * 2 ** 16 + p * 2 ** 24;
    return BigInt(w) + (BigInt(C) << BigInt(32));
  }), l.prototype.readBigUInt64BE = He(function(a) {
    a = a >>> 0, gt(a, "offset");
    const c = this[a], p = this[a + 7];
    (c === void 0 || p === void 0) && zt(a, this.length - 8);
    const w = c * 2 ** 24 + this[++a] * 2 ** 16 + this[++a] * 2 ** 8 + this[++a], C = this[++a] * 2 ** 24 + this[++a] * 2 ** 16 + this[++a] * 2 ** 8 + p;
    return (BigInt(w) << BigInt(32)) + BigInt(C);
  }), l.prototype.readIntLE = function(a, c, p) {
    a = a >>> 0, c = c >>> 0, p || ce(a, c, this.length);
    let w = this[a], C = 1, E = 0;
    for (; ++E < c && (C *= 256); )
      w += this[a + E] * C;
    return C *= 128, w >= C && (w -= Math.pow(2, 8 * c)), w;
  }, l.prototype.readIntBE = function(a, c, p) {
    a = a >>> 0, c = c >>> 0, p || ce(a, c, this.length);
    let w = c, C = 1, E = this[a + --w];
    for (; w > 0 && (C *= 256); )
      E += this[a + --w] * C;
    return C *= 128, E >= C && (E -= Math.pow(2, 8 * c)), E;
  }, l.prototype.readInt8 = function(a, c) {
    return a = a >>> 0, c || ce(a, 1, this.length), this[a] & 128 ? (255 - this[a] + 1) * -1 : this[a];
  }, l.prototype.readInt16LE = function(a, c) {
    a = a >>> 0, c || ce(a, 2, this.length);
    const p = this[a] | this[a + 1] << 8;
    return p & 32768 ? p | 4294901760 : p;
  }, l.prototype.readInt16BE = function(a, c) {
    a = a >>> 0, c || ce(a, 2, this.length);
    const p = this[a + 1] | this[a] << 8;
    return p & 32768 ? p | 4294901760 : p;
  }, l.prototype.readInt32LE = function(a, c) {
    return a = a >>> 0, c || ce(a, 4, this.length), this[a] | this[a + 1] << 8 | this[a + 2] << 16 | this[a + 3] << 24;
  }, l.prototype.readInt32BE = function(a, c) {
    return a = a >>> 0, c || ce(a, 4, this.length), this[a] << 24 | this[a + 1] << 16 | this[a + 2] << 8 | this[a + 3];
  }, l.prototype.readBigInt64LE = He(function(a) {
    a = a >>> 0, gt(a, "offset");
    const c = this[a], p = this[a + 7];
    (c === void 0 || p === void 0) && zt(a, this.length - 8);
    const w = this[a + 4] + this[a + 5] * 2 ** 8 + this[a + 6] * 2 ** 16 + (p << 24);
    return (BigInt(w) << BigInt(32)) + BigInt(c + this[++a] * 2 ** 8 + this[++a] * 2 ** 16 + this[++a] * 2 ** 24);
  }), l.prototype.readBigInt64BE = He(function(a) {
    a = a >>> 0, gt(a, "offset");
    const c = this[a], p = this[a + 7];
    (c === void 0 || p === void 0) && zt(a, this.length - 8);
    const w = (c << 24) + // Overflow
    this[++a] * 2 ** 16 + this[++a] * 2 ** 8 + this[++a];
    return (BigInt(w) << BigInt(32)) + BigInt(this[++a] * 2 ** 24 + this[++a] * 2 ** 16 + this[++a] * 2 ** 8 + p);
  }), l.prototype.readFloatLE = function(a, c) {
    return a = a >>> 0, c || ce(a, 4, this.length), n.read(this, a, !0, 23, 4);
  }, l.prototype.readFloatBE = function(a, c) {
    return a = a >>> 0, c || ce(a, 4, this.length), n.read(this, a, !1, 23, 4);
  }, l.prototype.readDoubleLE = function(a, c) {
    return a = a >>> 0, c || ce(a, 8, this.length), n.read(this, a, !0, 52, 8);
  }, l.prototype.readDoubleBE = function(a, c) {
    return a = a >>> 0, c || ce(a, 8, this.length), n.read(this, a, !1, 52, 8);
  };
  function me(f, a, c, p, w, C) {
    if (!l.isBuffer(f)) throw new TypeError('"buffer" argument must be a Buffer instance');
    if (a > w || a < C) throw new RangeError('"value" argument is out of bounds');
    if (c + p > f.length) throw new RangeError("Index out of range");
  }
  l.prototype.writeUintLE = l.prototype.writeUIntLE = function(a, c, p, w) {
    if (a = +a, c = c >>> 0, p = p >>> 0, !w) {
      const G = Math.pow(2, 8 * p) - 1;
      me(this, a, c, p, G, 0);
    }
    let C = 1, E = 0;
    for (this[c] = a & 255; ++E < p && (C *= 256); )
      this[c + E] = a / C & 255;
    return c + p;
  }, l.prototype.writeUintBE = l.prototype.writeUIntBE = function(a, c, p, w) {
    if (a = +a, c = c >>> 0, p = p >>> 0, !w) {
      const G = Math.pow(2, 8 * p) - 1;
      me(this, a, c, p, G, 0);
    }
    let C = p - 1, E = 1;
    for (this[c + C] = a & 255; --C >= 0 && (E *= 256); )
      this[c + C] = a / E & 255;
    return c + p;
  }, l.prototype.writeUint8 = l.prototype.writeUInt8 = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 1, 255, 0), this[c] = a & 255, c + 1;
  }, l.prototype.writeUint16LE = l.prototype.writeUInt16LE = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 2, 65535, 0), this[c] = a & 255, this[c + 1] = a >>> 8, c + 2;
  }, l.prototype.writeUint16BE = l.prototype.writeUInt16BE = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 2, 65535, 0), this[c] = a >>> 8, this[c + 1] = a & 255, c + 2;
  }, l.prototype.writeUint32LE = l.prototype.writeUInt32LE = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 4, 4294967295, 0), this[c + 3] = a >>> 24, this[c + 2] = a >>> 16, this[c + 1] = a >>> 8, this[c] = a & 255, c + 4;
  }, l.prototype.writeUint32BE = l.prototype.writeUInt32BE = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 4, 4294967295, 0), this[c] = a >>> 24, this[c + 1] = a >>> 16, this[c + 2] = a >>> 8, this[c + 3] = a & 255, c + 4;
  };
  function jr(f, a, c, p, w) {
    $r(a, p, w, f, c, 7);
    let C = Number(a & BigInt(4294967295));
    f[c++] = C, C = C >> 8, f[c++] = C, C = C >> 8, f[c++] = C, C = C >> 8, f[c++] = C;
    let E = Number(a >> BigInt(32) & BigInt(4294967295));
    return f[c++] = E, E = E >> 8, f[c++] = E, E = E >> 8, f[c++] = E, E = E >> 8, f[c++] = E, c;
  }
  function Yr(f, a, c, p, w) {
    $r(a, p, w, f, c, 7);
    let C = Number(a & BigInt(4294967295));
    f[c + 7] = C, C = C >> 8, f[c + 6] = C, C = C >> 8, f[c + 5] = C, C = C >> 8, f[c + 4] = C;
    let E = Number(a >> BigInt(32) & BigInt(4294967295));
    return f[c + 3] = E, E = E >> 8, f[c + 2] = E, E = E >> 8, f[c + 1] = E, E = E >> 8, f[c] = E, c + 8;
  }
  l.prototype.writeBigUInt64LE = He(function(a, c = 0) {
    return jr(this, a, c, BigInt(0), BigInt("0xffffffffffffffff"));
  }), l.prototype.writeBigUInt64BE = He(function(a, c = 0) {
    return Yr(this, a, c, BigInt(0), BigInt("0xffffffffffffffff"));
  }), l.prototype.writeIntLE = function(a, c, p, w) {
    if (a = +a, c = c >>> 0, !w) {
      const ee = Math.pow(2, 8 * p - 1);
      me(this, a, c, p, ee - 1, -ee);
    }
    let C = 0, E = 1, G = 0;
    for (this[c] = a & 255; ++C < p && (E *= 256); )
      a < 0 && G === 0 && this[c + C - 1] !== 0 && (G = 1), this[c + C] = (a / E >> 0) - G & 255;
    return c + p;
  }, l.prototype.writeIntBE = function(a, c, p, w) {
    if (a = +a, c = c >>> 0, !w) {
      const ee = Math.pow(2, 8 * p - 1);
      me(this, a, c, p, ee - 1, -ee);
    }
    let C = p - 1, E = 1, G = 0;
    for (this[c + C] = a & 255; --C >= 0 && (E *= 256); )
      a < 0 && G === 0 && this[c + C + 1] !== 0 && (G = 1), this[c + C] = (a / E >> 0) - G & 255;
    return c + p;
  }, l.prototype.writeInt8 = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 1, 127, -128), a < 0 && (a = 255 + a + 1), this[c] = a & 255, c + 1;
  }, l.prototype.writeInt16LE = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 2, 32767, -32768), this[c] = a & 255, this[c + 1] = a >>> 8, c + 2;
  }, l.prototype.writeInt16BE = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 2, 32767, -32768), this[c] = a >>> 8, this[c + 1] = a & 255, c + 2;
  }, l.prototype.writeInt32LE = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 4, 2147483647, -2147483648), this[c] = a & 255, this[c + 1] = a >>> 8, this[c + 2] = a >>> 16, this[c + 3] = a >>> 24, c + 4;
  }, l.prototype.writeInt32BE = function(a, c, p) {
    return a = +a, c = c >>> 0, p || me(this, a, c, 4, 2147483647, -2147483648), a < 0 && (a = 4294967295 + a + 1), this[c] = a >>> 24, this[c + 1] = a >>> 16, this[c + 2] = a >>> 8, this[c + 3] = a & 255, c + 4;
  }, l.prototype.writeBigInt64LE = He(function(a, c = 0) {
    return jr(this, a, c, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  }), l.prototype.writeBigInt64BE = He(function(a, c = 0) {
    return Yr(this, a, c, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  });
  function Kr(f, a, c, p, w, C) {
    if (c + p > f.length) throw new RangeError("Index out of range");
    if (c < 0) throw new RangeError("Index out of range");
  }
  function Qr(f, a, c, p, w) {
    return a = +a, c = c >>> 0, w || Kr(f, a, c, 4), n.write(f, a, c, p, 23, 4), c + 4;
  }
  l.prototype.writeFloatLE = function(a, c, p) {
    return Qr(this, a, c, !0, p);
  }, l.prototype.writeFloatBE = function(a, c, p) {
    return Qr(this, a, c, !1, p);
  };
  function Hr(f, a, c, p, w) {
    return a = +a, c = c >>> 0, w || Kr(f, a, c, 8), n.write(f, a, c, p, 52, 8), c + 8;
  }
  l.prototype.writeDoubleLE = function(a, c, p) {
    return Hr(this, a, c, !0, p);
  }, l.prototype.writeDoubleBE = function(a, c, p) {
    return Hr(this, a, c, !1, p);
  }, l.prototype.copy = function(a, c, p, w) {
    if (!l.isBuffer(a)) throw new TypeError("argument should be a Buffer");
    if (p || (p = 0), !w && w !== 0 && (w = this.length), c >= a.length && (c = a.length), c || (c = 0), w > 0 && w < p && (w = p), w === p || a.length === 0 || this.length === 0) return 0;
    if (c < 0)
      throw new RangeError("targetStart out of bounds");
    if (p < 0 || p >= this.length) throw new RangeError("Index out of range");
    if (w < 0) throw new RangeError("sourceEnd out of bounds");
    w > this.length && (w = this.length), a.length - c < w - p && (w = a.length - c + p);
    const C = w - p;
    return this === a && typeof s.prototype.copyWithin == "function" ? this.copyWithin(c, p, w) : s.prototype.set.call(
      a,
      this.subarray(p, w),
      c
    ), C;
  }, l.prototype.fill = function(a, c, p, w) {
    if (typeof a == "string") {
      if (typeof c == "string" ? (w = c, c = 0, p = this.length) : typeof p == "string" && (w = p, p = this.length), w !== void 0 && typeof w != "string")
        throw new TypeError("encoding must be a string");
      if (typeof w == "string" && !l.isEncoding(w))
        throw new TypeError("Unknown encoding: " + w);
      if (a.length === 1) {
        const E = a.charCodeAt(0);
        (w === "utf8" && E < 128 || w === "latin1") && (a = E);
      }
    } else typeof a == "number" ? a = a & 255 : typeof a == "boolean" && (a = Number(a));
    if (c < 0 || this.length < c || this.length < p)
      throw new RangeError("Out of range index");
    if (p <= c)
      return this;
    c = c >>> 0, p = p === void 0 ? this.length : p >>> 0, a || (a = 0);
    let C;
    if (typeof a == "number")
      for (C = c; C < p; ++C)
        this[C] = a;
    else {
      const E = l.isBuffer(a) ? a : l.from(a, w), G = E.length;
      if (G === 0)
        throw new TypeError('The value "' + a + '" is invalid for argument "value"');
      for (C = 0; C < p - c; ++C)
        this[C + c] = E[C % G];
    }
    return this;
  };
  const pt = {};
  function vn(f, a, c) {
    pt[f] = class extends c {
      constructor() {
        super(), Object.defineProperty(this, "message", {
          value: a.apply(this, arguments),
          writable: !0,
          configurable: !0
        }), this.name = `${this.name} [${f}]`, this.stack, delete this.name;
      }
      get code() {
        return f;
      }
      set code(w) {
        Object.defineProperty(this, "code", {
          configurable: !0,
          enumerable: !0,
          value: w,
          writable: !0
        });
      }
      toString() {
        return `${this.name} [${f}]: ${this.message}`;
      }
    };
  }
  vn(
    "ERR_BUFFER_OUT_OF_BOUNDS",
    function(f) {
      return f ? `${f} is outside of buffer bounds` : "Attempt to access memory outside buffer bounds";
    },
    RangeError
  ), vn(
    "ERR_INVALID_ARG_TYPE",
    function(f, a) {
      return `The "${f}" argument must be of type number. Received type ${typeof a}`;
    },
    TypeError
  ), vn(
    "ERR_OUT_OF_RANGE",
    function(f, a, c) {
      let p = `The value of "${f}" is out of range.`, w = c;
      return Number.isInteger(c) && Math.abs(c) > 2 ** 32 ? w = Xr(String(c)) : typeof c == "bigint" && (w = String(c), (c > BigInt(2) ** BigInt(32) || c < -(BigInt(2) ** BigInt(32))) && (w = Xr(w)), w += "n"), p += ` It must be ${a}. Received ${w}`, p;
    },
    RangeError
  );
  function Xr(f) {
    let a = "", c = f.length;
    const p = f[0] === "-" ? 1 : 0;
    for (; c >= p + 4; c -= 3)
      a = `_${f.slice(c - 3, c)}${a}`;
    return `${f.slice(0, c)}${a}`;
  }
  function Pi(f, a, c) {
    gt(a, "offset"), (f[a] === void 0 || f[a + c] === void 0) && zt(a, f.length - (c + 1));
  }
  function $r(f, a, c, p, w, C) {
    if (f > c || f < a) {
      const E = typeof a == "bigint" ? "n" : "";
      let G;
      throw a === 0 || a === BigInt(0) ? G = `>= 0${E} and < 2${E} ** ${(C + 1) * 8}${E}` : G = `>= -(2${E} ** ${(C + 1) * 8 - 1}${E}) and < 2 ** ${(C + 1) * 8 - 1}${E}`, new pt.ERR_OUT_OF_RANGE("value", G, f);
    }
    Pi(p, w, C);
  }
  function gt(f, a) {
    if (typeof f != "number")
      throw new pt.ERR_INVALID_ARG_TYPE(a, "number", f);
  }
  function zt(f, a, c) {
    throw Math.floor(f) !== f ? (gt(f, c), new pt.ERR_OUT_OF_RANGE("offset", "an integer", f)) : a < 0 ? new pt.ERR_BUFFER_OUT_OF_BOUNDS() : new pt.ERR_OUT_OF_RANGE(
      "offset",
      `>= 0 and <= ${a}`,
      f
    );
  }
  const Li = /[^+/0-9A-Za-z-_]/g;
  function Oi(f) {
    if (f = f.split("=")[0], f = f.trim().replace(Li, ""), f.length < 2) return "";
    for (; f.length % 4 !== 0; )
      f = f + "=";
    return f;
  }
  function In(f, a) {
    a = a || 1 / 0;
    let c;
    const p = f.length;
    let w = null;
    const C = [];
    for (let E = 0; E < p; ++E) {
      if (c = f.charCodeAt(E), c > 55295 && c < 57344) {
        if (!w) {
          if (c > 56319) {
            (a -= 3) > -1 && C.push(239, 191, 189);
            continue;
          } else if (E + 1 === p) {
            (a -= 3) > -1 && C.push(239, 191, 189);
            continue;
          }
          w = c;
          continue;
        }
        if (c < 56320) {
          (a -= 3) > -1 && C.push(239, 191, 189), w = c;
          continue;
        }
        c = (w - 55296 << 10 | c - 56320) + 65536;
      } else w && (a -= 3) > -1 && C.push(239, 191, 189);
      if (w = null, c < 128) {
        if ((a -= 1) < 0) break;
        C.push(c);
      } else if (c < 2048) {
        if ((a -= 2) < 0) break;
        C.push(
          c >> 6 | 192,
          c & 63 | 128
        );
      } else if (c < 65536) {
        if ((a -= 3) < 0) break;
        C.push(
          c >> 12 | 224,
          c >> 6 & 63 | 128,
          c & 63 | 128
        );
      } else if (c < 1114112) {
        if ((a -= 4) < 0) break;
        C.push(
          c >> 18 | 240,
          c >> 12 & 63 | 128,
          c >> 6 & 63 | 128,
          c & 63 | 128
        );
      } else
        throw new Error("Invalid code point");
    }
    return C;
  }
  function Gi(f) {
    const a = [];
    for (let c = 0; c < f.length; ++c)
      a.push(f.charCodeAt(c) & 255);
    return a;
  }
  function Vi(f, a) {
    let c, p, w;
    const C = [];
    for (let E = 0; E < f.length && !((a -= 2) < 0); ++E)
      c = f.charCodeAt(E), p = c >> 8, w = c % 256, C.push(w), C.push(p);
    return C;
  }
  function _r(f) {
    return t.toByteArray(Oi(f));
  }
  function Kt(f, a, c, p) {
    let w;
    for (w = 0; w < p && !(w + c >= a.length || w >= f.length); ++w)
      a[w + c] = f[w];
    return w;
  }
  function Ne(f, a) {
    return f instanceof a || f != null && f.constructor != null && f.constructor.name != null && f.constructor.name === a.name;
  }
  function En(f) {
    return f !== f;
  }
  const Wi = (function() {
    const f = "0123456789abcdef", a = new Array(256);
    for (let c = 0; c < 16; ++c) {
      const p = c * 16;
      for (let w = 0; w < 16; ++w)
        a[p + w] = f[c] + f[w];
    }
    return a;
  })();
  function He(f) {
    return typeof BigInt > "u" ? Zi : f;
  }
  function Zi() {
    throw new Error("BigInt not supported");
  }
})(as);
const iu = as.Buffer;
function au() {
  const { address: e, isConnected: t, connector: n } = Jt(), r = !!(e && t && n);
  return R(
    () => ({
      protocol: D.Ethereum,
      addresses: e ? [{ address: `${e}` }] : [],
      isReady: r
    }),
    [e, r]
  );
}
function cu() {
  const { publicKey: e, connected: t, wallet: n } = qt(), r = !!(e && n && t), o = e?.toBase58();
  return R(
    () => ({
      protocol: D.Sealevel,
      addresses: o ? [{ address: o }] : [],
      isReady: r
    }),
    [o, r]
  );
}
function uu() {
  const { cosmos: e } = ct(), { data: t } = xr({
    multiChain: !0,
    chainId: Object.keys(e ?? {})
  });
  return R(() => {
    const n = [], r = {};
    let o = !1;
    for (const [s, i] of Object.entries(e ?? {}))
      if (i) {
        if (t?.[s]?.pubKey) {
          const u = Array.isArray(t?.[s]?.pubKey) ? t?.[s]?.pubKey : Array.from(t?.[s]?.pubKey);
          r[s] = iu.from(u).toString("hex");
        }
        n.push({ address: i, chainId: s }), o = !0;
      }
    return {
      protocol: D.Cosmos,
      addresses: n,
      publicKey: r,
      isReady: o
    };
  }, [e, t]);
}
function hn() {
  const e = au(), t = cu(), n = uu(), r = R(
    () => [e, t, n].filter((o) => o.isReady),
    [e, t, n]
  );
  return R(
    () => ({
      accounts: {
        [D.Ethereum]: e,
        [D.Sealevel]: t,
        [D.Cosmos]: n,
        [D.CosmosNative]: n
      },
      readyAccounts: r
    }),
    [e, t, n, r]
  );
}
const lu = {
  screen: "home",
  from: {
    chain: {
      key: "1",
      displayName: "Ethereum",
      logoURI: It("/chains/ethereum/logo.svg") || void 0
    },
    token: void 0,
    amount: ""
  },
  to: {
    chain: {
      key: "9286185",
      displayName: "Eclipse",
      logoURI: It("/chains/eclipsemainnet/logo.svg") || void 0
    },
    token: void 0,
    amount: ""
  },
  amountDisplayFormat: Q.TOKEN,
  txData: void 0
}, V = Tt(
  Er(
    (e) => ({
      state: lu,
      setScreen: (t) => e((n) => ({
        state: { ...n.state, screen: t }
      })),
      setFromChain: (t) => e((n) => ({
        state: { ...n.state, from: { ...n.state.from, chain: t } }
      })),
      setToChain: (t) => e((n) => ({
        state: { ...n.state, to: { ...n.state.to, chain: t } }
      })),
      switchChains: () => e((t) => ({
        state: {
          ...t.state,
          from: t.state.to,
          to: t.state.from
        }
      })),
      setFromToken: (t) => e((n) => ({
        state: { ...n.state, from: { ...n.state.from, token: t } }
      })),
      setToToken: (t) => e((n) => ({
        state: { ...n.state, to: { ...n.state.to, token: t } }
      })),
      switchTokens: () => e((t) => ({
        state: {
          ...t.state,
          from: { ...t.state.from, token: t.state.to.token },
          to: { ...t.state.to, token: t.state.from.token }
        }
      })),
      setFromAmount: (t) => e((n) => ({
        state: { ...n.state, from: { ...n.state.from, amount: t } }
      })),
      setTxData: (t) => e((n) => ({
        state: { ...n.state, txData: t }
      })),
      setToAddress: (t) => e((n) => ({
        state: { ...n.state, to: { ...n.state.to, address: t } }
      })),
      setAmountDisplayFormat: (t) => e((n) => ({
        state: { ...n.state, amountDisplayFormat: t }
      })),
      swapSides: () => e((t) => ({
        state: {
          ...t.state,
          from: t.state.to,
          to: t.state.from
        }
      }))
    }),
    {
      name: "relay-flow-state:v1",
      partialize: (e) => ({
        state: {
          ...e.state,
          from: { ...e.state.from, amount: "" },
          to: { ...e.state.to, amount: "" },
          txData: void 0,
          screen: "home"
        },
        setScreen: e.setScreen,
        setFromChain: e.setFromChain,
        setToChain: e.setToChain,
        switchChains: e.switchChains,
        setFromToken: e.setFromToken,
        setToToken: e.setToToken,
        switchTokens: e.switchTokens,
        setFromAmount: e.setFromAmount,
        setTxData: e.setTxData,
        swapSides: e.swapSides,
        setToAddress: e.setToAddress,
        setAmountDisplayFormat: e.setAmountDisplayFormat
      })
    }
  )
), tt = (e) => {
  const { evm: t, solana: n, cosmos: r } = ct();
  return R(() => {
    if (e)
      switch (e.chainType) {
        case D.Ethereum:
          return t;
        case D.Sealevel:
          return n;
        case D.Cosmos:
        case D.CosmosNative:
          return r?.[e.chainId];
        default:
          return;
      }
  }, [e, t, n, r]);
}, mn = (e) => {
  const t = Ft((i) => i.inputState.tab), n = W(
    (i) => i.state.to.address
  ), r = V(
    (i) => i.state.to.address
  ), o = tt(e);
  return R(() => n && t === pe.ADVANCED ? n : r && t === pe.FAST ? r : o, [
    n,
    r,
    o,
    t
  ]);
};
function du({
  origin: e,
  originTokenAmount: t,
  destination: n,
  denom: r
}, o) {
  const s = it(), { accounts: i } = hn(), u = tt(e), d = mn(n);
  let h;
  return e && (e.chainType === D.Cosmos || e.chainType === D.CosmosNative) && (h = i[e.chainType]?.publicKey?.[String(e?.chainId)]), Ce({
    enabled: o,
    queryKey: [
      "useFeeQuotes",
      n,
      r,
      u,
      e?.chainId,
      h
    ],
    refetchInterval: 3e4,
    retry: !1,
    queryFn: async () => {
      const l = un(s, r, e?.name);
      return !n || !u || !l || !d ? null : (q.debug("Fetching fee quotes"), s.estimateTransferRemoteFees({
        originTokenAmount: l.amount(t),
        destination: n.chainId,
        recipient: d,
        sender: u,
        senderPubKey: h
      }));
    }
  });
}
const us = (e, t = !0) => {
  const n = Et(
    e.destinationChainId
  ), r = Et(e.originChainId), o = du(
    {
      origin: r || void 0,
      originTokenAmount: e.inputAmount,
      destination: n || void 0,
      denom: e.asset
    },
    t && !!(n && e.asset && r && Number(e.inputAmount) > 0)
  ), s = o.data, i = o.error;
  return $(() => {
    q.debug(
      `useGasInfo: feeQuote for ${e.originChainId} to ${e.destinationChainId} with asset ${e.asset}`,
      s,
      i
    );
  }, [s, i]), { gasInfo: R(() => {
    if (!s?.localQuote && !s?.interchainQuote) return null;
    const d = [];
    if (s.localQuote && s.interchainQuote) {
      const h = s.localQuote.token.symbol, l = s.interchainQuote.token.symbol;
      if (h === l) {
        const y = s.localQuote.plus(s.interchainQuote.amount);
        d.push({
          amount: Ae(y.getDecimalFormattedAmount()),
          amountRaw: y.amount.toString(),
          denom: s.localQuote.token.addressOrDenom,
          symbol: h
        });
      } else
        d.push({
          amount: Ae(s.localQuote.getDecimalFormattedAmount()),
          denom: s.localQuote.token.addressOrDenom,
          amountRaw: s.localQuote.amount.toString(),
          symbol: h
        }), d.push({
          amount: Ae(
            s.interchainQuote.getDecimalFormattedAmount()
          ),
          amountRaw: s.interchainQuote.amount.toString(),
          denom: s.interchainQuote.token.addressOrDenom,
          symbol: l
        });
    } else if (s.localQuote) {
      const h = s.localQuote.token.symbol;
      d.push({
        amount: Ae(s.localQuote.getDecimalFormattedAmount()),
        denom: s.localQuote.token.addressOrDenom,
        amountRaw: s.localQuote.amount.toString(),
        symbol: h
      });
    } else if (s.interchainQuote) {
      const h = s.interchainQuote.token.symbol;
      d.push({
        amount: Ae(s.interchainQuote.getDecimalFormattedAmount()),
        denom: s.interchainQuote.token.addressOrDenom,
        amountRaw: s.interchainQuote.amount.toString(),
        symbol: h
      });
    }
    return { gasFees: d, fiatAmount: null };
  }, [s]), ...o };
};
async function ls(e) {
  if (!e)
    throw new Error("coingeckoId is not defined");
  const t = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(e)}&vs_currencies=usd`
  );
  if (!t.ok)
    throw new Error("Failed to fetch price from CoinGecko");
  const r = (await t.json())?.[e]?.usd;
  if (typeof r == "number")
    return r;
}
const Sr = (e) => Ce({
  queryKey: ["coingecko-usd-price", e],
  queryFn: () => ls(e || ""),
  enabled: !!e,
  refetchInterval: 1e3 * 60 * 5
  // 5 minutes
}), ds = (e, t = !0) => {
  const n = `${e.chainId}:${e.tokenAddress}`, { data: r } = at();
  return Ce({
    queryKey: ["relay-usd-price", n],
    queryFn: async () => {
      if (!r?.chains || !e.chainId)
        throw new Error("Relay chains not loaded");
      const o = r.chains.find(
        (i) => i.chainId === e.chainId
      ), s = await ze.getTokenPrice(
        e.tokenAddress,
        o ? e.chainId : void 0
      );
      if (s === -1)
        throw new Error("Token price not found");
      return s;
    },
    enabled: t && !!n,
    refetchInterval: 1e3 * 60 * 5
    // 5 minutes
  });
}, fu = ({
  originChainId: e,
  destinationChainId: t,
  denom: n,
  inputAmount: r
}, o) => {
  const s = it(), { accounts: i } = hn(), u = Pe(e), d = Pe(t), h = Et(e), l = tt(h);
  let y;
  h && (h.chainType === D.Cosmos || h.chainType === D.CosmosNative) && (y = i[h.chainType]?.publicKey?.[String(h?.chainId)]);
  const g = Et(t), b = tt(g);
  return Ce({
    enabled: o,
    queryKey: [
      "useValidateInput",
      d,
      b,
      n,
      l,
      r,
      y
    ],
    retry: !1,
    queryFn: async () => {
      q.debug(
        `useValidateInput: Validating transfer from ${u} to ${d} with denom ${n} and amount ${r}`
      );
      const x = un(s, n), v = br(r, x?.decimals);
      return !d || !l || !x || !b ? null : s.validateTransfer({
        destination: d,
        sender: l,
        recipient: b,
        originTokenAmount: new ua(v, x),
        senderPubKey: y
      });
    }
  });
}, ke = ({ size: e = "40", ...t }) => /* @__PURE__ */ S(
  "svg",
  {
    width: e,
    height: e,
    viewBox: "0 0 40 40",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    ...t,
    children: [
      /* @__PURE__ */ m(
        "path",
        {
          d: "M0 20C0 8.95431 8.95431 0 20 0C31.0457 0 40 8.95431 40 20C40 31.0457 31.0457 40 20 40C8.95431 40 0 31.0457 0 20Z",
          fill: "var(--secondary)"
        }
      ),
      /* @__PURE__ */ m(
        "path",
        {
          d: "M10 14C10.55 14 11 13.55 11 13V12C11 11.45 11.45 11 12 11H13C13.55 11 14 10.55 14 10C14 9.45 13.55 9 13 9H12C10.34 9 9 10.34 9 12V13C9 13.55 9.45 14 10 14Z",
          fill: "var(--muted-foreground)"
        }
      ),
      /* @__PURE__ */ m(
        "path",
        {
          d: "M13 29H12C11.45 29 11 28.55 11 28V27C11 26.45 10.55 26 10 26C9.45 26 9 26.45 9 27V28C9 29.66 10.34 31 12 31H13C13.55 31 14 30.55 14 30C14 29.45 13.55 29 13 29Z",
          fill: "var(--muted-foreground)"
        }
      ),
      /* @__PURE__ */ m(
        "path",
        {
          d: "M28 9H27C26.45 9 26 9.45 26 10C26 10.55 26.45 11 27 11H28C28.55 11 29 11.45 29 12V13C29 13.55 29.45 14 30 14C30.55 14 31 13.55 31 13V12C31 10.34 29.66 9 28 9Z",
          fill: "var(--muted-foreground)"
        }
      ),
      /* @__PURE__ */ m(
        "path",
        {
          d: "M30 26C29.45 26 29 26.45 29 27V28C29 28.55 28.55 29 28 29H27C26.45 29 26 29.45 26 30C26 30.55 26.45 31 27 31H28C29.66 31 31 29.66 31 28V27C31 26.45 30.55 26 30 26Z",
          fill: "var(--muted-foreground)"
        }
      ),
      /* @__PURE__ */ m(
        "path",
        {
          d: "M27 22.87V17.13C27 16.41 26.62 15.75 26 15.4L21 12.52C20.69 12.34 20.35 12.25 20 12.25C19.65 12.25 19.31 12.34 19 12.52L14 15.39C13.38 15.75 13 16.41 13 17.13V22.87C13 23.59 13.38 24.25 14 24.6L19 27.48C19.31 27.66 19.65 27.75 20 27.75C20.35 27.75 20.69 27.66 21 27.48L26 24.6C26.62 24.25 27 23.59 27 22.87ZM19 25.17L15 22.87V18.24L19 20.57V25.17ZM20 18.84L16.04 16.53L20 14.25L23.96 16.53L20 18.84ZM25 22.87L21 25.17V20.57L25 18.24V22.87Z",
          fill: "var(--muted-foreground)"
        }
      )
    ]
  }
), hu = 1e9, fs = ({
  showSwitch: e = !0,
  assetData: t,
  selectedChain: n,
  inputAmount: r,
  inputType: o = Q.TOKEN,
  setDisplayFormat: s
}) => {
  const { data: i } = Sr(t?.coingeckoId), { data: u } = ds({
    chainId: n?.key,
    tokenAddress: t?.key
  }), d = R(() => i ?? u, [u, i]), h = R(() => {
    if (!r || !d || !t) return 0;
    const g = parseFloat(r);
    return o === Q.TOKEN ? g * d : g / d;
  }, [r, d, t, o]), l = ie(() => {
    if (!s) return;
    if (!d || !t || !r) {
      s({
        type: o === Q.TOKEN ? Q.FIAT : Q.TOKEN
      });
      return;
    }
    const g = parseFloat(r), b = o === Q.TOKEN ? (g * d).toFixed(2) : (g / d).toFixed(2);
    s({
      type: o === Q.TOKEN ? Q.FIAT : Q.TOKEN,
      inputAmount: b
    });
  }, [o, r, d, t, s]), y = R(() => {
    const g = t?.symbol || "";
    return h ? o === Q.TOKEN ? Qo(
      h,
      "$",
      void 0,
      void 0,
      h > hu ? "compact" : "standard"
    ) : `${h.toFixed(4)} ${g}` : o === Q.TOKEN ? "$0.00" : `0 ${g}`;
  }, [h, o, t?.symbol]);
  return /* @__PURE__ */ S("div", { className: "flex items-center gap-1", children: [
    /* @__PURE__ */ m("span", { className: "text-secondary-foreground text-sm", children: y }),
    e && /* @__PURE__ */ S(
      oe,
      {
        size: "xs",
        variant: "glass",
        className: "hover:scale-105 size-4.5",
        onClick: l,
        children: [
          /* @__PURE__ */ m(va, { size: 12, className: "!size-3 text-foreground" }),
          /* @__PURE__ */ m("span", { className: "sr-only", children: "Switch" })
        ]
      }
    )
  ] });
};
function Je({ className: e, ...t }) {
  return /* @__PURE__ */ m(
    "div",
    {
      "data-slot": "skeleton",
      className: se("bg-foreground/25 animate-pulse rounded-md", e),
      ...t
    }
  );
}
const mu = ({
  assets: e,
  sourceChain: t,
  selectedAsset: n,
  inputAmount: r,
  setFromAmount: o,
  inputType: s,
  selectedAssetData: i,
  showMaxButton: u = !1
}) => {
  const { isConnected: d } = ct(), h = R(() => i || e?.find((k) => k.denom === n), [e, n, i]), {
    data: l,
    isLoading: y,
    isError: g
  } = dn({
    chainId: t?.key,
    assets: e
  }), b = l?.balances[i?.key ?? ""], x = ie(() => {
    if (!b) return;
    const k = b.amount.toString();
    o && o(k);
  }, [b, s, o]), v = R(() => {
    if (r && b && s === Q.TOKEN) {
      const k = +b.amount.toString();
      return +r > k && u ? "text-destructive" : "";
    }
    return "";
  }, [r, b, s, u]);
  return d ? /* @__PURE__ */ S("div", { className: "flex items-center gap-1.5", children: [
    /* @__PURE__ */ S(
      "div",
      {
        className: se(
          "text-secondary-foreground flex items-center gap-1 text-sm font-medium transition-colors",
          v
        ),
        children: [
          /* @__PURE__ */ m("p", { children: "Bal:" }),
          /* @__PURE__ */ m(vt, { mode: "wait", children: y ? /* @__PURE__ */ m(Je, { className: "inline-block h-4 w-14" }) : b && h ? /* @__PURE__ */ S(
            Ee.p,
            {
              initial: "hidden",
              animate: "visible",
              exit: "hidden",
              transition: De,
              variants: _e,
              children: [
                Ae(b.amount.toString()),
                " ",
                h.symbol
              ]
            }
          ) : g ? /* @__PURE__ */ m(
            Ee.p,
            {
              initial: "hidden",
              animate: "visible",
              exit: "hidden",
              transition: De,
              variants: _e,
              children: "-"
            }
          ) : /* @__PURE__ */ m(
            Ee.p,
            {
              initial: "hidden",
              animate: "visible",
              exit: "hidden",
              transition: De,
              variants: _e,
              children: "0"
            }
          ) })
        ]
      }
    ),
    u && /* @__PURE__ */ m(
      oe,
      {
        size: "xs",
        variant: "glass",
        className: "h-auto px-1.5 py-0 text-xs text-foreground hover:scale-105",
        disabled: y || !b || !h,
        onClick: x,
        children: "Max"
      }
    )
  ] }) : null;
};
function Se({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ m(
    Ar.Root,
    {
      "data-slot": "avatar",
      className: se(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        e
      ),
      ...t
    }
  );
}
function Te({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ m(
    Ar.Image,
    {
      "data-slot": "avatar-image",
      className: se("aspect-square size-full", e),
      ...t
    }
  );
}
function Be({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ m(
    Ar.Fallback,
    {
      "data-slot": "avatar-fallback",
      className: se(
        "bg-muted flex size-full items-center justify-center rounded-full",
        e
      ),
      ...t
    }
  );
}
function Yn(e) {
  const t = (n) => {
    e.setDisplayFormat && (e.setDisplayFormat(n.type), n.inputAmount && e.setFromAmount?.(n.inputAmount));
  };
  return /* @__PURE__ */ S("div", { className: "bg-card-foreground flex w-full flex-col rounded-xl px-4 py-6", children: [
    /* @__PURE__ */ m("div", { className: "text-muted-foreground font-medium mb-3 text-xs", children: e.label }),
    /* @__PURE__ */ S("div", { className: "flex w-full items-end justify-between gap-2", children: [
      /* @__PURE__ */ S("div", { className: "flex flex-1 items-center gap-1", children: [
        e?.displayFormat === Q.FIAT ? /* @__PURE__ */ m("span", { className: "text-3.5xl", children: "$" }) : null,
        /* @__PURE__ */ m(
          "input",
          {
            inputMode: "decimal",
            disabled: e.disabled,
            value: e.value,
            onChange: (n) => e.onChange?.(n.target.value),
            placeholder: "0.00",
            className: "text-3.5xl w-full flex-1 border-none bg-transparent outline-none text-foreground"
          }
        )
      ] }),
      e.isLoading ? /* @__PURE__ */ m(Je, { className: "h-9 w-22 rounded-full" }) : /* @__PURE__ */ S(
        "button",
        {
          className: se(
            "text-base-lg bg-foreground/10 hover:bg-foreground/25 text-foreground flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-1.5 py-1 font-medium transition-all hover:scale-105",
            !e.assetDetails && "ps-3"
          ),
          onClick: e.onOpenSelector,
          children: [
            e.assetDetails ? /* @__PURE__ */ S(Se, { className: "mr-1 size-6 shrink-0", children: [
              /* @__PURE__ */ m(
                Te,
                {
                  src: It(e.assetDetails?.logoURI) ?? ""
                }
              ),
              /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-6" }) })
            ] }) : null,
            /* @__PURE__ */ m("span", { className: "flex-1 truncate", children: e.assetDetails ? e.assetDetails.symbol : "Select Token" }),
            e?.showDropdownIcon ? /* @__PURE__ */ m(an, { size: 16, className: "shrink-0" }) : null
          ]
        }
      )
    ] }),
    /* @__PURE__ */ S("div", { className: "text-muted-foreground mt-2 flex items-center justify-between text-xs", children: [
      /* @__PURE__ */ m(
        fs,
        {
          showSwitch: e.selectType === "source",
          selectedChain: e.selectedChain,
          assetData: e.assetDetails,
          inputAmount: e.value,
          inputType: e.displayFormat || Q.TOKEN,
          setDisplayFormat: t
        }
      ),
      /* @__PURE__ */ m(
        mu,
        {
          assets: e.assets,
          sourceChain: e.selectedChain,
          selectedAssetData: e.assetDetails,
          inputAmount: e.value,
          inputType: e.displayFormat || Q.TOKEN,
          showMaxButton: e.selectType === "source",
          setFromAmount: e.setFromAmount
        }
      )
    ] })
  ] });
}
const Kn = ({
  text: e,
  className: t
}) => {
  const [n, r] = he(".");
  return $(() => {
    const o = setInterval(() => {
      r((s) => s === "..." ? "." : s === ".." ? "..." : "..");
    }, 500);
    return () => clearInterval(o);
  }, []), /* @__PURE__ */ S("span", { className: t, children: [
    e,
    /* @__PURE__ */ m("span", { className: "inline-block w-6 text-left", children: n })
  ] });
}, po = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 }
}, go = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};
function _t(e) {
  return /* @__PURE__ */ S(
    "button",
    {
      className: se(
        "text-md bg-card-foreground rounded-md2 hover:bg-foreground/10 flex h-auto w-full flex-1 cursor-pointer items-center gap-3 overflow-hidden px-4 py-3 text-start transition-all hover:scale-105",
        e.selectType === "destination" && "flex-row-reverse text-end"
      ),
      onClick: e.onClick,
      children: [
        /* @__PURE__ */ m(vt, { mode: "wait", children: /* @__PURE__ */ m(Se, { className: "h-6 w-6 rounded-full", asChild: !0, children: /* @__PURE__ */ S(
          Ee.div,
          {
            initial: "initial",
            animate: "animate",
            exit: "exit",
            variants: e.selectType === "source" ? po : go,
            transition: De,
            children: [
              /* @__PURE__ */ m(
                Te,
                {
                  className: "rounded-full",
                  src: e.chainDetails?.logoURI
                }
              ),
              /* @__PURE__ */ m(Be, { className: "rounded-full", children: /* @__PURE__ */ m(ke, {}) })
            ]
          },
          e.chainDetails?.logoURI
        ) }) }),
        /* @__PURE__ */ m("div", { className: "flex max-w-full flex-col overflow-hidden", children: /* @__PURE__ */ m(vt, { mode: "wait", children: /* @__PURE__ */ m(
          Ee.span,
          {
            className: "truncate font-bold text-foreground",
            initial: "initial",
            animate: "animate",
            exit: "exit",
            variants: e.selectType === "source" ? go : po,
            transition: De,
            children: e.chainDetails?.displayName ?? "Select Chain"
          },
          e.chainDetails?.displayName
        ) }) })
      ]
    }
  );
}
const yo = ({
  buttonProps: e,
  label: t = "Connect Wallet"
}) => {
  const { connectWallet: n } = st();
  return /* @__PURE__ */ m(oe, { ...e, onClick: n, children: t });
}, hs = (e) => {
  const { evm: t, solana: n, cosmos: r } = ct(), o = mn(e.destinationChain), s = {
    size: "lg",
    ...e.connectButtonProps,
    className: se(
      "w-full hover:scale-102 hover:disabled:scale-100 font-medium text-md",
      e.className
    )
  }, i = /* @__PURE__ */ m(yo, { buttonProps: s });
  return (e.sourceChain?.chainType === D.Cosmos || e.sourceChain?.chainType === D.CosmosNative) && !r?.[e.sourceChain.chainId] || e.sourceChain?.chainType === D.Ethereum && !t || e.sourceChain?.chainType === D.Sealevel && !n ? i : o ? e.children : /* @__PURE__ */ m(
    yo,
    {
      buttonProps: s,
      label: e.destinationChain?.displayName ? `Connect to ${e.destinationChain?.displayName}` : "Connect Wallet"
    }
  );
};
function pu({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ m(
    co.Root,
    {
      "data-slot": "switch",
      className: se(
        "peer cursor-pointer data-[state=checked]:bg-primary data-[state=unchecked]:bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-transparent inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-secondary shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        e
      ),
      ...t,
      children: /* @__PURE__ */ m(
        co.Thumb,
        {
          "data-slot": "switch-thumb",
          className: se(
            "bg-secondary dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
          )
        }
      )
    }
  );
}
function gu({
  className: e,
  ...t
}) {
  return /* @__PURE__ */ m(
    La.Root,
    {
      "data-slot": "label",
      className: se(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        e
      ),
      ...t
    }
  );
}
const ms = (e) => {
  const { inputState: t, setInputState: n } = Ft(), { isTestnet: r, showDefaultTabOnly: o } = st(), s = (u) => {
    n({ tab: u });
  }, i = (u) => {
    const d = u ? pe.FAST : pe.ADVANCED;
    s(d);
  };
  return $(() => {
    if (r) {
      s(pe.ADVANCED);
      return;
    }
    e.defaultTab && s(e.defaultTab);
  }, [e.defaultTab, r]), o ? null : /* @__PURE__ */ S("div", { className: "mb-6 flex items-center gap-3", children: [
    /* @__PURE__ */ S(gu, { htmlFor: "airplane-mode", className: "flex items-center gap-1", children: [
      /* @__PURE__ */ m(wa, { size: 16, weight: "fill" }),
      /* @__PURE__ */ m("span", { children: "Fast" })
    ] }),
    /* @__PURE__ */ m(
      pu,
      {
        id: "fast-advanced-switch",
        disabled: r,
        onCheckedChange: i,
        className: "data-[state=checked]:bg-primary",
        checked: t.tab === pe.FAST
      }
    )
  ] });
}, yu = 100, bu = (e) => {
  const t = e.seconds ?? yu, n = R(() => t < 60 ? `${t} sec` : `${Math.floor(t / 60)} min`, [t]);
  return /* @__PURE__ */ S("div", { className: "flex items-center gap-1", children: [
    /* @__PURE__ */ m(Ia, { className: "size-4" }),
    /* @__PURE__ */ m("span", { className: "text-secondary-foreground text-xs", children: n })
  ] });
}, wu = (e) => /* @__PURE__ */ m(
  "svg",
  {
    width: "20",
    height: "20",
    viewBox: "0 0 20 20",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    ...e,
    children: /* @__PURE__ */ m(
      "path",
      {
        d: "M16.2667 6.025L16.275 6.01667L13.175 2.91667L12.2917 3.8L14.05 5.55833C13.2667 5.85833 12.7083 6.60833 12.7083 7.5C12.7083 8.65 13.6417 9.58333 14.7917 9.58333C15.0917 9.58333 15.3667 9.51667 15.625 9.40833V15.4167C15.625 15.875 15.25 16.25 14.7917 16.25C14.3333 16.25 13.9583 15.875 13.9583 15.4167V11.6667C13.9583 10.75 13.2083 10 12.2917 10H11.4583V4.16667C11.4583 3.25 10.7083 2.5 9.79167 2.5H4.79167C3.875 2.5 3.125 3.25 3.125 4.16667V17.5H11.4583V11.25H12.7083V15.4167C12.7083 16.5667 13.6417 17.5 14.7917 17.5C15.9417 17.5 16.875 16.5667 16.875 15.4167V7.5C16.875 6.925 16.6417 6.4 16.2667 6.025ZM9.79167 15.8333H4.79167V10H9.79167V15.8333ZM9.79167 8.33333H4.79167V4.16667H9.79167V8.33333ZM14.7917 8.33333C14.3333 8.33333 13.9583 7.95833 13.9583 7.5C13.9583 7.04167 14.3333 6.66667 14.7917 6.66667C15.25 6.66667 15.625 7.04167 15.625 7.5C15.625 7.95833 15.25 8.33333 14.7917 8.33333Z",
        fill: "currentColor"
      }
    )
  }
), xu = (e) => e.isLoading ? {
  id: "loading",
  children: /* @__PURE__ */ m(Je, { className: "bg-foreground/25 h-4 w-20" })
} : e.gasInfo ? {
  id: "gas-info",
  children: /* @__PURE__ */ S("span", { className: "flex gap-1", children: [
    e.gasInfo.gasFees.map((t, n) => /* @__PURE__ */ S("span", { children: [
      t.amount,
      " ",
      t.symbol
    ] }, n)),
    e.gasInfo.fiatAmount && `(${e.gasInfo.fiatAmount})`
  ] })
} : {
  id: "no-gas-info",
  children: /* @__PURE__ */ m("span", { children: "-" })
}, Au = (e) => {
  const { id: t, children: n } = xu(e);
  return /* @__PURE__ */ S("div", { className: "flex items-center gap-1", children: [
    /* @__PURE__ */ m(wu, { className: "size-4" }),
    /* @__PURE__ */ m("div", { className: "text-secondary-foreground text-xs font-medium", children: /* @__PURE__ */ m(vt, { mode: "wait", children: /* @__PURE__ */ m(
      Ee.div,
      {
        initial: "hidden",
        animate: "visible",
        exit: "hidden",
        transition: De,
        variants: _e,
        children: n
      },
      t
    ) }) })
  ] });
}, Cu = (e) => /* @__PURE__ */ S(
  "svg",
  {
    width: "16",
    height: "17",
    viewBox: "0 0 16 17",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    xmlnsXlink: "http://www.w3.org/1999/xlink",
    ...e,
    children: [
      /* @__PURE__ */ m(
        "rect",
        {
          y: "0.5",
          width: "16",
          height: "16",
          rx: "8",
          fill: "url(#pattern0_579_5539)"
        }
      ),
      /* @__PURE__ */ S("defs", { children: [
        /* @__PURE__ */ m(
          "pattern",
          {
            id: "pattern0_579_5539",
            patternContentUnits: "objectBoundingBox",
            width: "1",
            height: "1",
            children: /* @__PURE__ */ m("use", { xlinkHref: "#image0_579_5539", transform: "scale(0.0025)" })
          }
        ),
        /* @__PURE__ */ m(
          "image",
          {
            id: "image0_579_5539",
            width: "400",
            height: "400",
            preserveAspectRatio: "none",
            xlinkHref: "data:image/png;base64,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"
          }
        )
      ] })
    ]
  }
), vu = (e) => /* @__PURE__ */ S(
  "svg",
  {
    width: "16",
    height: "17",
    viewBox: "0 0 16 17",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    xmlnsXlink: "http://www.w3.org/1999/xlink",
    ...e,
    children: [
      /* @__PURE__ */ m(
        "rect",
        {
          y: "0.5",
          width: "16",
          height: "16",
          rx: "8",
          fill: "url(#pattern0_637_2836)"
        }
      ),
      /* @__PURE__ */ S("defs", { children: [
        /* @__PURE__ */ m(
          "pattern",
          {
            id: "pattern0_637_2836",
            patternContentUnits: "objectBoundingBox",
            width: "1",
            height: "1",
            children: /* @__PURE__ */ m("use", { xlinkHref: "#image0_637_2836", transform: "scale(0.0025)" })
          }
        ),
        /* @__PURE__ */ m(
          "image",
          {
            id: "image0_637_2836",
            width: "400",
            height: "400",
            preserveAspectRatio: "none",
            xlinkHref: "data:image/png;base64,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"
          }
        )
      ] })
    ]
  }
), ps = (e) => {
  const t = R(() => new X(e.toAmount).dividedBy(e.fromAmount), [
    // fromTokenUsdPrice,
    // toTokenUsdPrice,
    e.fromAmount,
    e.toAmount
    // isLoadingFromTokenUSDPrice,
    // isLoadingToTokenUSDPrice,
  ]);
  return e.toAmount ? t ? /* @__PURE__ */ m("div", { className: "text-xs", children: `1 ${e.fromToken?.symbol} = ${Ae(t, 2, 2, t.gte(1e4) ? "compact" : "standard")} ${e.toToken?.symbol}` }) : /* @__PURE__ */ m("div", { children: " " }) : /* @__PURE__ */ m(Je, { className: "h-5 w-32 rounded-3xl" });
}, pn = ({ gasInfo: e, isGasLoading: t, children: n }) => {
  const { inputState: r } = Ft(), o = R(() => r?.tab === pe.FAST ? /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ m(vu, { className: "size-4" }),
    /* @__PURE__ */ m("span", { children: "Powered by Relay" })
  ] }) : /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ m(Cu, { className: "size-4" }),
    /* @__PURE__ */ m("span", { children: "Powered by Hyperlance" })
  ] }), [r?.tab]);
  return /* @__PURE__ */ m("div", { className: "bg-secondary mb-3 rounded-2xl p-4 text-xs text-foreground", children: /* @__PURE__ */ S("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ S("div", { className: "flex items-center justify-between", children: [
      n,
      /* @__PURE__ */ m("div", { className: "flex items-center gap-2", children: o })
    ] }),
    /* @__PURE__ */ S("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ m(Au, { gasInfo: e, isLoading: t }),
      /* @__PURE__ */ m(bu, {})
    ] })
  ] }) });
}, Iu = ({ assetData: e, chainData: t, displayFormat: n, outAmount: r = "0" }) => {
  const o = R(() => {
    if (!e) return "0";
    const s = Ae(r);
    return n === Q.FIAT ? `$${s}` : `${s} ${e.symbol}`;
  }, [r, e, n]);
  return /* @__PURE__ */ S("div", { className: "flex w-full items-center gap-4 overflow-hidden text-foreground", children: [
    /* @__PURE__ */ S("div", { className: "relative", children: [
      /* @__PURE__ */ S(Se, { className: "size-12", children: [
        /* @__PURE__ */ m(Te, { src: e?.logoURI }),
        /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-12" }) })
      ] }),
      /* @__PURE__ */ S(Se, { className: "absolute right-0 bottom-0 size-4 rounded-full", children: [
        /* @__PURE__ */ m(Te, { src: t?.logoURI }),
        /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-4" }) })
      ] })
    ] }),
    /* @__PURE__ */ S("div", { className: "flex flex-col overflow-hidden", children: [
      /* @__PURE__ */ m("span", { className: "text-3.5xl truncate leading-10.75", children: o }),
      t?.displayName && /* @__PURE__ */ S("span", { className: "text-secondary-foreground text-sm font-medium", children: [
        "on",
        " ",
        /* @__PURE__ */ m(vt, { mode: "wait", children: /* @__PURE__ */ m(
          Ee.span,
          {
            initial: "hidden",
            animate: "visible",
            exit: "hidden",
            transition: De,
            variants: _e,
            children: t?.displayName
          },
          t?.displayName
        ) })
      ] })
    ] })
  ] });
}, Eu = (e, t) => {
  const [n, r] = he(""), [o, s] = he(!1), [i, u] = he(null), [d, h] = he([]), l = async () => {
    try {
      const b = await fetch(
        "https://api.celestials.id/api/resolver/chains"
      );
      if (!b.ok)
        throw new Error("Failed to fetch supported chains");
      return (await b.json()).chains || [];
    } catch (b) {
      return console.error("Error fetching supported chains:", b), [];
    }
  }, y = ie(
    async (b, x) => {
      if (!b.endsWith(".i")) return;
      const v = d.findIndex(
        (A) => kn(A.chain_id) === x
      );
      if (v === -1) {
        r(""), u(null);
        return;
      }
      const k = b.replace(".i", "");
      s(!0), u(null);
      try {
        const A = await fetch(
          "https://api.celestials.id/api/resolver/lookup",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              celestial_chain: [
                {
                  celestials_id: k,
                  chain_id: d[v].chain_id
                }
              ]
            })
          }
        );
        if (!A.ok)
          throw new Error("Failed to resolve address");
        const I = await A.json();
        if (I.addresses && I.addresses.length > 0) {
          const F = I.addresses[0]?.status === "VERIFIED" ? I.addresses[0] : null;
          F ? (r(F.address), u(null)) : (r(""), u("not_verified"));
        } else
          r(""), u("no_address");
      } catch (A) {
        console.error("Error resolving .i address:", A), r(""), u("no_address");
      } finally {
        s(!1);
      }
    },
    [d]
  );
  $(() => {
    l().then((b) => {
      h(b);
    });
  }, []), $(() => {
    if (e && e.endsWith(".i") && d.length > 0) {
      if (!d.find(
        (x) => kn(x.chain_id) === t
      )) {
        r(""), u(null);
        return;
      }
      y(e, t);
    } else
      r(""), u(null);
  }, [e, t, d, y]);
  const g = !!d.find(
    (b) => kn(b.chain_id) === t
  );
  return {
    resolvedAddress: n,
    isResolving: o,
    isChainSupported: g,
    resolutionError: i,
    supportedChains: d
  };
};
function ku(e) {
  if (!e || e.length < 20) return !1;
  try {
    const t = Oa.decode(e);
    return t.prefix.length > 0 && t.prefix.startsWith("celestia");
  } catch {
    return !1;
  }
}
function Su(e) {
  try {
    return ka(e, { strict: !1 });
  } catch {
    return !1;
  }
}
function Tu(e) {
  try {
    const t = new Zn(e);
    return t.toBase58().length >= 32 && t.toBase58().length <= 44;
  } catch {
    return !1;
  }
}
function gs(e) {
  if (!e || !e.trim()) return !1;
  const t = e.trim();
  return ku(t) || Su(t) || Tu(t);
}
const Bu = () => {
  const { state: e, setToAddress: t } = W(), [n, r] = he(
    e.to.address || ""
  ), o = n.trim(), s = o.endsWith(".i"), { resolvedAddress: i, isResolving: u, isChainSupported: d, resolutionError: h } = Eu(o, String(e.to.chain?.key || "")), l = R(
    () => !s && gs(o),
    [o, s]
  ), y = o && !s && !u && !l && "The entered address is invalid", g = R(() => s ? h === null && i ? i : "" : l ? o : "", [
    s,
    h,
    i,
    o,
    l
  ]);
  return $(() => {
    t(g);
  }, [g, t]), /* @__PURE__ */ S("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ S(
      "label",
      {
        htmlFor: "recipient-address",
        className: "text-foreground-2 text-sm font-medium",
        children: [
          "Recipient Address",
          " ",
          /* @__PURE__ */ m("span", { className: "text-foreground-3 text-xs", children: "(optional)" })
        ]
      }
    ),
    /* @__PURE__ */ m(
      "input",
      {
        id: "recipient-address",
        type: "text",
        placeholder: "Enter recipient address (optional)",
        className: "border-card-surface-2 bg-card-surface focus:border-primary w-full rounded-md border px-3 py-2 text-base outline-none",
        value: n,
        onChange: (x) => r(x.target.value)
      }
    ),
    s && /* @__PURE__ */ S(ye, { children: [
      u && /* @__PURE__ */ m("div", { className: "text-foreground-3 text-sm", children: "Resolving address..." }),
      s && !d && !u && /* @__PURE__ */ m("div", { className: "text-sm text-amber-600", children: "Celestial domains not supported for this destination chain" }),
      !u && d && h === "no_address" && /* @__PURE__ */ m("div", { className: "text-sm text-amber-600", children: "No associated address found" }),
      !u && d && h === "not_verified" && /* @__PURE__ */ m("div", { className: "text-sm text-amber-600", children: "Wallet address is not verified" }),
      !u && i && /* @__PURE__ */ S("div", { className: "text-foreground-2 bg-background rounded-md px-3 py-2 text-sm", children: [
        /* @__PURE__ */ m("span", { className: "text-foreground-3", children: "Resolved address: " }),
        /* @__PURE__ */ m("span", { className: "font-mono", children: i })
      ] })
    ] }),
    y && /* @__PURE__ */ m("div", { className: "text-sm text-amber-600", children: y })
  ] });
}, Nu = (e) => e.inputAmount ? e.isInsufficientBalance ? "Insufficient balance" : e.isGasLoading ? /* @__PURE__ */ m(Kn, { text: "Fetching quote" }) : e.isValidating ? /* @__PURE__ */ m(Kn, { text: "Validating" }) : e.validation ? Object.values(e.validation)[0] : e.validationError ? "Insufficient funds for gas fee" : `Send to ${e.chainDisplayName}` : "Enter amount", bo = ({
  className: e,
  onNavigate: t,
  onSetSelectorContext: n
}) => {
  const r = W((O) => O.state.from.chain), o = W((O) => O.state.to.chain), s = W((O) => O.state.from.token), i = W((O) => O.state.from.amount), u = W(
    (O) => O.state.amountDisplayFormat
  ), { switchChains: d, setFromAmount: h, setAmountDisplayFormat: l } = W(), y = Pe(r?.key), g = Pe(o?.key), b = Ir(
    r?.key,
    y,
    g
  ), x = ln(), v = R(() => {
    if (!(!x || !r?.key))
      return x.find((O) => O.chainId === r?.key);
  }, [x, r?.key]), k = R(() => {
    if (!(!x || !o?.key))
      return x.find((O) => O.chainId === o?.key);
  }, [x, o?.key]), { data: A, isLoading: I } = dn(
    { chainId: r?.key, assets: b },
    !!r?.key
  ), F = R(() => {
    if (!A || !s?.key) return "0";
    const O = b.find(
      (ae) => ae.originDenom === s?.key
    ), le = A.balances[O?.originDenom];
    return le ? le.amount : "0";
  }, [A, s?.key, b]), { data: B } = Sr(s?.coingeckoId), M = R(() => {
    if (!i) return "0";
    let O = new X(i);
    if (u === Q.FIAT) {
      if (!B) return "0";
      O = new X(i).dividedBy(B);
    }
    return O.toString();
  }, [i, B, u]), T = R(() => !M || !F ? !1 : new X(M).isGreaterThan(F), [M, F]), { isFetching: U, gasInfo: z } = us(
    {
      originChainId: r?.key,
      destinationChainId: o?.key,
      asset: s?.key,
      inputAmount: M || "0"
    },
    !T
  ), {
    data: P,
    isLoading: L,
    error: j
  } = fu(
    {
      originChainId: r?.key,
      destinationChainId: o?.key,
      denom: s?.key,
      inputAmount: M
    },
    !T && Number(M) > 0
  ), Y = +M, _ = Nu({
    isGasLoading: U,
    inputAmount: Y,
    chainDisplayName: k?.displayName,
    isValidating: L,
    validation: P,
    validationError: j,
    isInsufficientBalance: T
  });
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ m(ms, {}),
    /* @__PURE__ */ S("div", { className: "relative mb-5 flex items-center gap-3", children: [
      /* @__PURE__ */ m(
        _t,
        {
          title: "From",
          selectType: "source",
          chainDetails: r,
          onClick: () => {
            n({ side: "from", kind: "chain" }), t("selector");
          }
        }
      ),
      /* @__PURE__ */ m("div", { className: "bg-card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full direction-button-bg", children: /* @__PURE__ */ m(
        oe,
        {
          size: "icon",
          variant: "secondary",
          className: "border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100",
          disabled: r?.key === o?.key,
          onClick: () => d(),
          children: /* @__PURE__ */ m(Ko, { className: "transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" })
        }
      ) }),
      /* @__PURE__ */ m(
        _t,
        {
          title: "To",
          selectType: "destination",
          chainDetails: o,
          onClick: () => {
            n({
              side: "to",
              kind: "chain",
              showOnlyChains: !0
            }), t("selector");
          }
        }
      )
    ] }),
    /* @__PURE__ */ S("div", { className: "relative mb-3 flex flex-col gap-2", children: [
      /* @__PURE__ */ m(
        Yn,
        {
          label: "You send",
          value: i,
          assets: b,
          selectedChain: r,
          assetDetails: s,
          onChange: (O) => h(O),
          onOpenSelector: () => {
            n({ side: "from", kind: "token" }), t("selector");
          },
          showDropdownIcon: b && r?.key ? b.length > 1 : !1,
          selectType: "source",
          isLoading: b.length === 0,
          setFromAmount: h,
          displayFormat: u,
          setDisplayFormat: l
        }
      ),
      /* @__PURE__ */ m("div", { className: "bg-card absolute top-[52%] left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full direction-button-bg", children: /* @__PURE__ */ m(
        oe,
        {
          size: "icon",
          variant: "secondary",
          className: "border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100",
          disabled: !0,
          children: /* @__PURE__ */ m(an, { className: "transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" })
        }
      ) }),
      /* @__PURE__ */ S("div", { className: "bg-secondary flex w-full flex-col rounded-xl px-4 py-6", children: [
        /* @__PURE__ */ m("div", { className: "text-muted-foreground mb-3 text-xs", children: "You get" }),
        /* @__PURE__ */ m(
          Iu,
          {
            assetData: s,
            chainData: o,
            outAmount: M || "0"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ m(Bu, {}),
    Y && z ? /* @__PURE__ */ m(pn, { gasInfo: z, isGasLoading: U, children: /* @__PURE__ */ m(ts, { fromToken: s }) }) : null,
    /* @__PURE__ */ m(
      hs,
      {
        className: "mt-auto",
        sourceChain: v,
        destinationChain: k,
        children: /* @__PURE__ */ m(
          oe,
          {
            className: se(
              "mt-auto w-full transition-all hover:scale-105 font-medium text-md",
              (T || P || j) && !U ? "!bg-destructive/90 text-white" : ""
            ),
            size: "lg",
            onClick: () => t("review"),
            disabled: U || I || T || !s || !Y || !v?.chainType || !!P || !!j || L,
            children: _
          }
        )
      }
    )
  ] });
};
function Fu(e, t, n, r = !0) {
  const o = it(), { isLoading: s, isError: i, error: u, data: d } = Ce({
    // The Token class is not serializable, so we can't use it as a key
    queryKey: ["useIsApproveRequired", e, n, t?.addressOrDenom],
    queryFn: async () => !t || !e || !n ? !1 : o.isApproveRequired({
      originTokenAmount: t.amount(n),
      owner: e
    }),
    enabled: r
  });
  return u && q.debug("useIsApproveRequired", { error: u }), { isLoading: s, isError: i, isApproveRequired: !!d };
}
const Tr = Tt((e) => ({
  transfers: [],
  addTransfer: (t) => {
    e((n) => ({ transfers: [...n.transfers, t] }));
  },
  resetTransfers: () => {
    e(() => ({ transfers: [] }));
  },
  updateTransferStatus: (t, n, r) => {
    e((o) => {
      if (t >= o.transfers.length) return o;
      const s = [...o.transfers];
      return s[t].status = n, s[t].msgId ||= r?.msgId, s[t].originTxHash ||= r?.originTxHash, {
        transfers: s
      };
    });
  },
  failUnconfirmedTransfers: () => {
    e((t) => ({
      transfers: t.transfers.map(
        (n) => Cc.includes(n.status) ? n : { ...n, status: ne.Failed }
      )
    }));
  },
  // Shared component state
  transferLoading: !1,
  setTransferLoading: (t) => {
    e(() => ({ transferLoading: t }));
  }
}));
function Mu(e) {
  const { chain: t, connector: n } = Jt();
  return R(
    () => ({
      chainDisplayName: t?.name,
      chainName: t ? e.tryGetChainMetadata(t.id)?.name : void 0,
      walletClient: n?.name
    }),
    [t, e, n]
  );
}
function Ru(e) {
  const { connection: t } = za(), { wallet: n } = qt(), r = t?.rpcEndpoint;
  return R(() => {
    try {
      const o = new URL(r).hostname, s = pc(e, o);
      return s ? {
        chainDisplayName: s.displayName,
        chainName: s.name,
        walletClient: n?.adapter.name
      } : {};
    } catch (o) {
      return q.warn("Error finding sol active chain", o), {};
    }
  }, [r, e, n?.adapter.name]);
}
function zu() {
  const { walletType: e } = xr();
  return R(() => ({
    walletClient: e
  }), [e]);
}
function Uu(e) {
  const t = Mu(e), n = Ru(e), r = zu(), o = R(
    () => [t, n].filter((s) => !!s.chainDisplayName),
    [t, n]
  );
  return R(
    () => ({
      chains: {
        [D.Ethereum]: t,
        [D.Sealevel]: n,
        [D.Cosmos]: r,
        [D.CosmosNative]: r
      },
      readyChains: o
    }),
    [t, n, o, r]
  );
}
const ys = "2.22.23";
let Bn = {
  getDocsUrl: ({ docsBaseUrl: e, docsPath: t = "", docsSlug: n }) => t ? `${e ?? "https://viem.sh"}${t}${n ? `#${n}` : ""}` : void 0,
  version: `viem@${ys}`
}, N = class Qn extends Error {
  constructor(t, n = {}) {
    const r = n.cause instanceof Qn ? n.cause.details : n.cause?.message ? n.cause.message : n.details, o = n.cause instanceof Qn && n.cause.docsPath || n.docsPath, s = Bn.getDocsUrl?.({ ...n, docsPath: o }), i = [
      t || "An error occurred.",
      "",
      ...n.metaMessages ? [...n.metaMessages, ""] : [],
      ...s ? [`Docs: ${s}`] : [],
      ...r ? [`Details: ${r}`] : [],
      ...Bn.version ? [`Version: ${Bn.version}`] : []
    ].join(`
`);
    super(i, n.cause ? { cause: n.cause } : void 0), Object.defineProperty(this, "details", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "docsPath", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "metaMessages", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "shortMessage", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "version", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "BaseError"
    }), this.details = r, this.docsPath = o, this.metaMessages = n.metaMessages, this.name = n.name ?? this.name, this.shortMessage = t, this.version = ys;
  }
  walk(t) {
    return bs(this, t);
  }
};
function bs(e, t) {
  return t?.(e) ? e : e && typeof e == "object" && "cause" in e && e.cause !== void 0 ? bs(e.cause, t) : t ? null : e;
}
class ws extends N {
  constructor({ max: t, min: n, signed: r, size: o, value: s }) {
    super(`Number "${s}" is not in safe ${o ? `${o * 8}-bit ${r ? "signed" : "unsigned"} ` : ""}integer range ${t ? `(${n} to ${t})` : `(above ${n})`}`, { name: "IntegerOutOfRangeError" });
  }
}
class Du extends N {
  constructor(t) {
    super(`Bytes value "${t}" is not a valid boolean. The bytes array must contain a single byte of either a 0 or 1 value.`, {
      name: "InvalidBytesBooleanError"
    });
  }
}
class Pu extends N {
  constructor({ givenSize: t, maxSize: n }) {
    super(`Size cannot exceed ${n} bytes. Given size: ${t} bytes.`, { name: "SizeOverflowError" });
  }
}
class xs extends N {
  constructor({ offset: t, position: n, size: r }) {
    super(`Slice ${n === "start" ? "starting" : "ending"} at offset "${t}" is out-of-bounds (size: ${r}).`, { name: "SliceOffsetOutOfBoundsError" });
  }
}
class As extends N {
  constructor({ size: t, targetSize: n, type: r }) {
    super(`${r.charAt(0).toUpperCase()}${r.slice(1).toLowerCase()} size (${t}) exceeds padding size (${n}).`, { name: "SizeExceedsPaddingSizeError" });
  }
}
class wo extends N {
  constructor({ size: t, targetSize: n, type: r }) {
    super(`${r.charAt(0).toUpperCase()}${r.slice(1).toLowerCase()} is expected to be ${n} ${r} long, but is ${t} ${r} long.`, { name: "InvalidBytesLengthError" });
  }
}
function Mt(e, { dir: t, size: n = 32 } = {}) {
  return typeof e == "string" ? et(e, { dir: t, size: n }) : Lu(e, { dir: t, size: n });
}
function et(e, { dir: t, size: n = 32 } = {}) {
  if (n === null)
    return e;
  const r = e.replace("0x", "");
  if (r.length > n * 2)
    throw new As({
      size: Math.ceil(r.length / 2),
      targetSize: n,
      type: "hex"
    });
  return `0x${r[t === "right" ? "padEnd" : "padStart"](n * 2, "0")}`;
}
function Lu(e, { dir: t, size: n = 32 } = {}) {
  if (n === null)
    return e;
  if (e.length > n)
    throw new As({
      size: e.length,
      targetSize: n,
      type: "bytes"
    });
  const r = new Uint8Array(n);
  for (let o = 0; o < n; o++) {
    const s = t === "right";
    r[s ? o : n - o - 1] = e[s ? o : e.length - o - 1];
  }
  return r;
}
function nt(e, { strict: t = !0 } = {}) {
  return !e || typeof e != "string" ? !1 : t ? /^0x[0-9a-fA-F]*$/.test(e) : e.startsWith("0x");
}
function fe(e) {
  return nt(e, { strict: !1 }) ? Math.ceil((e.length - 2) / 2) : e.length;
}
function Br(e, { dir: t = "left" } = {}) {
  let n = typeof e == "string" ? e.replace("0x", "") : e, r = 0;
  for (let o = 0; o < n.length - 1 && n[t === "left" ? o : n.length - o - 1].toString() === "0"; o++)
    r++;
  return n = t === "left" ? n.slice(r) : n.slice(0, n.length - r), typeof e == "string" ? (n.length === 1 && t === "right" && (n = `${n}0`), `0x${n.length % 2 === 1 ? `0${n}` : n}`) : n;
}
const Ou = /* @__PURE__ */ new TextEncoder();
function Nr(e, t = {}) {
  return typeof e == "number" || typeof e == "bigint" ? Vu(e, t) : typeof e == "boolean" ? Gu(e, t) : nt(e) ? je(e, t) : Cs(e, t);
}
function Gu(e, t = {}) {
  const n = new Uint8Array(1);
  return n[0] = Number(e), typeof t.size == "number" ? (Le(n, { size: t.size }), Mt(n, { size: t.size })) : n;
}
const Ge = {
  zero: 48,
  nine: 57,
  A: 65,
  F: 70,
  a: 97,
  f: 102
};
function xo(e) {
  if (e >= Ge.zero && e <= Ge.nine)
    return e - Ge.zero;
  if (e >= Ge.A && e <= Ge.F)
    return e - (Ge.A - 10);
  if (e >= Ge.a && e <= Ge.f)
    return e - (Ge.a - 10);
}
function je(e, t = {}) {
  let n = e;
  t.size && (Le(n, { size: t.size }), n = Mt(n, { dir: "right", size: t.size }));
  let r = n.slice(2);
  r.length % 2 && (r = `0${r}`);
  const o = r.length / 2, s = new Uint8Array(o);
  for (let i = 0, u = 0; i < o; i++) {
    const d = xo(r.charCodeAt(u++)), h = xo(r.charCodeAt(u++));
    if (d === void 0 || h === void 0)
      throw new N(`Invalid byte sequence ("${r[u - 2]}${r[u - 1]}" in "${r}").`);
    s[i] = d * 16 + h;
  }
  return s;
}
function Vu(e, t) {
  const n = J(e, t);
  return je(n);
}
function Cs(e, t = {}) {
  const n = Ou.encode(e);
  return typeof t.size == "number" ? (Le(n, { size: t.size }), Mt(n, { dir: "right", size: t.size })) : n;
}
function Le(e, { size: t }) {
  if (fe(e) > t)
    throw new Pu({
      givenSize: fe(e),
      maxSize: t
    });
}
function kt(e, t = {}) {
  const { signed: n } = t;
  t.size && Le(e, { size: t.size });
  const r = BigInt(e);
  if (!n)
    return r;
  const o = (e.length - 2) / 2, s = (1n << BigInt(o) * 8n - 1n) - 1n;
  return r <= s ? r : r - BigInt(`0x${"f".padStart(o * 2, "f")}`) - 1n;
}
function ft(e, t = {}) {
  return Number(kt(e, t));
}
const Wu = /* @__PURE__ */ Array.from({ length: 256 }, (e, t) => t.toString(16).padStart(2, "0"));
function Hn(e, t = {}) {
  return typeof e == "number" || typeof e == "bigint" ? J(e, t) : typeof e == "string" ? Is(e, t) : typeof e == "boolean" ? vs(e, t) : be(e, t);
}
function vs(e, t = {}) {
  const n = `0x${Number(e)}`;
  return typeof t.size == "number" ? (Le(n, { size: t.size }), Mt(n, { size: t.size })) : n;
}
function be(e, t = {}) {
  let n = "";
  for (let o = 0; o < e.length; o++)
    n += Wu[e[o]];
  const r = `0x${n}`;
  return typeof t.size == "number" ? (Le(r, { size: t.size }), Mt(r, { dir: "right", size: t.size })) : r;
}
function J(e, t = {}) {
  const { signed: n, size: r } = t, o = BigInt(e);
  let s;
  r ? n ? s = (1n << BigInt(r) * 8n - 1n) - 1n : s = 2n ** (BigInt(r) * 8n) - 1n : typeof e == "number" && (s = BigInt(Number.MAX_SAFE_INTEGER));
  const i = typeof s == "bigint" && n ? -s - 1n : 0;
  if (s && o > s || o < i) {
    const d = typeof e == "bigint" ? "n" : "";
    throw new ws({
      max: s ? `${s}${d}` : void 0,
      min: `${i}${d}`,
      signed: n,
      size: r,
      value: `${e}${d}`
    });
  }
  const u = `0x${(n && o < 0 ? (1n << BigInt(r * 8)) + BigInt(o) : o).toString(16)}`;
  return r ? Mt(u, { size: r }) : u;
}
const Zu = /* @__PURE__ */ new TextEncoder();
function Is(e, t = {}) {
  const n = Zu.encode(e);
  return be(n, t);
}
function Xn(e, { includeName: t = !1 } = {}) {
  if (e.type !== "function" && e.type !== "event" && e.type !== "error")
    throw new nl(e.type);
  return `${e.name}(${Fr(e.inputs, { includeName: t })})`;
}
function Fr(e, { includeName: t = !1 } = {}) {
  return e ? e.map((n) => Ju(n, { includeName: t })).join(t ? ", " : ",") : "";
}
function Ju(e, { includeName: t }) {
  return e.type.startsWith("tuple") ? `(${Fr(e.components, { includeName: t })})${e.type.slice(5)}` : e.type + (t && e.name ? ` ${e.name}` : "");
}
class qu extends N {
  constructor({ docsPath: t }) {
    super([
      "A constructor was not found on the ABI.",
      "Make sure you are using the correct ABI and that the constructor exists on it."
    ].join(`
`), {
      docsPath: t,
      name: "AbiConstructorNotFoundError"
    });
  }
}
class Ao extends N {
  constructor({ docsPath: t }) {
    super([
      "Constructor arguments were provided (`args`), but a constructor parameters (`inputs`) were not found on the ABI.",
      "Make sure you are using the correct ABI, and that the `inputs` attribute on the constructor exists."
    ].join(`
`), {
      docsPath: t,
      name: "AbiConstructorParamsNotFoundError"
    });
  }
}
class ju extends N {
  constructor({ data: t, params: n, size: r }) {
    super([`Data size of ${r} bytes is too small for given parameters.`].join(`
`), {
      metaMessages: [
        `Params: (${Fr(n, { includeName: !0 })})`,
        `Data:   ${t} (${r} bytes)`
      ],
      name: "AbiDecodingDataSizeTooSmallError"
    }), Object.defineProperty(this, "data", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "params", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "size", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.data = t, this.params = n, this.size = r;
  }
}
class Yu extends N {
  constructor() {
    super('Cannot decode zero data ("0x") with ABI parameters.', {
      name: "AbiDecodingZeroDataError"
    });
  }
}
class Ku extends N {
  constructor({ expectedLength: t, givenLength: n, type: r }) {
    super([
      `ABI encoding array length mismatch for type ${r}.`,
      `Expected length: ${t}`,
      `Given length: ${n}`
    ].join(`
`), { name: "AbiEncodingArrayLengthMismatchError" });
  }
}
class Qu extends N {
  constructor({ expectedSize: t, value: n }) {
    super(`Size of bytes "${n}" (bytes${fe(n)}) does not match expected size (bytes${t}).`, { name: "AbiEncodingBytesSizeMismatchError" });
  }
}
class Hu extends N {
  constructor({ expectedLength: t, givenLength: n }) {
    super([
      "ABI encoding params/values length mismatch.",
      `Expected length (params): ${t}`,
      `Given length (values): ${n}`
    ].join(`
`), { name: "AbiEncodingLengthMismatchError" });
  }
}
class Hm extends N {
  constructor(t, { docsPath: n }) {
    super([
      `Encoded error signature "${t}" not found on ABI.`,
      "Make sure you are using the correct ABI and that the error exists on it.",
      `You can look up the decoded signature here: https://openchain.xyz/signatures?query=${t}.`
    ].join(`
`), {
      docsPath: n,
      name: "AbiErrorSignatureNotFoundError"
    }), Object.defineProperty(this, "signature", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.signature = t;
  }
}
class en extends N {
  constructor(t, { docsPath: n } = {}) {
    super([
      `Function ${t ? `"${t}" ` : ""}not found on ABI.`,
      "Make sure you are using the correct ABI and that the function exists on it."
    ].join(`
`), {
      docsPath: n,
      name: "AbiFunctionNotFoundError"
    });
  }
}
class Xu extends N {
  constructor(t, { docsPath: n }) {
    super([
      `Function "${t}" does not contain any \`outputs\` on ABI.`,
      "Cannot decode function result without knowing what the parameter types are.",
      "Make sure you are using the correct ABI and that the function exists on it."
    ].join(`
`), {
      docsPath: n,
      name: "AbiFunctionOutputsNotFoundError"
    });
  }
}
class $u extends N {
  constructor(t, n) {
    super("Found ambiguous types in overloaded ABI items.", {
      metaMessages: [
        `\`${t.type}\` in \`${Xn(t.abiItem)}\`, and`,
        `\`${n.type}\` in \`${Xn(n.abiItem)}\``,
        "",
        "These types encode differently and cannot be distinguished at runtime.",
        "Remove one of the ambiguous items in the ABI."
      ],
      name: "AbiItemAmbiguityError"
    });
  }
}
class _u extends N {
  constructor(t, { docsPath: n }) {
    super([
      `Type "${t}" is not a valid encoding type.`,
      "Please provide a valid ABI type."
    ].join(`
`), { docsPath: n, name: "InvalidAbiEncodingType" });
  }
}
class el extends N {
  constructor(t, { docsPath: n }) {
    super([
      `Type "${t}" is not a valid decoding type.`,
      "Please provide a valid ABI type."
    ].join(`
`), { docsPath: n, name: "InvalidAbiDecodingType" });
  }
}
class tl extends N {
  constructor(t) {
    super([`Value "${t}" is not a valid array.`].join(`
`), {
      name: "InvalidArrayError"
    });
  }
}
class nl extends N {
  constructor(t) {
    super([
      `"${t}" is not a valid definition type.`,
      'Valid types: "function", "event", "error"'
    ].join(`
`), { name: "InvalidDefinitionTypeError" });
  }
}
function St(e) {
  return typeof e[0] == "string" ? gn(e) : rl(e);
}
function rl(e) {
  let t = 0;
  for (const o of e)
    t += o.length;
  const n = new Uint8Array(t);
  let r = 0;
  for (const o of e)
    n.set(o, r), r += o.length;
  return n;
}
function gn(e) {
  return `0x${e.reduce((t, n) => t + n.replace("0x", ""), "")}`;
}
class Vt extends N {
  constructor({ address: t }) {
    super(`Address "${t}" is invalid.`, {
      metaMessages: [
        "- Address must be a hex value of 20 bytes (40 hex characters).",
        "- Address must match its checksum counterpart."
      ],
      name: "InvalidAddressError"
    });
  }
}
class Mr extends Map {
  constructor(t) {
    super(), Object.defineProperty(this, "maxSize", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.maxSize = t;
  }
  get(t) {
    const n = super.get(t);
    return super.has(t) && n !== void 0 && (this.delete(t), super.set(t, n)), n;
  }
  set(t, n) {
    if (super.set(t, n), this.maxSize && this.size > this.maxSize) {
      const r = this.keys().next().value;
      r && this.delete(r);
    }
    return this;
  }
}
function tn(e) {
  if (!Number.isSafeInteger(e) || e < 0)
    throw new Error("positive integer expected, got " + e);
}
function ol(e) {
  return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array";
}
function yn(e, ...t) {
  if (!ol(e))
    throw new Error("Uint8Array expected");
  if (t.length > 0 && !t.includes(e.length))
    throw new Error("Uint8Array expected of length " + t + ", got length=" + e.length);
}
function Xm(e) {
  if (typeof e != "function" || typeof e.create != "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  tn(e.outputLen), tn(e.blockLen);
}
function nn(e, t = !0) {
  if (e.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (t && e.finished)
    throw new Error("Hash#digest() has already been called");
}
function Es(e, t) {
  yn(e);
  const n = t.outputLen;
  if (e.length < n)
    throw new Error("digestInto() expects output buffer of length at least " + n);
}
const Ht = /* @__PURE__ */ BigInt(2 ** 32 - 1), Co = /* @__PURE__ */ BigInt(32);
function sl(e, t = !1) {
  return t ? { h: Number(e & Ht), l: Number(e >> Co & Ht) } : { h: Number(e >> Co & Ht) | 0, l: Number(e & Ht) | 0 };
}
function il(e, t = !1) {
  let n = new Uint32Array(e.length), r = new Uint32Array(e.length);
  for (let o = 0; o < e.length; o++) {
    const { h: s, l: i } = sl(e[o], t);
    [n[o], r[o]] = [s, i];
  }
  return [n, r];
}
const al = (e, t, n) => e << n | t >>> 32 - n, cl = (e, t, n) => t << n | e >>> 32 - n, ul = (e, t, n) => t << n - 32 | e >>> 64 - n, ll = (e, t, n) => e << n - 32 | t >>> 64 - n, bt = typeof globalThis == "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
function dl(e) {
  return new Uint32Array(e.buffer, e.byteOffset, Math.floor(e.byteLength / 4));
}
function Nn(e) {
  return new DataView(e.buffer, e.byteOffset, e.byteLength);
}
function Fe(e, t) {
  return e << 32 - t | e >>> t;
}
const vo = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function fl(e) {
  return e << 24 & 4278190080 | e << 8 & 16711680 | e >>> 8 & 65280 | e >>> 24 & 255;
}
function Io(e) {
  for (let t = 0; t < e.length; t++)
    e[t] = fl(e[t]);
}
function hl(e) {
  if (typeof e != "string")
    throw new Error("utf8ToBytes expected string, got " + typeof e);
  return new Uint8Array(new TextEncoder().encode(e));
}
function Rr(e) {
  return typeof e == "string" && (e = hl(e)), yn(e), e;
}
function $m(...e) {
  let t = 0;
  for (let r = 0; r < e.length; r++) {
    const o = e[r];
    yn(o), t += o.length;
  }
  const n = new Uint8Array(t);
  for (let r = 0, o = 0; r < e.length; r++) {
    const s = e[r];
    n.set(s, o), o += s.length;
  }
  return n;
}
class ks {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
}
function Ss(e) {
  const t = (r) => e().update(Rr(r)).digest(), n = e();
  return t.outputLen = n.outputLen, t.blockLen = n.blockLen, t.create = () => e(), t;
}
function _m(e = 32) {
  if (bt && typeof bt.getRandomValues == "function")
    return bt.getRandomValues(new Uint8Array(e));
  if (bt && typeof bt.randomBytes == "function")
    return bt.randomBytes(e);
  throw new Error("crypto.getRandomValues must be defined");
}
const Ts = [], Bs = [], Ns = [], ml = /* @__PURE__ */ BigInt(0), Ut = /* @__PURE__ */ BigInt(1), pl = /* @__PURE__ */ BigInt(2), gl = /* @__PURE__ */ BigInt(7), yl = /* @__PURE__ */ BigInt(256), bl = /* @__PURE__ */ BigInt(113);
for (let e = 0, t = Ut, n = 1, r = 0; e < 24; e++) {
  [n, r] = [r, (2 * n + 3 * r) % 5], Ts.push(2 * (5 * r + n)), Bs.push((e + 1) * (e + 2) / 2 % 64);
  let o = ml;
  for (let s = 0; s < 7; s++)
    t = (t << Ut ^ (t >> gl) * bl) % yl, t & pl && (o ^= Ut << (Ut << /* @__PURE__ */ BigInt(s)) - Ut);
  Ns.push(o);
}
const [wl, xl] = /* @__PURE__ */ il(Ns, !0), Eo = (e, t, n) => n > 32 ? ul(e, t, n) : al(e, t, n), ko = (e, t, n) => n > 32 ? ll(e, t, n) : cl(e, t, n);
function Al(e, t = 24) {
  const n = new Uint32Array(10);
  for (let r = 24 - t; r < 24; r++) {
    for (let i = 0; i < 10; i++)
      n[i] = e[i] ^ e[i + 10] ^ e[i + 20] ^ e[i + 30] ^ e[i + 40];
    for (let i = 0; i < 10; i += 2) {
      const u = (i + 8) % 10, d = (i + 2) % 10, h = n[d], l = n[d + 1], y = Eo(h, l, 1) ^ n[u], g = ko(h, l, 1) ^ n[u + 1];
      for (let b = 0; b < 50; b += 10)
        e[i + b] ^= y, e[i + b + 1] ^= g;
    }
    let o = e[2], s = e[3];
    for (let i = 0; i < 24; i++) {
      const u = Bs[i], d = Eo(o, s, u), h = ko(o, s, u), l = Ts[i];
      o = e[l], s = e[l + 1], e[l] = d, e[l + 1] = h;
    }
    for (let i = 0; i < 50; i += 10) {
      for (let u = 0; u < 10; u++)
        n[u] = e[i + u];
      for (let u = 0; u < 10; u++)
        e[i + u] ^= ~n[(u + 2) % 10] & n[(u + 4) % 10];
    }
    e[0] ^= wl[r], e[1] ^= xl[r];
  }
  n.fill(0);
}
class zr extends ks {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(t, n, r, o = !1, s = 24) {
    if (super(), this.blockLen = t, this.suffix = n, this.outputLen = r, this.enableXOF = o, this.rounds = s, this.pos = 0, this.posOut = 0, this.finished = !1, this.destroyed = !1, tn(r), 0 >= this.blockLen || this.blockLen >= 200)
      throw new Error("Sha3 supports only keccak-f1600 function");
    this.state = new Uint8Array(200), this.state32 = dl(this.state);
  }
  keccak() {
    vo || Io(this.state32), Al(this.state32, this.rounds), vo || Io(this.state32), this.posOut = 0, this.pos = 0;
  }
  update(t) {
    nn(this);
    const { blockLen: n, state: r } = this;
    t = Rr(t);
    const o = t.length;
    for (let s = 0; s < o; ) {
      const i = Math.min(n - this.pos, o - s);
      for (let u = 0; u < i; u++)
        r[this.pos++] ^= t[s++];
      this.pos === n && this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = !0;
    const { state: t, suffix: n, pos: r, blockLen: o } = this;
    t[r] ^= n, (n & 128) !== 0 && r === o - 1 && this.keccak(), t[o - 1] ^= 128, this.keccak();
  }
  writeInto(t) {
    nn(this, !1), yn(t), this.finish();
    const n = this.state, { blockLen: r } = this;
    for (let o = 0, s = t.length; o < s; ) {
      this.posOut >= r && this.keccak();
      const i = Math.min(r - this.posOut, s - o);
      t.set(n.subarray(this.posOut, this.posOut + i), o), this.posOut += i, o += i;
    }
    return t;
  }
  xofInto(t) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(t);
  }
  xof(t) {
    return tn(t), this.xofInto(new Uint8Array(t));
  }
  digestInto(t) {
    if (Es(t, this), this.finished)
      throw new Error("digest() was already called");
    return this.writeInto(t), this.destroy(), t;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = !0, this.state.fill(0);
  }
  _cloneInto(t) {
    const { blockLen: n, suffix: r, outputLen: o, rounds: s, enableXOF: i } = this;
    return t || (t = new zr(n, r, o, i, s)), t.state32.set(this.state32), t.pos = this.pos, t.posOut = this.posOut, t.finished = this.finished, t.rounds = s, t.suffix = r, t.outputLen = o, t.enableXOF = i, t.destroyed = this.destroyed, t;
  }
}
const Cl = (e, t, n) => Ss(() => new zr(t, e, n)), vl = /* @__PURE__ */ Cl(1, 136, 256 / 8);
function bn(e, t) {
  const n = t || "hex", r = vl(nt(e, { strict: !1 }) ? Nr(e) : e);
  return n === "bytes" ? r : Hn(r);
}
const Fn = /* @__PURE__ */ new Mr(8192);
function wn(e, t) {
  if (Fn.has(`${e}.${t}`))
    return Fn.get(`${e}.${t}`);
  const n = e.substring(2).toLowerCase(), r = bn(Cs(n), "bytes"), o = n.split("");
  for (let i = 0; i < 40; i += 2)
    r[i >> 1] >> 4 >= 8 && o[i] && (o[i] = o[i].toUpperCase()), (r[i >> 1] & 15) >= 8 && o[i + 1] && (o[i + 1] = o[i + 1].toUpperCase());
  const s = `0x${o.join("")}`;
  return Fn.set(`${e}.${t}`, s), s;
}
function Il(e, t) {
  if (!rt(e, { strict: !1 }))
    throw new Vt({ address: e });
  return wn(e, t);
}
const El = /^0x[a-fA-F0-9]{40}$/, Mn = /* @__PURE__ */ new Mr(8192);
function rt(e, t) {
  const { strict: n = !0 } = t ?? {}, r = `${e}.${n}`;
  if (Mn.has(r))
    return Mn.get(r);
  const o = El.test(e) ? e.toLowerCase() === e ? !0 : n ? wn(e) === e : !0 : !1;
  return Mn.set(r, o), o;
}
function Fs(e, t, n, { strict: r } = {}) {
  return nt(e, { strict: !1 }) ? kl(e, t, n, {
    strict: r
  }) : zs(e, t, n, {
    strict: r
  });
}
function Ms(e, t) {
  if (typeof t == "number" && t > 0 && t > fe(e) - 1)
    throw new xs({
      offset: t,
      position: "start",
      size: fe(e)
    });
}
function Rs(e, t, n) {
  if (typeof t == "number" && typeof n == "number" && fe(e) !== n - t)
    throw new xs({
      offset: n,
      position: "end",
      size: fe(e)
    });
}
function zs(e, t, n, { strict: r } = {}) {
  Ms(e, t);
  const o = e.slice(t, n);
  return r && Rs(o, t, n), o;
}
function kl(e, t, n, { strict: r } = {}) {
  Ms(e, t);
  const o = `0x${e.replace("0x", "").slice((t ?? 0) * 2, (n ?? e.length) * 2)}`;
  return r && Rs(o, t, n), o;
}
const Sl = /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
function Us(e, t) {
  if (e.length !== t.length)
    throw new Hu({
      expectedLength: e.length,
      givenLength: t.length
    });
  const n = Tl({
    params: e,
    values: t
  }), r = Dr(n);
  return r.length === 0 ? "0x" : r;
}
function Tl({ params: e, values: t }) {
  const n = [];
  for (let r = 0; r < e.length; r++)
    n.push(Ur({ param: e[r], value: t[r] }));
  return n;
}
function Ur({ param: e, value: t }) {
  const n = Pr(e.type);
  if (n) {
    const [r, o] = n;
    return Nl(t, { length: r, param: { ...e, type: o } });
  }
  if (e.type === "tuple")
    return Ul(t, {
      param: e
    });
  if (e.type === "address")
    return Bl(t);
  if (e.type === "bool")
    return Ml(t);
  if (e.type.startsWith("uint") || e.type.startsWith("int")) {
    const r = e.type.startsWith("int"), [, , o = "256"] = Sl.exec(e.type) ?? [];
    return Rl(t, {
      signed: r,
      size: Number(o)
    });
  }
  if (e.type.startsWith("bytes"))
    return Fl(t, { param: e });
  if (e.type === "string")
    return zl(t);
  throw new _u(e.type, {
    docsPath: "/docs/contract/encodeAbiParameters"
  });
}
function Dr(e) {
  let t = 0;
  for (let s = 0; s < e.length; s++) {
    const { dynamic: i, encoded: u } = e[s];
    i ? t += 32 : t += fe(u);
  }
  const n = [], r = [];
  let o = 0;
  for (let s = 0; s < e.length; s++) {
    const { dynamic: i, encoded: u } = e[s];
    i ? (n.push(J(t + o, { size: 32 })), r.push(u), o += fe(u)) : n.push(u);
  }
  return St([...n, ...r]);
}
function Bl(e) {
  if (!rt(e))
    throw new Vt({ address: e });
  return { dynamic: !1, encoded: et(e.toLowerCase()) };
}
function Nl(e, { length: t, param: n }) {
  const r = t === null;
  if (!Array.isArray(e))
    throw new tl(e);
  if (!r && e.length !== t)
    throw new Ku({
      expectedLength: t,
      givenLength: e.length,
      type: `${n.type}[${t}]`
    });
  let o = !1;
  const s = [];
  for (let i = 0; i < e.length; i++) {
    const u = Ur({ param: n, value: e[i] });
    u.dynamic && (o = !0), s.push(u);
  }
  if (r || o) {
    const i = Dr(s);
    if (r) {
      const u = J(s.length, { size: 32 });
      return {
        dynamic: !0,
        encoded: s.length > 0 ? St([u, i]) : u
      };
    }
    if (o)
      return { dynamic: !0, encoded: i };
  }
  return {
    dynamic: !1,
    encoded: St(s.map(({ encoded: i }) => i))
  };
}
function Fl(e, { param: t }) {
  const [, n] = t.type.split("bytes"), r = fe(e);
  if (!n) {
    let o = e;
    return r % 32 !== 0 && (o = et(o, {
      dir: "right",
      size: Math.ceil((e.length - 2) / 2 / 32) * 32
    })), {
      dynamic: !0,
      encoded: St([et(J(r, { size: 32 })), o])
    };
  }
  if (r !== Number.parseInt(n))
    throw new Qu({
      expectedSize: Number.parseInt(n),
      value: e
    });
  return { dynamic: !1, encoded: et(e, { dir: "right" }) };
}
function Ml(e) {
  if (typeof e != "boolean")
    throw new N(`Invalid boolean value: "${e}" (type: ${typeof e}). Expected: \`true\` or \`false\`.`);
  return { dynamic: !1, encoded: et(vs(e)) };
}
function Rl(e, { signed: t, size: n = 256 }) {
  if (typeof n == "number") {
    const r = 2n ** (BigInt(n) - (t ? 1n : 0n)) - 1n, o = t ? -r - 1n : 0n;
    if (e > r || e < o)
      throw new ws({
        max: r.toString(),
        min: o.toString(),
        signed: t,
        size: n / 8,
        value: e.toString()
      });
  }
  return {
    dynamic: !1,
    encoded: J(e, {
      size: 32,
      signed: t
    })
  };
}
function zl(e) {
  const t = Is(e), n = Math.ceil(fe(t) / 32), r = [];
  for (let o = 0; o < n; o++)
    r.push(et(Fs(t, o * 32, (o + 1) * 32), {
      dir: "right"
    }));
  return {
    dynamic: !0,
    encoded: St([
      et(J(fe(t), { size: 32 })),
      ...r
    ])
  };
}
function Ul(e, { param: t }) {
  let n = !1;
  const r = [];
  for (let o = 0; o < t.components.length; o++) {
    const s = t.components[o], i = Array.isArray(e) ? o : s.name, u = Ur({
      param: s,
      value: e[i]
    });
    r.push(u), u.dynamic && (n = !0);
  }
  return {
    dynamic: n,
    encoded: n ? Dr(r) : St(r.map(({ encoded: o }) => o))
  };
}
function Pr(e) {
  const t = e.match(/^(.*)\[(\d+)?\]$/);
  return t ? (
    // Return `null` if the array is dynamic.
    [t[2] ? Number(t[2]) : null, t[1]]
  ) : void 0;
}
const Rn = "/docs/contract/encodeDeployData";
function Ds(e) {
  const { abi: t, args: n, bytecode: r } = e;
  if (!n || n.length === 0)
    return r;
  const o = t.find((i) => "type" in i && i.type === "constructor");
  if (!o)
    throw new qu({ docsPath: Rn });
  if (!("inputs" in o))
    throw new Ao({ docsPath: Rn });
  if (!o.inputs || o.inputs.length === 0)
    throw new Ao({ docsPath: Rn });
  const s = Us(o.inputs, n);
  return gn([r, s]);
}
function mt(e) {
  return typeof e == "string" ? { address: e, type: "json-rpc" } : e;
}
class Dl extends N {
  constructor({ docsPath: t } = {}) {
    super([
      "Could not find an Account to execute with this Action.",
      "Please provide an Account with the `account` argument on the Action, or by supplying an `account` to the Client."
    ].join(`
`), {
      docsPath: t,
      docsSlug: "account",
      name: "AccountNotFoundError"
    });
  }
}
class zn extends N {
  constructor({ docsPath: t, metaMessages: n, type: r }) {
    super(`Account type "${r}" is not supported.`, {
      docsPath: t,
      metaMessages: n,
      name: "AccountTypeNotSupportedError"
    });
  }
}
function Pl(e) {
  const t = bn(`0x${e.substring(4)}`).substring(26);
  return wn(`0x${t}`);
}
async function Ll({ hash: e, signature: t }) {
  const n = nt(e) ? e : Hn(e), { secp256k1: r } = await import("./secp256k1-B5prHBfA.js");
  return `0x${(() => {
    if (typeof t == "object" && "r" in t && "s" in t) {
      const { r: h, s: l, v: y, yParity: g } = t, b = Number(g ?? y), x = So(b);
      return new r.Signature(kt(h), kt(l)).addRecoveryBit(x);
    }
    const i = nt(t) ? t : Hn(t), u = ft(`0x${i.slice(130)}`), d = So(u);
    return r.Signature.fromCompact(i.substring(2, 130)).addRecoveryBit(d);
  })().recoverPublicKey(n.substring(2)).toHex(!1)}`;
}
function So(e) {
  if (e === 0 || e === 1)
    return e;
  if (e === 27)
    return 0;
  if (e === 28)
    return 1;
  throw new Error("Invalid yParityOrV value");
}
async function Ol({ hash: e, signature: t }) {
  return Pl(await Ll({ hash: e, signature: t }));
}
class To extends N {
  constructor({ offset: t }) {
    super(`Offset \`${t}\` cannot be negative.`, {
      name: "NegativeOffsetError"
    });
  }
}
class Gl extends N {
  constructor({ length: t, position: n }) {
    super(`Position \`${n}\` is out of bounds (\`0 < position < ${t}\`).`, { name: "PositionOutOfBoundsError" });
  }
}
class Vl extends N {
  constructor({ count: t, limit: n }) {
    super(`Recursive read limit of \`${n}\` exceeded (recursive read count: \`${t}\`).`, { name: "RecursiveReadLimitExceededError" });
  }
}
const Wl = {
  bytes: new Uint8Array(),
  dataView: new DataView(new ArrayBuffer(0)),
  position: 0,
  positionReadCount: /* @__PURE__ */ new Map(),
  recursiveReadCount: 0,
  recursiveReadLimit: Number.POSITIVE_INFINITY,
  assertReadLimit() {
    if (this.recursiveReadCount >= this.recursiveReadLimit)
      throw new Vl({
        count: this.recursiveReadCount + 1,
        limit: this.recursiveReadLimit
      });
  },
  assertPosition(e) {
    if (e < 0 || e > this.bytes.length - 1)
      throw new Gl({
        length: this.bytes.length,
        position: e
      });
  },
  decrementPosition(e) {
    if (e < 0)
      throw new To({ offset: e });
    const t = this.position - e;
    this.assertPosition(t), this.position = t;
  },
  getReadCount(e) {
    return this.positionReadCount.get(e || this.position) || 0;
  },
  incrementPosition(e) {
    if (e < 0)
      throw new To({ offset: e });
    const t = this.position + e;
    this.assertPosition(t), this.position = t;
  },
  inspectByte(e) {
    const t = e ?? this.position;
    return this.assertPosition(t), this.bytes[t];
  },
  inspectBytes(e, t) {
    const n = t ?? this.position;
    return this.assertPosition(n + e - 1), this.bytes.subarray(n, n + e);
  },
  inspectUint8(e) {
    const t = e ?? this.position;
    return this.assertPosition(t), this.bytes[t];
  },
  inspectUint16(e) {
    const t = e ?? this.position;
    return this.assertPosition(t + 1), this.dataView.getUint16(t);
  },
  inspectUint24(e) {
    const t = e ?? this.position;
    return this.assertPosition(t + 2), (this.dataView.getUint16(t) << 8) + this.dataView.getUint8(t + 2);
  },
  inspectUint32(e) {
    const t = e ?? this.position;
    return this.assertPosition(t + 3), this.dataView.getUint32(t);
  },
  pushByte(e) {
    this.assertPosition(this.position), this.bytes[this.position] = e, this.position++;
  },
  pushBytes(e) {
    this.assertPosition(this.position + e.length - 1), this.bytes.set(e, this.position), this.position += e.length;
  },
  pushUint8(e) {
    this.assertPosition(this.position), this.bytes[this.position] = e, this.position++;
  },
  pushUint16(e) {
    this.assertPosition(this.position + 1), this.dataView.setUint16(this.position, e), this.position += 2;
  },
  pushUint24(e) {
    this.assertPosition(this.position + 2), this.dataView.setUint16(this.position, e >> 8), this.dataView.setUint8(this.position + 2, e & 255), this.position += 3;
  },
  pushUint32(e) {
    this.assertPosition(this.position + 3), this.dataView.setUint32(this.position, e), this.position += 4;
  },
  readByte() {
    this.assertReadLimit(), this._touch();
    const e = this.inspectByte();
    return this.position++, e;
  },
  readBytes(e, t) {
    this.assertReadLimit(), this._touch();
    const n = this.inspectBytes(e);
    return this.position += t ?? e, n;
  },
  readUint8() {
    this.assertReadLimit(), this._touch();
    const e = this.inspectUint8();
    return this.position += 1, e;
  },
  readUint16() {
    this.assertReadLimit(), this._touch();
    const e = this.inspectUint16();
    return this.position += 2, e;
  },
  readUint24() {
    this.assertReadLimit(), this._touch();
    const e = this.inspectUint24();
    return this.position += 3, e;
  },
  readUint32() {
    this.assertReadLimit(), this._touch();
    const e = this.inspectUint32();
    return this.position += 4, e;
  },
  get remaining() {
    return this.bytes.length - this.position;
  },
  setPosition(e) {
    const t = this.position;
    return this.assertPosition(e), this.position = e, () => this.position = t;
  },
  _touch() {
    if (this.recursiveReadLimit === Number.POSITIVE_INFINITY)
      return;
    const e = this.getReadCount();
    this.positionReadCount.set(this.position, e + 1), e > 0 && this.recursiveReadCount++;
  }
};
function Lr(e, { recursiveReadLimit: t = 8192 } = {}) {
  const n = Object.create(Wl);
  return n.bytes = e, n.dataView = new DataView(e.buffer, e.byteOffset, e.byteLength), n.positionReadCount = /* @__PURE__ */ new Map(), n.recursiveReadLimit = t, n;
}
function Zl(e, t = "hex") {
  const n = Ps(e), r = Lr(new Uint8Array(n.length));
  return n.encode(r), t === "hex" ? be(r.bytes) : r.bytes;
}
function Ps(e) {
  return Array.isArray(e) ? Jl(e.map((t) => Ps(t))) : ql(e);
}
function Jl(e) {
  const t = e.reduce((o, s) => o + s.length, 0), n = Ls(t);
  return {
    length: t <= 55 ? 1 + t : 1 + n + t,
    encode(o) {
      t <= 55 ? o.pushByte(192 + t) : (o.pushByte(247 + n), n === 1 ? o.pushUint8(t) : n === 2 ? o.pushUint16(t) : n === 3 ? o.pushUint24(t) : o.pushUint32(t));
      for (const { encode: s } of e)
        s(o);
    }
  };
}
function ql(e) {
  const t = typeof e == "string" ? je(e) : e, n = Ls(t.length);
  return {
    length: t.length === 1 && t[0] < 128 ? 1 : t.length <= 55 ? 1 + t.length : 1 + n + t.length,
    encode(o) {
      t.length === 1 && t[0] < 128 ? o.pushBytes(t) : t.length <= 55 ? (o.pushByte(128 + t.length), o.pushBytes(t)) : (o.pushByte(183 + n), n === 1 ? o.pushUint8(t.length) : n === 2 ? o.pushUint16(t.length) : n === 3 ? o.pushUint24(t.length) : o.pushUint32(t.length), o.pushBytes(t));
    }
  };
}
function Ls(e) {
  if (e < 2 ** 8)
    return 1;
  if (e < 2 ** 16)
    return 2;
  if (e < 2 ** 24)
    return 3;
  if (e < 2 ** 32)
    return 4;
  throw new N("Length is too large.");
}
function jl(e) {
  const { chainId: t, contractAddress: n, nonce: r, to: o } = e, s = bn(gn([
    "0x05",
    Zl([
      t ? J(t) : "0x",
      n,
      r ? J(r) : "0x"
    ])
  ]));
  return o === "bytes" ? je(s) : s;
}
async function Os(e) {
  const { authorization: t, signature: n } = e;
  return Ol({
    hash: jl(t),
    signature: n ?? t
  });
}
class $n extends N {
  constructor({ blockNumber: t, chain: n, contract: r }) {
    super(`Chain "${n.name}" does not support contract "${r.name}".`, {
      metaMessages: [
        "This could be due to any of the following:",
        ...t && r.blockCreated && r.blockCreated > t ? [
          `- The contract "${r.name}" was not deployed until block ${r.blockCreated} (current block ${t}).`
        ] : [
          `- The chain does not have the contract "${r.name}" configured.`
        ]
      ],
      name: "ChainDoesNotSupportContract"
    });
  }
}
class Yl extends N {
  constructor({ chain: t, currentChainId: n }) {
    super(`The current chain of the wallet (id: ${n}) does not match the target chain for the transaction (id: ${t.id} – ${t.name}).`, {
      metaMessages: [
        `Current Chain ID:  ${n}`,
        `Expected Chain ID: ${t.id} – ${t.name}`
      ],
      name: "ChainMismatchError"
    });
  }
}
class Kl extends N {
  constructor() {
    super([
      "No chain was provided to the request.",
      "Please provide a chain with the `chain` argument on the Action, or by supplying a `chain` to WalletClient."
    ].join(`
`), {
      name: "ChainNotFoundError"
    });
  }
}
class Gs extends N {
  constructor() {
    super("No chain was provided to the Client.", {
      name: "ClientChainNotConfiguredError"
    });
  }
}
function Ql({ chain: e, currentChainId: t }) {
  if (!e)
    throw new Kl();
  if (t !== e.id)
    throw new Yl({ chain: e, currentChainId: t });
}
const Hl = {
  gwei: 9,
  wei: 18
}, Xl = {
  ether: -9,
  wei: 9
};
function Vs(e, t) {
  let n = e.toString();
  const r = n.startsWith("-");
  r && (n = n.slice(1)), n = n.padStart(t, "0");
  let [o, s] = [
    n.slice(0, n.length - t),
    n.slice(n.length - t)
  ];
  return s = s.replace(/(0+)$/, ""), `${r ? "-" : ""}${o || "0"}${s ? `.${s}` : ""}`;
}
function ge(e, t = "wei") {
  return Vs(e, Xl[t]);
}
class wt extends N {
  constructor({ cause: t, message: n } = {}) {
    const r = n?.replace("execution reverted: ", "")?.replace("execution reverted", "");
    super(`Execution reverted ${r ? `with reason: ${r}` : "for an unknown reason"}.`, {
      cause: t,
      name: "ExecutionRevertedError"
    });
  }
}
Object.defineProperty(wt, "code", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: 3
});
Object.defineProperty(wt, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /execution reverted/
});
class rn extends N {
  constructor({ cause: t, maxFeePerGas: n } = {}) {
    super(`The fee cap (\`maxFeePerGas\`${n ? ` = ${ge(n)} gwei` : ""}) cannot be higher than the maximum allowed value (2^256-1).`, {
      cause: t,
      name: "FeeCapTooHighError"
    });
  }
}
Object.defineProperty(rn, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /max fee per gas higher than 2\^256-1|fee cap higher than 2\^256-1/
});
class _n extends N {
  constructor({ cause: t, maxFeePerGas: n } = {}) {
    super(`The fee cap (\`maxFeePerGas\`${n ? ` = ${ge(n)}` : ""} gwei) cannot be lower than the block base fee.`, {
      cause: t,
      name: "FeeCapTooLowError"
    });
  }
}
Object.defineProperty(_n, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /max fee per gas less than block base fee|fee cap less than block base fee|transaction is outdated/
});
class er extends N {
  constructor({ cause: t, nonce: n } = {}) {
    super(`Nonce provided for the transaction ${n ? `(${n}) ` : ""}is higher than the next one expected.`, { cause: t, name: "NonceTooHighError" });
  }
}
Object.defineProperty(er, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /nonce too high/
});
class tr extends N {
  constructor({ cause: t, nonce: n } = {}) {
    super([
      `Nonce provided for the transaction ${n ? `(${n}) ` : ""}is lower than the current nonce of the account.`,
      "Try increasing the nonce or find the latest nonce with `getTransactionCount`."
    ].join(`
`), { cause: t, name: "NonceTooLowError" });
  }
}
Object.defineProperty(tr, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /nonce too low|transaction already imported|already known/
});
class nr extends N {
  constructor({ cause: t, nonce: n } = {}) {
    super(`Nonce provided for the transaction ${n ? `(${n}) ` : ""}exceeds the maximum allowed nonce.`, { cause: t, name: "NonceMaxValueError" });
  }
}
Object.defineProperty(nr, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /nonce has max value/
});
class rr extends N {
  constructor({ cause: t } = {}) {
    super([
      "The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account."
    ].join(`
`), {
      cause: t,
      metaMessages: [
        "This error could arise when the account does not have enough funds to:",
        " - pay for the total gas fee,",
        " - pay for the value to send.",
        " ",
        "The cost of the transaction is calculated as `gas * gas fee + value`, where:",
        " - `gas` is the amount of gas needed for transaction to execute,",
        " - `gas fee` is the gas fee,",
        " - `value` is the amount of ether to send to the recipient."
      ],
      name: "InsufficientFundsError"
    });
  }
}
Object.defineProperty(rr, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /insufficient funds|exceeds transaction sender account balance/
});
class or extends N {
  constructor({ cause: t, gas: n } = {}) {
    super(`The amount of gas ${n ? `(${n}) ` : ""}provided for the transaction exceeds the limit allowed for the block.`, {
      cause: t,
      name: "IntrinsicGasTooHighError"
    });
  }
}
Object.defineProperty(or, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /intrinsic gas too high|gas limit reached/
});
class sr extends N {
  constructor({ cause: t, gas: n } = {}) {
    super(`The amount of gas ${n ? `(${n}) ` : ""}provided for the transaction is too low.`, {
      cause: t,
      name: "IntrinsicGasTooLowError"
    });
  }
}
Object.defineProperty(sr, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /intrinsic gas too low/
});
class ir extends N {
  constructor({ cause: t }) {
    super("The transaction type is not supported for this chain.", {
      cause: t,
      name: "TransactionTypeNotSupportedError"
    });
  }
}
Object.defineProperty(ir, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /transaction type not valid/
});
class on extends N {
  constructor({ cause: t, maxPriorityFeePerGas: n, maxFeePerGas: r } = {}) {
    super([
      `The provided tip (\`maxPriorityFeePerGas\`${n ? ` = ${ge(n)} gwei` : ""}) cannot be higher than the fee cap (\`maxFeePerGas\`${r ? ` = ${ge(r)} gwei` : ""}).`
    ].join(`
`), {
      cause: t,
      name: "TipAboveFeeCapError"
    });
  }
}
Object.defineProperty(on, "nodeMessage", {
  enumerable: !0,
  configurable: !0,
  writable: !0,
  value: /max priority fee per gas higher than max fee per gas|tip higher than fee cap/
});
class xn extends N {
  constructor({ cause: t }) {
    super(`An error occurred while executing: ${t?.shortMessage}`, {
      cause: t,
      name: "UnknownNodeError"
    });
  }
}
function Or(e, t = "wei") {
  return Vs(e, Hl[t]);
}
function An(e) {
  const t = Object.entries(e).map(([r, o]) => o === void 0 || o === !1 ? null : [r, o]).filter(Boolean), n = t.reduce((r, [o]) => Math.max(r, o.length), 0);
  return t.map(([r, o]) => `  ${`${r}:`.padEnd(n + 1)}  ${o}`).join(`
`);
}
class $l extends N {
  constructor() {
    super([
      "Cannot specify both a `gasPrice` and a `maxFeePerGas`/`maxPriorityFeePerGas`.",
      "Use `maxFeePerGas`/`maxPriorityFeePerGas` for EIP-1559 compatible networks, and `gasPrice` for others."
    ].join(`
`), { name: "FeeConflictError" });
  }
}
class _l extends N {
  constructor({ transaction: t }) {
    super("Cannot infer a transaction type from provided transaction.", {
      metaMessages: [
        "Provided Transaction:",
        "{",
        An(t),
        "}",
        "",
        "To infer the type, either provide:",
        "- a `type` to the Transaction, or",
        "- an EIP-1559 Transaction with `maxFeePerGas`, or",
        "- an EIP-2930 Transaction with `gasPrice` & `accessList`, or",
        "- an EIP-4844 Transaction with `blobs`, `blobVersionedHashes`, `sidecars`, or",
        "- an EIP-7702 Transaction with `authorizationList`, or",
        "- a Legacy Transaction with `gasPrice`"
      ],
      name: "InvalidSerializableTransactionError"
    });
  }
}
class ed extends N {
  constructor(t, { account: n, docsPath: r, chain: o, data: s, gas: i, gasPrice: u, maxFeePerGas: d, maxPriorityFeePerGas: h, nonce: l, to: y, value: g }) {
    const b = An({
      chain: o && `${o?.name} (id: ${o?.id})`,
      from: n?.address,
      to: y,
      value: typeof g < "u" && `${Or(g)} ${o?.nativeCurrency?.symbol || "ETH"}`,
      data: s,
      gas: i,
      gasPrice: typeof u < "u" && `${ge(u)} gwei`,
      maxFeePerGas: typeof d < "u" && `${ge(d)} gwei`,
      maxPriorityFeePerGas: typeof h < "u" && `${ge(h)} gwei`,
      nonce: l
    });
    super(t.shortMessage, {
      cause: t,
      docsPath: r,
      metaMessages: [
        ...t.metaMessages ? [...t.metaMessages, " "] : [],
        "Request Arguments:",
        b
      ].filter(Boolean),
      name: "TransactionExecutionError"
    }), Object.defineProperty(this, "cause", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.cause = t;
  }
}
class Ws extends N {
  constructor({ blockHash: t, blockNumber: n, blockTag: r, hash: o, index: s }) {
    let i = "Transaction";
    r && s !== void 0 && (i = `Transaction at block time "${r}" at index "${s}"`), t && s !== void 0 && (i = `Transaction at block hash "${t}" at index "${s}"`), n && s !== void 0 && (i = `Transaction at block number "${n}" at index "${s}"`), o && (i = `Transaction with hash "${o}"`), super(`${i} could not be found.`, {
      name: "TransactionNotFoundError"
    });
  }
}
class Zs extends N {
  constructor({ hash: t }) {
    super(`Transaction receipt with hash "${t}" could not be found. The Transaction may not be processed on a block yet.`, {
      name: "TransactionReceiptNotFoundError"
    });
  }
}
class td extends N {
  constructor({ hash: t }) {
    super(`Timed out while waiting for transaction with hash "${t}" to be confirmed.`, { name: "WaitForTransactionReceiptTimeoutError" });
  }
}
const ar = (e, t, n) => JSON.stringify(e, (r, o) => typeof o == "bigint" ? o.toString() : o, n);
function Gr(e, t) {
  const n = (e.details || "").toLowerCase(), r = e instanceof N ? e.walk((o) => o?.code === wt.code) : e;
  return r instanceof N ? new wt({
    cause: e,
    message: r.details
  }) : wt.nodeMessage.test(n) ? new wt({
    cause: e,
    message: e.details
  }) : rn.nodeMessage.test(n) ? new rn({
    cause: e,
    maxFeePerGas: t?.maxFeePerGas
  }) : _n.nodeMessage.test(n) ? new _n({
    cause: e,
    maxFeePerGas: t?.maxFeePerGas
  }) : er.nodeMessage.test(n) ? new er({ cause: e, nonce: t?.nonce }) : tr.nodeMessage.test(n) ? new tr({ cause: e, nonce: t?.nonce }) : nr.nodeMessage.test(n) ? new nr({ cause: e, nonce: t?.nonce }) : rr.nodeMessage.test(n) ? new rr({ cause: e }) : or.nodeMessage.test(n) ? new or({ cause: e, gas: t?.gas }) : sr.nodeMessage.test(n) ? new sr({ cause: e, gas: t?.gas }) : ir.nodeMessage.test(n) ? new ir({ cause: e }) : on.nodeMessage.test(n) ? new on({
    cause: e,
    maxFeePerGas: t?.maxFeePerGas,
    maxPriorityFeePerGas: t?.maxPriorityFeePerGas
  }) : new xn({
    cause: e
  });
}
function nd(e, { docsPath: t, ...n }) {
  const r = (() => {
    const o = Gr(e, n);
    return o instanceof xn ? e : o;
  })();
  return new ed(r, {
    docsPath: t,
    ...n
  });
}
function Vr(e, { format: t }) {
  if (!t)
    return {};
  const n = {};
  function r(s) {
    const i = Object.keys(s);
    for (const u of i)
      u in e && (n[u] = e[u]), s[u] && typeof s[u] == "object" && !Array.isArray(s[u]) && r(s[u]);
  }
  const o = t(e || {});
  return r(o), n;
}
const rd = {
  legacy: "0x0",
  eip2930: "0x1",
  eip1559: "0x2",
  eip4844: "0x3",
  eip7702: "0x4"
};
function Wr(e) {
  const t = {};
  return typeof e.authorizationList < "u" && (t.authorizationList = od(e.authorizationList)), typeof e.accessList < "u" && (t.accessList = e.accessList), typeof e.blobVersionedHashes < "u" && (t.blobVersionedHashes = e.blobVersionedHashes), typeof e.blobs < "u" && (typeof e.blobs[0] != "string" ? t.blobs = e.blobs.map((n) => be(n)) : t.blobs = e.blobs), typeof e.data < "u" && (t.data = e.data), typeof e.from < "u" && (t.from = e.from), typeof e.gas < "u" && (t.gas = J(e.gas)), typeof e.gasPrice < "u" && (t.gasPrice = J(e.gasPrice)), typeof e.maxFeePerBlobGas < "u" && (t.maxFeePerBlobGas = J(e.maxFeePerBlobGas)), typeof e.maxFeePerGas < "u" && (t.maxFeePerGas = J(e.maxFeePerGas)), typeof e.maxPriorityFeePerGas < "u" && (t.maxPriorityFeePerGas = J(e.maxPriorityFeePerGas)), typeof e.nonce < "u" && (t.nonce = J(e.nonce)), typeof e.to < "u" && (t.to = e.to), typeof e.type < "u" && (t.type = rd[e.type]), typeof e.value < "u" && (t.value = J(e.value)), t;
}
function od(e) {
  return e.map((t) => ({
    address: t.contractAddress,
    r: t.r,
    s: t.s,
    chainId: J(t.chainId),
    nonce: J(t.nonce),
    ...typeof t.yParity < "u" ? { yParity: J(t.yParity) } : {},
    ...typeof t.v < "u" && typeof t.yParity > "u" ? { v: J(t.v) } : {}
  }));
}
function ue(e, t, n) {
  const r = e[t.name];
  if (typeof r == "function")
    return r;
  const o = e[n];
  return typeof o == "function" ? o : (s) => t(e, s);
}
const sd = 2n ** 256n - 1n;
function Cn(e) {
  const { account: t, gasPrice: n, maxFeePerGas: r, maxPriorityFeePerGas: o, to: s } = e, i = t ? mt(t) : void 0;
  if (i && !rt(i.address))
    throw new Vt({ address: i.address });
  if (s && !rt(s))
    throw new Vt({ address: s });
  if (typeof n < "u" && (typeof r < "u" || typeof o < "u"))
    throw new $l();
  if (r && r > sd)
    throw new rn({ maxFeePerGas: r });
  if (o && r && o > r)
    throw new on({ maxFeePerGas: r, maxPriorityFeePerGas: o });
}
async function Js(e) {
  const t = await e.request({
    method: "eth_chainId"
  }, { dedupe: !0 });
  return ft(t);
}
class id extends N {
  constructor() {
    super("`baseFeeMultiplier` must be greater than 1.", {
      name: "BaseFeeScalarError"
    });
  }
}
class Zr extends N {
  constructor() {
    super("Chain does not support EIP-1559 fees.", {
      name: "Eip1559FeesNotSupportedError"
    });
  }
}
class ad extends N {
  constructor({ maxPriorityFeePerGas: t }) {
    super(`\`maxFeePerGas\` cannot be less than the \`maxPriorityFeePerGas\` (${ge(t)} gwei).`, { name: "MaxFeePerGasTooLowError" });
  }
}
class qs extends N {
  constructor({ blockHash: t, blockNumber: n }) {
    let r = "Block";
    t && (r = `Block at hash "${t}"`), n && (r = `Block at number "${n}"`), super(`${r} could not be found.`, { name: "BlockNotFoundError" });
  }
}
const js = {
  "0x0": "legacy",
  "0x1": "eip2930",
  "0x2": "eip1559",
  "0x3": "eip4844",
  "0x4": "eip7702"
};
function Ys(e) {
  const t = {
    ...e,
    blockHash: e.blockHash ? e.blockHash : null,
    blockNumber: e.blockNumber ? BigInt(e.blockNumber) : null,
    chainId: e.chainId ? ft(e.chainId) : void 0,
    gas: e.gas ? BigInt(e.gas) : void 0,
    gasPrice: e.gasPrice ? BigInt(e.gasPrice) : void 0,
    maxFeePerBlobGas: e.maxFeePerBlobGas ? BigInt(e.maxFeePerBlobGas) : void 0,
    maxFeePerGas: e.maxFeePerGas ? BigInt(e.maxFeePerGas) : void 0,
    maxPriorityFeePerGas: e.maxPriorityFeePerGas ? BigInt(e.maxPriorityFeePerGas) : void 0,
    nonce: e.nonce ? ft(e.nonce) : void 0,
    to: e.to ? e.to : null,
    transactionIndex: e.transactionIndex ? Number(e.transactionIndex) : null,
    type: e.type ? js[e.type] : void 0,
    typeHex: e.type ? e.type : void 0,
    value: e.value ? BigInt(e.value) : void 0,
    v: e.v ? BigInt(e.v) : void 0
  };
  return e.authorizationList && (t.authorizationList = cd(e.authorizationList)), t.yParity = (() => {
    if (e.yParity)
      return Number(e.yParity);
    if (typeof t.v == "bigint") {
      if (t.v === 0n || t.v === 27n)
        return 0;
      if (t.v === 1n || t.v === 28n)
        return 1;
      if (t.v >= 35n)
        return t.v % 2n === 0n ? 1 : 0;
    }
  })(), t.type === "legacy" && (delete t.accessList, delete t.maxFeePerBlobGas, delete t.maxFeePerGas, delete t.maxPriorityFeePerGas, delete t.yParity), t.type === "eip2930" && (delete t.maxFeePerBlobGas, delete t.maxFeePerGas, delete t.maxPriorityFeePerGas), t.type === "eip1559" && delete t.maxFeePerBlobGas, t;
}
function cd(e) {
  return e.map((t) => ({
    contractAddress: t.address,
    chainId: Number(t.chainId),
    nonce: Number(t.nonce),
    r: t.r,
    s: t.s,
    yParity: Number(t.yParity)
  }));
}
function ud(e) {
  const t = (e.transactions ?? []).map((n) => typeof n == "string" ? n : Ys(n));
  return {
    ...e,
    baseFeePerGas: e.baseFeePerGas ? BigInt(e.baseFeePerGas) : null,
    blobGasUsed: e.blobGasUsed ? BigInt(e.blobGasUsed) : void 0,
    difficulty: e.difficulty ? BigInt(e.difficulty) : void 0,
    excessBlobGas: e.excessBlobGas ? BigInt(e.excessBlobGas) : void 0,
    gasLimit: e.gasLimit ? BigInt(e.gasLimit) : void 0,
    gasUsed: e.gasUsed ? BigInt(e.gasUsed) : void 0,
    hash: e.hash ? e.hash : null,
    logsBloom: e.logsBloom ? e.logsBloom : null,
    nonce: e.nonce ? e.nonce : null,
    number: e.number ? BigInt(e.number) : null,
    size: e.size ? BigInt(e.size) : void 0,
    timestamp: e.timestamp ? BigInt(e.timestamp) : void 0,
    transactions: t,
    totalDifficulty: e.totalDifficulty ? BigInt(e.totalDifficulty) : null
  };
}
async function Wt(e, { blockHash: t, blockNumber: n, blockTag: r, includeTransactions: o } = {}) {
  const s = r ?? "latest", i = o ?? !1, u = n !== void 0 ? J(n) : void 0;
  let d = null;
  if (t ? d = await e.request({
    method: "eth_getBlockByHash",
    params: [t, i]
  }, { dedupe: !0 }) : d = await e.request({
    method: "eth_getBlockByNumber",
    params: [u || s, i]
  }, { dedupe: !!u }), !d)
    throw new qs({ blockHash: t, blockNumber: n });
  return (e.chain?.formatters?.block?.format || ud)(d);
}
async function Ks(e) {
  const t = await e.request({
    method: "eth_gasPrice"
  });
  return BigInt(t);
}
async function ld(e, t) {
  const { block: n, chain: r = e.chain, request: o } = t || {};
  try {
    const s = r?.fees?.maxPriorityFeePerGas ?? r?.fees?.defaultPriorityFee;
    if (typeof s == "function") {
      const u = n || await ue(e, Wt, "getBlock")({}), d = await s({
        block: u,
        client: e,
        request: o
      });
      if (d === null)
        throw new Error();
      return d;
    }
    if (typeof s < "u")
      return s;
    const i = await e.request({
      method: "eth_maxPriorityFeePerGas"
    });
    return kt(i);
  } catch {
    const [s, i] = await Promise.all([
      n ? Promise.resolve(n) : ue(e, Wt, "getBlock")({}),
      ue(e, Ks, "getGasPrice")({})
    ]);
    if (typeof s.baseFeePerGas != "bigint")
      throw new Zr();
    const u = i - s.baseFeePerGas;
    return u < 0n ? 0n : u;
  }
}
async function Bo(e, t) {
  const { block: n, chain: r = e.chain, request: o, type: s = "eip1559" } = t || {}, i = await (async () => typeof r?.fees?.baseFeeMultiplier == "function" ? r.fees.baseFeeMultiplier({
    block: n,
    client: e,
    request: o
  }) : r?.fees?.baseFeeMultiplier ?? 1.2)();
  if (i < 1)
    throw new id();
  const d = 10 ** (i.toString().split(".")[1]?.length ?? 0), h = (g) => g * BigInt(Math.ceil(i * d)) / BigInt(d), l = n || await ue(e, Wt, "getBlock")({});
  if (typeof r?.fees?.estimateFeesPerGas == "function") {
    const g = await r.fees.estimateFeesPerGas({
      block: n,
      client: e,
      multiply: h,
      request: o,
      type: s
    });
    if (g !== null)
      return g;
  }
  if (s === "eip1559") {
    if (typeof l.baseFeePerGas != "bigint")
      throw new Zr();
    const g = typeof o?.maxPriorityFeePerGas == "bigint" ? o.maxPriorityFeePerGas : await ld(e, {
      block: l,
      chain: r,
      request: o
    }), b = h(l.baseFeePerGas);
    return {
      maxFeePerGas: o?.maxFeePerGas ?? b + g,
      maxPriorityFeePerGas: g
    };
  }
  return {
    gasPrice: o?.gasPrice ?? h(await ue(e, Ks, "getGasPrice")({}))
  };
}
class dd extends N {
  constructor(t, { account: n, docsPath: r, chain: o, data: s, gas: i, gasPrice: u, maxFeePerGas: d, maxPriorityFeePerGas: h, nonce: l, to: y, value: g }) {
    const b = An({
      from: n?.address,
      to: y,
      value: typeof g < "u" && `${Or(g)} ${o?.nativeCurrency?.symbol || "ETH"}`,
      data: s,
      gas: i,
      gasPrice: typeof u < "u" && `${ge(u)} gwei`,
      maxFeePerGas: typeof d < "u" && `${ge(d)} gwei`,
      maxPriorityFeePerGas: typeof h < "u" && `${ge(h)} gwei`,
      nonce: l
    });
    super(t.shortMessage, {
      cause: t,
      docsPath: r,
      metaMessages: [
        ...t.metaMessages ? [...t.metaMessages, " "] : [],
        "Estimate Gas Arguments:",
        b
      ].filter(Boolean),
      name: "EstimateGasExecutionError"
    }), Object.defineProperty(this, "cause", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.cause = t;
  }
}
function fd(e, { docsPath: t, ...n }) {
  const r = (() => {
    const o = Gr(e, n);
    return o instanceof xn ? e : o;
  })();
  return new dd(r, {
    docsPath: t,
    ...n
  });
}
class hd extends N {
  constructor({ address: t }) {
    super(`State for account "${t}" is set multiple times.`, {
      name: "AccountStateConflictError"
    });
  }
}
class md extends N {
  constructor() {
    super("state and stateDiff are set on the same account.", {
      name: "StateAssignmentConflictError"
    });
  }
}
function No(e) {
  return e.reduce((t, { slot: n, value: r }) => `${t}        ${n}: ${r}
`, "");
}
function pd(e) {
  return e.reduce((t, { address: n, ...r }) => {
    let o = `${t}    ${n}:
`;
    return r.nonce && (o += `      nonce: ${r.nonce}
`), r.balance && (o += `      balance: ${r.balance}
`), r.code && (o += `      code: ${r.code}
`), r.state && (o += `      state:
`, o += No(r.state)), r.stateDiff && (o += `      stateDiff:
`, o += No(r.stateDiff)), o;
  }, `  State Override:
`).slice(0, -1);
}
function Fo(e) {
  if (!(!e || e.length === 0))
    return e.reduce((t, { slot: n, value: r }) => {
      if (n.length !== 66)
        throw new wo({
          size: n.length,
          targetSize: 66,
          type: "hex"
        });
      if (r.length !== 66)
        throw new wo({
          size: r.length,
          targetSize: 66,
          type: "hex"
        });
      return t[n] = r, t;
    }, {});
}
function gd(e) {
  const { balance: t, nonce: n, state: r, stateDiff: o, code: s } = e, i = {};
  if (s !== void 0 && (i.code = s), t !== void 0 && (i.balance = J(t)), n !== void 0 && (i.nonce = J(n)), r !== void 0 && (i.state = Fo(r)), o !== void 0) {
    if (i.state)
      throw new md();
    i.stateDiff = Fo(o);
  }
  return i;
}
function Qs(e) {
  if (!e)
    return;
  const t = {};
  for (const { address: n, ...r } of e) {
    if (!rt(n, { strict: !1 }))
      throw new Vt({ address: n });
    if (t[n])
      throw new hd({ address: n });
    t[n] = gd(r);
  }
  return t;
}
async function yd(e, { address: t, blockNumber: n, blockTag: r = "latest" }) {
  const o = n ? J(n) : void 0, s = await e.request({
    method: "eth_getBalance",
    params: [t, o || r]
  });
  return BigInt(s);
}
async function Hs(e, t) {
  const { account: n = e.account } = t, r = n ? mt(n) : void 0;
  try {
    let j = function(_) {
      const { block: O, request: le, rpcStateOverride: ae } = _;
      return e.request({
        method: "eth_estimateGas",
        params: ae ? [le, O ?? "latest", ae] : O ? [le, O] : [le]
      });
    };
    const { accessList: o, authorizationList: s, blobs: i, blobVersionedHashes: u, blockNumber: d, blockTag: h, data: l, gas: y, gasPrice: g, maxFeePerBlobGas: b, maxFeePerGas: x, maxPriorityFeePerGas: v, nonce: k, value: A, stateOverride: I, ...F } = await ni(e, {
      ...t,
      parameters: (
        // Some RPC Providers do not compute versioned hashes from blobs. We will need
        // to compute them.
        r?.type === "local" ? void 0 : ["blobVersionedHashes"]
      )
    }), M = (d ? J(d) : void 0) || h, T = Qs(I), U = await (async () => {
      if (F.to)
        return F.to;
      if (s && s.length > 0)
        return await Os({
          authorization: s[0]
        }).catch(() => {
          throw new N("`to` is required. Could not infer from `authorizationList`");
        });
    })();
    Cn(t);
    const z = e.chain?.formatters?.transactionRequest?.format, L = (z || Wr)({
      // Pick out extra data that might exist on the chain's transaction request type.
      ...Vr(F, { format: z }),
      from: r?.address,
      accessList: o,
      authorizationList: s,
      blobs: i,
      blobVersionedHashes: u,
      data: l,
      gas: y,
      gasPrice: g,
      maxFeePerBlobGas: b,
      maxFeePerGas: x,
      maxPriorityFeePerGas: v,
      nonce: k,
      to: U,
      value: A
    });
    let Y = BigInt(await j({ block: M, request: L, rpcStateOverride: T }));
    if (s) {
      const _ = await yd(e, { address: L.from }), O = await Promise.all(s.map(async (le) => {
        const { contractAddress: ae } = le, Oe = await j({
          block: M,
          request: {
            authorizationList: void 0,
            data: l,
            from: r?.address,
            to: ae,
            value: J(_)
          },
          rpcStateOverride: T
        }).catch(() => 100000n);
        return 2n * BigInt(Oe);
      }));
      Y += O.reduce((le, ae) => le + ae, 0n);
    }
    return Y;
  } catch (o) {
    throw fd(o, {
      ...t,
      account: r,
      chain: e.chain
    });
  }
}
async function bd(e, { address: t, blockTag: n = "latest", blockNumber: r }) {
  const o = await e.request({
    method: "eth_getTransactionCount",
    params: [t, r ? J(r) : n]
  }, { dedupe: !!r });
  return ft(o);
}
function Xs(e) {
  const { kzg: t } = e, n = e.to ?? (typeof e.blobs[0] == "string" ? "hex" : "bytes"), r = typeof e.blobs[0] == "string" ? e.blobs.map((s) => je(s)) : e.blobs, o = [];
  for (const s of r)
    o.push(Uint8Array.from(t.blobToKzgCommitment(s)));
  return n === "bytes" ? o : o.map((s) => be(s));
}
function $s(e) {
  const { kzg: t } = e, n = e.to ?? (typeof e.blobs[0] == "string" ? "hex" : "bytes"), r = typeof e.blobs[0] == "string" ? e.blobs.map((i) => je(i)) : e.blobs, o = typeof e.commitments[0] == "string" ? e.commitments.map((i) => je(i)) : e.commitments, s = [];
  for (let i = 0; i < r.length; i++) {
    const u = r[i], d = o[i];
    s.push(Uint8Array.from(t.computeBlobKzgProof(u, d)));
  }
  return n === "bytes" ? s : s.map((i) => be(i));
}
function wd(e, t, n, r) {
  if (typeof e.setBigUint64 == "function")
    return e.setBigUint64(t, n, r);
  const o = BigInt(32), s = BigInt(4294967295), i = Number(n >> o & s), u = Number(n & s), d = r ? 4 : 0, h = r ? 0 : 4;
  e.setUint32(t + d, i, r), e.setUint32(t + h, u, r);
}
function xd(e, t, n) {
  return e & t ^ ~e & n;
}
function Ad(e, t, n) {
  return e & t ^ e & n ^ t & n;
}
class Cd extends ks {
  constructor(t, n, r, o) {
    super(), this.blockLen = t, this.outputLen = n, this.padOffset = r, this.isLE = o, this.finished = !1, this.length = 0, this.pos = 0, this.destroyed = !1, this.buffer = new Uint8Array(t), this.view = Nn(this.buffer);
  }
  update(t) {
    nn(this);
    const { view: n, buffer: r, blockLen: o } = this;
    t = Rr(t);
    const s = t.length;
    for (let i = 0; i < s; ) {
      const u = Math.min(o - this.pos, s - i);
      if (u === o) {
        const d = Nn(t);
        for (; o <= s - i; i += o)
          this.process(d, i);
        continue;
      }
      r.set(t.subarray(i, i + u), this.pos), this.pos += u, i += u, this.pos === o && (this.process(n, 0), this.pos = 0);
    }
    return this.length += t.length, this.roundClean(), this;
  }
  digestInto(t) {
    nn(this), Es(t, this), this.finished = !0;
    const { buffer: n, view: r, blockLen: o, isLE: s } = this;
    let { pos: i } = this;
    n[i++] = 128, this.buffer.subarray(i).fill(0), this.padOffset > o - i && (this.process(r, 0), i = 0);
    for (let y = i; y < o; y++)
      n[y] = 0;
    wd(r, o - 8, BigInt(this.length * 8), s), this.process(r, 0);
    const u = Nn(t), d = this.outputLen;
    if (d % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const h = d / 4, l = this.get();
    if (h > l.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let y = 0; y < h; y++)
      u.setUint32(4 * y, l[y], s);
  }
  digest() {
    const { buffer: t, outputLen: n } = this;
    this.digestInto(t);
    const r = t.slice(0, n);
    return this.destroy(), r;
  }
  _cloneInto(t) {
    t || (t = new this.constructor()), t.set(...this.get());
    const { blockLen: n, buffer: r, length: o, finished: s, destroyed: i, pos: u } = this;
    return t.length = o, t.pos = u, t.finished = s, t.destroyed = i, o % n && t.buffer.set(r), t;
  }
}
const vd = /* @__PURE__ */ new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]), Xe = /* @__PURE__ */ new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]), $e = /* @__PURE__ */ new Uint32Array(64);
class Id extends Cd {
  constructor() {
    super(64, 32, 8, !1), this.A = Xe[0] | 0, this.B = Xe[1] | 0, this.C = Xe[2] | 0, this.D = Xe[3] | 0, this.E = Xe[4] | 0, this.F = Xe[5] | 0, this.G = Xe[6] | 0, this.H = Xe[7] | 0;
  }
  get() {
    const { A: t, B: n, C: r, D: o, E: s, F: i, G: u, H: d } = this;
    return [t, n, r, o, s, i, u, d];
  }
  // prettier-ignore
  set(t, n, r, o, s, i, u, d) {
    this.A = t | 0, this.B = n | 0, this.C = r | 0, this.D = o | 0, this.E = s | 0, this.F = i | 0, this.G = u | 0, this.H = d | 0;
  }
  process(t, n) {
    for (let y = 0; y < 16; y++, n += 4)
      $e[y] = t.getUint32(n, !1);
    for (let y = 16; y < 64; y++) {
      const g = $e[y - 15], b = $e[y - 2], x = Fe(g, 7) ^ Fe(g, 18) ^ g >>> 3, v = Fe(b, 17) ^ Fe(b, 19) ^ b >>> 10;
      $e[y] = v + $e[y - 7] + x + $e[y - 16] | 0;
    }
    let { A: r, B: o, C: s, D: i, E: u, F: d, G: h, H: l } = this;
    for (let y = 0; y < 64; y++) {
      const g = Fe(u, 6) ^ Fe(u, 11) ^ Fe(u, 25), b = l + g + xd(u, d, h) + vd[y] + $e[y] | 0, v = (Fe(r, 2) ^ Fe(r, 13) ^ Fe(r, 22)) + Ad(r, o, s) | 0;
      l = h, h = d, d = u, u = i + b | 0, i = s, s = o, o = r, r = b + v | 0;
    }
    r = r + this.A | 0, o = o + this.B | 0, s = s + this.C | 0, i = i + this.D | 0, u = u + this.E | 0, d = d + this.F | 0, h = h + this.G | 0, l = l + this.H | 0, this.set(r, o, s, i, u, d, h, l);
  }
  roundClean() {
    $e.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0), this.buffer.fill(0);
  }
}
const Ed = /* @__PURE__ */ Ss(() => new Id());
function kd(e, t) {
  return Ed(nt(e, { strict: !1 }) ? Nr(e) : e);
}
function Sd(e) {
  const { commitment: t, version: n = 1 } = e, r = e.to ?? (typeof t == "string" ? "hex" : "bytes"), o = kd(t);
  return o.set([n], 0), r === "bytes" ? o : be(o);
}
function Td(e) {
  const { commitments: t, version: n } = e, r = e.to, o = [];
  for (const s of t)
    o.push(Sd({
      commitment: s,
      to: r,
      version: n
    }));
  return o;
}
const Mo = 6, _s = 32, Jr = 4096, ei = _s * Jr, Ro = ei * Mo - // terminator byte (0x80).
1 - // zero byte (0x00) appended to each field element.
1 * Jr * Mo;
class Bd extends N {
  constructor({ maxSize: t, size: n }) {
    super("Blob size is too large.", {
      metaMessages: [`Max: ${t} bytes`, `Given: ${n} bytes`],
      name: "BlobSizeTooLargeError"
    });
  }
}
class Nd extends N {
  constructor() {
    super("Blob data must not be empty.", { name: "EmptyBlobError" });
  }
}
function Fd(e) {
  const t = typeof e.data == "string" ? je(e.data) : e.data, n = fe(t);
  if (!n)
    throw new Nd();
  if (n > Ro)
    throw new Bd({
      maxSize: Ro,
      size: n
    });
  const r = [];
  let o = !0, s = 0;
  for (; o; ) {
    const i = Lr(new Uint8Array(ei));
    let u = 0;
    for (; u < Jr; ) {
      const d = t.slice(s, s + (_s - 1));
      if (i.pushByte(0), i.pushBytes(d), d.length < 31) {
        i.pushByte(128), o = !1;
        break;
      }
      u++, s += 31;
    }
    r.push(i);
  }
  return r.map((i) => be(i.bytes));
}
function Md(e) {
  const { data: t, kzg: n, to: r } = e, o = e.blobs ?? Fd({ data: t }), s = e.commitments ?? Xs({ blobs: o, kzg: n, to: r }), i = e.proofs ?? $s({ blobs: o, commitments: s, kzg: n, to: r }), u = [];
  for (let d = 0; d < o.length; d++)
    u.push({
      blob: o[d],
      commitment: s[d],
      proof: i[d]
    });
  return u;
}
function Rd(e) {
  if (e.type)
    return e.type;
  if (typeof e.authorizationList < "u")
    return "eip7702";
  if (typeof e.blobs < "u" || typeof e.blobVersionedHashes < "u" || typeof e.maxFeePerBlobGas < "u" || typeof e.sidecars < "u")
    return "eip4844";
  if (typeof e.maxFeePerGas < "u" || typeof e.maxPriorityFeePerGas < "u")
    return "eip1559";
  if (typeof e.gasPrice < "u")
    return typeof e.accessList < "u" ? "eip2930" : "legacy";
  throw new _l({ transaction: e });
}
const ti = [
  "blobVersionedHashes",
  "chainId",
  "fees",
  "gas",
  "nonce",
  "type"
], zo = /* @__PURE__ */ new Map();
async function ni(e, t) {
  const { account: n = e.account, blobs: r, chain: o, gas: s, kzg: i, nonce: u, nonceManager: d, parameters: h = ti, type: l } = t, y = n && mt(n), g = { ...t, ...y ? { from: y?.address } : {} };
  let b;
  async function x() {
    return b || (b = await ue(e, Wt, "getBlock")({ blockTag: "latest" }), b);
  }
  let v;
  async function k() {
    return v || (o ? o.id : typeof t.chainId < "u" ? t.chainId : (v = await ue(e, Js, "getChainId")({}), v));
  }
  if ((h.includes("blobVersionedHashes") || h.includes("sidecars")) && r && i) {
    const A = Xs({ blobs: r, kzg: i });
    if (h.includes("blobVersionedHashes")) {
      const I = Td({
        commitments: A,
        to: "hex"
      });
      g.blobVersionedHashes = I;
    }
    if (h.includes("sidecars")) {
      const I = $s({ blobs: r, commitments: A, kzg: i }), F = Md({
        blobs: r,
        commitments: A,
        proofs: I,
        to: "hex"
      });
      g.sidecars = F;
    }
  }
  if (h.includes("chainId") && (g.chainId = await k()), (h.includes("fees") || h.includes("type")) && typeof l > "u")
    try {
      g.type = Rd(g);
    } catch {
      let A = zo.get(e.uid);
      typeof A > "u" && (A = typeof (await x())?.baseFeePerGas == "bigint", zo.set(e.uid, A)), g.type = A ? "eip1559" : "legacy";
    }
  if (h.includes("fees"))
    if (g.type !== "legacy" && g.type !== "eip2930") {
      if (typeof g.maxFeePerGas > "u" || typeof g.maxPriorityFeePerGas > "u") {
        const A = await x(), { maxFeePerGas: I, maxPriorityFeePerGas: F } = await Bo(e, {
          block: A,
          chain: o,
          request: g
        });
        if (typeof t.maxPriorityFeePerGas > "u" && t.maxFeePerGas && t.maxFeePerGas < F)
          throw new ad({
            maxPriorityFeePerGas: F
          });
        g.maxPriorityFeePerGas = F, g.maxFeePerGas = I;
      }
    } else {
      if (typeof t.maxFeePerGas < "u" || typeof t.maxPriorityFeePerGas < "u")
        throw new Zr();
      if (typeof t.gasPrice > "u") {
        const A = await x(), { gasPrice: I } = await Bo(e, {
          block: A,
          chain: o,
          request: g,
          type: "legacy"
        });
        g.gasPrice = I;
      }
    }
  if (h.includes("gas") && typeof s > "u" && (g.gas = await ue(e, Hs, "estimateGas")({
    ...g,
    account: y && { address: y.address, type: "json-rpc" }
  })), h.includes("nonce") && typeof u > "u" && y)
    if (d) {
      const A = await k();
      g.nonce = await d.consume({
        address: y.address,
        chainId: A,
        client: e
      });
    } else
      g.nonce = await ue(e, bd, "getTransactionCount")({
        address: y.address,
        blockTag: "pending"
      });
  return Cn(g), delete g.parameters, g;
}
async function zd(e, { serializedTransaction: t }) {
  return e.request({
    method: "eth_sendRawTransaction",
    params: [t]
  }, { retryCount: 0 });
}
const Un = new Mr(128);
async function Ud(e, t) {
  const { account: n = e.account, chain: r = e.chain, accessList: o, authorizationList: s, blobs: i, data: u, gas: d, gasPrice: h, maxFeePerBlobGas: l, maxFeePerGas: y, maxPriorityFeePerGas: g, nonce: b, value: x, ...v } = t;
  if (typeof n > "u")
    throw new Dl({
      docsPath: "/docs/actions/wallet/sendTransaction"
    });
  const k = n ? mt(n) : null;
  try {
    Cn(t);
    const A = await (async () => {
      if (t.to)
        return t.to;
      if (s && s.length > 0)
        return await Os({
          authorization: s[0]
        }).catch(() => {
          throw new N("`to` is required. Could not infer from `authorizationList`.");
        });
    })();
    if (k?.type === "json-rpc" || k === null) {
      let I;
      r !== null && (I = await ue(e, Js, "getChainId")({}), Ql({
        currentChainId: I,
        chain: r
      }));
      const F = e.chain?.formatters?.transactionRequest?.format, M = (F || Wr)({
        // Pick out extra data that might exist on the chain's transaction request type.
        ...Vr(v, { format: F }),
        accessList: o,
        authorizationList: s,
        blobs: i,
        chainId: I,
        data: u,
        from: k?.address,
        gas: d,
        gasPrice: h,
        maxFeePerBlobGas: l,
        maxFeePerGas: y,
        maxPriorityFeePerGas: g,
        nonce: b,
        to: A,
        value: x
      }), T = Un.get(e.uid), U = T ? "wallet_sendTransaction" : "eth_sendTransaction";
      try {
        return await e.request({
          method: U,
          params: [M]
        }, { retryCount: 0 });
      } catch (z) {
        if (T === !1)
          throw z;
        const P = z;
        if (P.name === "InvalidInputRpcError" || P.name === "InvalidParamsRpcError" || P.name === "MethodNotFoundRpcError" || P.name === "MethodNotSupportedRpcError")
          return await e.request({
            method: "wallet_sendTransaction",
            params: [M]
          }, { retryCount: 0 }).then((L) => (Un.set(e.uid, !0), L)).catch((L) => {
            const j = L;
            throw j.name === "MethodNotFoundRpcError" || j.name === "MethodNotSupportedRpcError" ? (Un.set(e.uid, !1), P) : j;
          });
        throw P;
      }
    }
    if (k?.type === "local") {
      const I = await ue(e, ni, "prepareTransactionRequest")({
        account: k,
        accessList: o,
        authorizationList: s,
        blobs: i,
        chain: r,
        data: u,
        gas: d,
        gasPrice: h,
        maxFeePerBlobGas: l,
        maxFeePerGas: y,
        maxPriorityFeePerGas: g,
        nonce: b,
        nonceManager: k.nonceManager,
        parameters: [...ti, "sidecars"],
        value: x,
        ...v,
        to: A
      }), F = r?.serializers?.transaction, B = await k.signTransaction(I, {
        serializer: F
      });
      return await ue(e, zd, "sendRawTransaction")({
        serializedTransaction: B
      });
    }
    throw k?.type === "smart" ? new zn({
      metaMessages: [
        "Consider using the `sendUserOperation` Action instead."
      ],
      docsPath: "/docs/actions/bundler/sendUserOperation",
      type: "smart"
    }) : new zn({
      docsPath: "/docs/actions/wallet/sendTransaction",
      type: k?.type
    });
  } catch (A) {
    throw A instanceof zn ? A : nd(A, {
      ...t,
      account: k,
      chain: t.chain || void 0
    });
  }
}
const Uo = [
  {
    inputs: [
      {
        components: [
          {
            name: "target",
            type: "address"
          },
          {
            name: "allowFailure",
            type: "bool"
          },
          {
            name: "callData",
            type: "bytes"
          }
        ],
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          {
            name: "success",
            type: "bool"
          },
          {
            name: "returnData",
            type: "bytes"
          }
        ],
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];
function Dd(e, t = {}) {
  typeof t.size < "u" && Le(e, { size: t.size });
  const n = be(e, t);
  return kt(n, t);
}
function Pd(e, t = {}) {
  let n = e;
  if (typeof t.size < "u" && (Le(n, { size: t.size }), n = Br(n)), n.length > 1 || n[0] > 1)
    throw new Du(n);
  return !!n[0];
}
function qe(e, t = {}) {
  typeof t.size < "u" && Le(e, { size: t.size });
  const n = be(e, t);
  return ft(n, t);
}
function Ld(e, t = {}) {
  let n = e;
  return typeof t.size < "u" && (Le(n, { size: t.size }), n = Br(n, { dir: "right" })), new TextDecoder().decode(n);
}
function Od(e, t) {
  const n = typeof t == "string" ? je(t) : t, r = Lr(n);
  if (fe(n) === 0 && e.length > 0)
    throw new Yu();
  if (fe(t) && fe(t) < 32)
    throw new ju({
      data: typeof t == "string" ? t : be(t),
      params: e,
      size: fe(t)
    });
  let o = 0;
  const s = [];
  for (let i = 0; i < e.length; ++i) {
    const u = e[i];
    r.setPosition(o);
    const [d, h] = Ct(r, u, {
      staticPosition: 0
    });
    o += h, s.push(d);
  }
  return s;
}
function Ct(e, t, { staticPosition: n }) {
  const r = Pr(t.type);
  if (r) {
    const [o, s] = r;
    return Vd(e, { ...t, type: s }, { length: o, staticPosition: n });
  }
  if (t.type === "tuple")
    return qd(e, t, { staticPosition: n });
  if (t.type === "address")
    return Gd(e);
  if (t.type === "bool")
    return Wd(e);
  if (t.type.startsWith("bytes"))
    return Zd(e, t, { staticPosition: n });
  if (t.type.startsWith("uint") || t.type.startsWith("int"))
    return Jd(e, t);
  if (t.type === "string")
    return jd(e, { staticPosition: n });
  throw new el(t.type, {
    docsPath: "/docs/contract/decodeAbiParameters"
  });
}
const Do = 32, cr = 32;
function Gd(e) {
  const t = e.readBytes(32);
  return [wn(be(zs(t, -20))), 32];
}
function Vd(e, t, { length: n, staticPosition: r }) {
  if (!n) {
    const i = qe(e.readBytes(cr)), u = r + i, d = u + Do;
    e.setPosition(u);
    const h = qe(e.readBytes(Do)), l = Zt(t);
    let y = 0;
    const g = [];
    for (let b = 0; b < h; ++b) {
      e.setPosition(d + (l ? b * 32 : y));
      const [x, v] = Ct(e, t, {
        staticPosition: d
      });
      y += v, g.push(x);
    }
    return e.setPosition(r + 32), [g, 32];
  }
  if (Zt(t)) {
    const i = qe(e.readBytes(cr)), u = r + i, d = [];
    for (let h = 0; h < n; ++h) {
      e.setPosition(u + h * 32);
      const [l] = Ct(e, t, {
        staticPosition: u
      });
      d.push(l);
    }
    return e.setPosition(r + 32), [d, 32];
  }
  let o = 0;
  const s = [];
  for (let i = 0; i < n; ++i) {
    const [u, d] = Ct(e, t, {
      staticPosition: r + o
    });
    o += d, s.push(u);
  }
  return [s, o];
}
function Wd(e) {
  return [Pd(e.readBytes(32), { size: 32 }), 32];
}
function Zd(e, t, { staticPosition: n }) {
  const [r, o] = t.type.split("bytes");
  if (!o) {
    const i = qe(e.readBytes(32));
    e.setPosition(n + i);
    const u = qe(e.readBytes(32));
    if (u === 0)
      return e.setPosition(n + 32), ["0x", 32];
    const d = e.readBytes(u);
    return e.setPosition(n + 32), [be(d), 32];
  }
  return [be(e.readBytes(Number.parseInt(o), 32)), 32];
}
function Jd(e, t) {
  const n = t.type.startsWith("int"), r = Number.parseInt(t.type.split("int")[1] || "256"), o = e.readBytes(32);
  return [
    r > 48 ? Dd(o, { signed: n }) : qe(o, { signed: n }),
    32
  ];
}
function qd(e, t, { staticPosition: n }) {
  const r = t.components.length === 0 || t.components.some(({ name: i }) => !i), o = r ? [] : {};
  let s = 0;
  if (Zt(t)) {
    const i = qe(e.readBytes(cr)), u = n + i;
    for (let d = 0; d < t.components.length; ++d) {
      const h = t.components[d];
      e.setPosition(u + s);
      const [l, y] = Ct(e, h, {
        staticPosition: u
      });
      s += y, o[r ? d : h?.name] = l;
    }
    return e.setPosition(n + 32), [o, 32];
  }
  for (let i = 0; i < t.components.length; ++i) {
    const u = t.components[i], [d, h] = Ct(e, u, {
      staticPosition: n
    });
    o[r ? i : u?.name] = d, s += h;
  }
  return [o, s];
}
function jd(e, { staticPosition: t }) {
  const n = qe(e.readBytes(32)), r = t + n;
  e.setPosition(r);
  const o = qe(e.readBytes(32));
  if (o === 0)
    return e.setPosition(t + 32), ["", 32];
  const s = e.readBytes(o, 32), i = Ld(Br(s));
  return e.setPosition(t + 32), [i, 32];
}
function Zt(e) {
  const { type: t } = e;
  if (t === "string" || t === "bytes" || t.endsWith("[]"))
    return !0;
  if (t === "tuple")
    return e.components?.some(Zt);
  const n = Pr(e.type);
  return !!(n && Zt({ ...e, type: n[1] }));
}
const Yd = (e) => bn(Nr(e));
function Kd(e) {
  return Yd(e);
}
const Qd = "1.0.8";
let ve = class ur extends Error {
  constructor(t, n = {}) {
    const r = n.cause instanceof ur ? n.cause.details : n.cause?.message ? n.cause.message : n.details, o = n.cause instanceof ur && n.cause.docsPath || n.docsPath, s = [
      t || "An error occurred.",
      "",
      ...n.metaMessages ? [...n.metaMessages, ""] : [],
      ...o ? [`Docs: https://abitype.dev${o}`] : [],
      ...r ? [`Details: ${r}`] : [],
      `Version: abitype@${Qd}`
    ].join(`
`);
    super(s), Object.defineProperty(this, "details", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "docsPath", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "metaMessages", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "shortMessage", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "AbiTypeError"
    }), n.cause && (this.cause = n.cause), this.details = r, this.docsPath = o, this.metaMessages = n.metaMessages, this.shortMessage = t;
  }
};
function Ke(e, t) {
  return e.exec(t)?.groups;
}
const ri = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/, oi = /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/, si = /^\(.+?\).*?$/, Po = /^tuple(?<array>(\[(\d*)\])*)$/;
function lr(e) {
  let t = e.type;
  if (Po.test(e.type) && "components" in e) {
    t = "(";
    const n = e.components.length;
    for (let o = 0; o < n; o++) {
      const s = e.components[o];
      t += lr(s), o < n - 1 && (t += ", ");
    }
    const r = Ke(Po, e.type);
    return t += `)${r?.array ?? ""}`, lr({
      ...e,
      type: t
    });
  }
  return "indexed" in e && e.indexed && (t = `${t} indexed`), e.name ? `${t} ${e.name}` : t;
}
function Dt(e) {
  let t = "";
  const n = e.length;
  for (let r = 0; r < n; r++) {
    const o = e[r];
    t += lr(o), r !== n - 1 && (t += ", ");
  }
  return t;
}
function Hd(e) {
  return e.type === "function" ? `function ${e.name}(${Dt(e.inputs)})${e.stateMutability && e.stateMutability !== "nonpayable" ? ` ${e.stateMutability}` : ""}${e.outputs?.length ? ` returns (${Dt(e.outputs)})` : ""}` : e.type === "event" ? `event ${e.name}(${Dt(e.inputs)})` : e.type === "error" ? `error ${e.name}(${Dt(e.inputs)})` : e.type === "constructor" ? `constructor(${Dt(e.inputs)})${e.stateMutability === "payable" ? " payable" : ""}` : e.type === "fallback" ? `fallback() external${e.stateMutability === "payable" ? " payable" : ""}` : "receive() external payable";
}
const ii = /^error (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function Xd(e) {
  return ii.test(e);
}
function $d(e) {
  return Ke(ii, e);
}
const ai = /^event (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function _d(e) {
  return ai.test(e);
}
function ef(e) {
  return Ke(ai, e);
}
const ci = /^function (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)(?: (?<scope>external|public{1}))?(?: (?<stateMutability>pure|view|nonpayable|payable{1}))?(?: returns\s?\((?<returns>.*?)\))?$/;
function tf(e) {
  return ci.test(e);
}
function nf(e) {
  return Ke(ci, e);
}
const ui = /^struct (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*) \{(?<properties>.*?)\}$/;
function li(e) {
  return ui.test(e);
}
function rf(e) {
  return Ke(ui, e);
}
const di = /^constructor\((?<parameters>.*?)\)(?:\s(?<stateMutability>payable{1}))?$/;
function of(e) {
  return di.test(e);
}
function sf(e) {
  return Ke(di, e);
}
const fi = /^fallback\(\) external(?:\s(?<stateMutability>payable{1}))?$/;
function af(e) {
  return fi.test(e);
}
function cf(e) {
  return Ke(fi, e);
}
const uf = /^receive\(\) external payable$/;
function lf(e) {
  return uf.test(e);
}
const df = /* @__PURE__ */ new Set(["indexed"]), dr = /* @__PURE__ */ new Set([
  "calldata",
  "memory",
  "storage"
]);
class ff extends ve {
  constructor({ type: t }) {
    super("Unknown type.", {
      metaMessages: [
        `Type "${t}" is not a valid ABI type. Perhaps you forgot to include a struct signature?`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownTypeError"
    });
  }
}
class hf extends ve {
  constructor({ type: t }) {
    super("Unknown type.", {
      metaMessages: [`Type "${t}" is not a valid ABI type.`]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownSolidityTypeError"
    });
  }
}
class mf extends ve {
  constructor({ param: t }) {
    super("Invalid ABI parameter.", {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidParameterError"
    });
  }
}
class pf extends ve {
  constructor({ param: t, name: n }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `"${n}" is a protected Solidity keyword. More info: https://docs.soliditylang.org/en/latest/cheatsheet.html`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "SolidityProtectedKeywordError"
    });
  }
}
class gf extends ve {
  constructor({ param: t, type: n, modifier: r }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `Modifier "${r}" not allowed${n ? ` in "${n}" type` : ""}.`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidModifierError"
    });
  }
}
class yf extends ve {
  constructor({ param: t, type: n, modifier: r }) {
    super("Invalid ABI parameter.", {
      details: t,
      metaMessages: [
        `Modifier "${r}" not allowed${n ? ` in "${n}" type` : ""}.`,
        `Data location can only be specified for array, struct, or mapping types, but "${r}" was given.`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidFunctionModifierError"
    });
  }
}
class bf extends ve {
  constructor({ abiParameter: t }) {
    super("Invalid ABI parameter.", {
      details: JSON.stringify(t, null, 2),
      metaMessages: ["ABI parameter type is invalid."]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidAbiTypeParameterError"
    });
  }
}
class Rt extends ve {
  constructor({ signature: t, type: n }) {
    super(`Invalid ${n} signature.`, {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidSignatureError"
    });
  }
}
class wf extends ve {
  constructor({ signature: t }) {
    super("Unknown signature.", {
      details: t
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "UnknownSignatureError"
    });
  }
}
class xf extends ve {
  constructor({ signature: t }) {
    super("Invalid struct signature.", {
      details: t,
      metaMessages: ["No properties exist."]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidStructSignatureError"
    });
  }
}
class Af extends ve {
  constructor({ type: t }) {
    super("Circular reference detected.", {
      metaMessages: [`Struct "${t}" is a circular reference.`]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "CircularReferenceError"
    });
  }
}
class Cf extends ve {
  constructor({ current: t, depth: n }) {
    super("Unbalanced parentheses.", {
      metaMessages: [
        `"${t.trim()}" has too many ${n > 0 ? "opening" : "closing"} parentheses.`
      ],
      details: `Depth "${n}"`
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "InvalidParenthesisError"
    });
  }
}
function vf(e, t, n) {
  let r = "";
  if (n)
    for (const o of Object.entries(n)) {
      if (!o)
        continue;
      let s = "";
      for (const i of o[1])
        s += `[${i.type}${i.name ? `:${i.name}` : ""}]`;
      r += `(${o[0]}{${s}})`;
    }
  return t ? `${t}:${e}${r}` : e;
}
const Dn = /* @__PURE__ */ new Map([
  // Unnamed
  ["address", { type: "address" }],
  ["bool", { type: "bool" }],
  ["bytes", { type: "bytes" }],
  ["bytes32", { type: "bytes32" }],
  ["int", { type: "int256" }],
  ["int256", { type: "int256" }],
  ["string", { type: "string" }],
  ["uint", { type: "uint256" }],
  ["uint8", { type: "uint8" }],
  ["uint16", { type: "uint16" }],
  ["uint24", { type: "uint24" }],
  ["uint32", { type: "uint32" }],
  ["uint64", { type: "uint64" }],
  ["uint96", { type: "uint96" }],
  ["uint112", { type: "uint112" }],
  ["uint160", { type: "uint160" }],
  ["uint192", { type: "uint192" }],
  ["uint256", { type: "uint256" }],
  // Named
  ["address owner", { type: "address", name: "owner" }],
  ["address to", { type: "address", name: "to" }],
  ["bool approved", { type: "bool", name: "approved" }],
  ["bytes _data", { type: "bytes", name: "_data" }],
  ["bytes data", { type: "bytes", name: "data" }],
  ["bytes signature", { type: "bytes", name: "signature" }],
  ["bytes32 hash", { type: "bytes32", name: "hash" }],
  ["bytes32 r", { type: "bytes32", name: "r" }],
  ["bytes32 root", { type: "bytes32", name: "root" }],
  ["bytes32 s", { type: "bytes32", name: "s" }],
  ["string name", { type: "string", name: "name" }],
  ["string symbol", { type: "string", name: "symbol" }],
  ["string tokenURI", { type: "string", name: "tokenURI" }],
  ["uint tokenId", { type: "uint256", name: "tokenId" }],
  ["uint8 v", { type: "uint8", name: "v" }],
  ["uint256 balance", { type: "uint256", name: "balance" }],
  ["uint256 tokenId", { type: "uint256", name: "tokenId" }],
  ["uint256 value", { type: "uint256", name: "value" }],
  // Indexed
  [
    "event:address indexed from",
    { type: "address", name: "from", indexed: !0 }
  ],
  ["event:address indexed to", { type: "address", name: "to", indexed: !0 }],
  [
    "event:uint indexed tokenId",
    { type: "uint256", name: "tokenId", indexed: !0 }
  ],
  [
    "event:uint256 indexed tokenId",
    { type: "uint256", name: "tokenId", indexed: !0 }
  ]
]);
function If(e, t = {}) {
  if (tf(e))
    return Ef(e, t);
  if (_d(e))
    return kf(e, t);
  if (Xd(e))
    return Sf(e, t);
  if (of(e))
    return Tf(e, t);
  if (af(e))
    return Bf(e);
  if (lf(e))
    return {
      type: "receive",
      stateMutability: "payable"
    };
  throw new wf({ signature: e });
}
function Ef(e, t = {}) {
  const n = nf(e);
  if (!n)
    throw new Rt({ signature: e, type: "function" });
  const r = Ie(n.parameters), o = [], s = r.length;
  for (let u = 0; u < s; u++)
    o.push(ht(r[u], {
      modifiers: dr,
      structs: t,
      type: "function"
    }));
  const i = [];
  if (n.returns) {
    const u = Ie(n.returns), d = u.length;
    for (let h = 0; h < d; h++)
      i.push(ht(u[h], {
        modifiers: dr,
        structs: t,
        type: "function"
      }));
  }
  return {
    name: n.name,
    type: "function",
    stateMutability: n.stateMutability ?? "nonpayable",
    inputs: o,
    outputs: i
  };
}
function kf(e, t = {}) {
  const n = ef(e);
  if (!n)
    throw new Rt({ signature: e, type: "event" });
  const r = Ie(n.parameters), o = [], s = r.length;
  for (let i = 0; i < s; i++)
    o.push(ht(r[i], {
      modifiers: df,
      structs: t,
      type: "event"
    }));
  return { name: n.name, type: "event", inputs: o };
}
function Sf(e, t = {}) {
  const n = $d(e);
  if (!n)
    throw new Rt({ signature: e, type: "error" });
  const r = Ie(n.parameters), o = [], s = r.length;
  for (let i = 0; i < s; i++)
    o.push(ht(r[i], { structs: t, type: "error" }));
  return { name: n.name, type: "error", inputs: o };
}
function Tf(e, t = {}) {
  const n = sf(e);
  if (!n)
    throw new Rt({ signature: e, type: "constructor" });
  const r = Ie(n.parameters), o = [], s = r.length;
  for (let i = 0; i < s; i++)
    o.push(ht(r[i], { structs: t, type: "constructor" }));
  return {
    type: "constructor",
    stateMutability: n.stateMutability ?? "nonpayable",
    inputs: o
  };
}
function Bf(e) {
  const t = cf(e);
  if (!t)
    throw new Rt({ signature: e, type: "fallback" });
  return {
    type: "fallback",
    stateMutability: t.stateMutability ?? "nonpayable"
  };
}
const Nf = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/, Ff = /^\((?<type>.+?)\)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/, Mf = /^u?int$/;
function ht(e, t) {
  const n = vf(e, t?.type, t?.structs);
  if (Dn.has(n))
    return Dn.get(n);
  const r = si.test(e), o = Ke(r ? Ff : Nf, e);
  if (!o)
    throw new mf({ param: e });
  if (o.name && zf(o.name))
    throw new pf({ param: e, name: o.name });
  const s = o.name ? { name: o.name } : {}, i = o.modifier === "indexed" ? { indexed: !0 } : {}, u = t?.structs ?? {};
  let d, h = {};
  if (r) {
    d = "tuple";
    const y = Ie(o.type), g = [], b = y.length;
    for (let x = 0; x < b; x++)
      g.push(ht(y[x], { structs: u }));
    h = { components: g };
  } else if (o.type in u)
    d = "tuple", h = { components: u[o.type] };
  else if (Mf.test(o.type))
    d = `${o.type}256`;
  else if (d = o.type, t?.type !== "struct" && !hi(d))
    throw new hf({ type: d });
  if (o.modifier) {
    if (!t?.modifiers?.has?.(o.modifier))
      throw new gf({
        param: e,
        type: t?.type,
        modifier: o.modifier
      });
    if (dr.has(o.modifier) && !Uf(d, !!o.array))
      throw new yf({
        param: e,
        type: t?.type,
        modifier: o.modifier
      });
  }
  const l = {
    type: `${d}${o.array ?? ""}`,
    ...s,
    ...i,
    ...h
  };
  return Dn.set(n, l), l;
}
function Ie(e, t = [], n = "", r = 0) {
  const o = e.trim().length;
  for (let s = 0; s < o; s++) {
    const i = e[s], u = e.slice(s + 1);
    switch (i) {
      case ",":
        return r === 0 ? Ie(u, [...t, n.trim()]) : Ie(u, t, `${n}${i}`, r);
      case "(":
        return Ie(u, t, `${n}${i}`, r + 1);
      case ")":
        return Ie(u, t, `${n}${i}`, r - 1);
      default:
        return Ie(u, t, `${n}${i}`, r);
    }
  }
  if (n === "")
    return t;
  if (r !== 0)
    throw new Cf({ current: n, depth: r });
  return t.push(n.trim()), t;
}
function hi(e) {
  return e === "address" || e === "bool" || e === "function" || e === "string" || ri.test(e) || oi.test(e);
}
const Rf = /^(?:after|alias|anonymous|apply|auto|byte|calldata|case|catch|constant|copyof|default|defined|error|event|external|false|final|function|immutable|implements|in|indexed|inline|internal|let|mapping|match|memory|mutable|null|of|override|partial|private|promise|public|pure|reference|relocatable|return|returns|sizeof|static|storage|struct|super|supports|switch|this|true|try|typedef|typeof|var|view|virtual)$/;
function zf(e) {
  return e === "address" || e === "bool" || e === "function" || e === "string" || e === "tuple" || ri.test(e) || oi.test(e) || Rf.test(e);
}
function Uf(e, t) {
  return t || e === "bytes" || e === "string" || e === "tuple";
}
function Df(e) {
  const t = {}, n = e.length;
  for (let i = 0; i < n; i++) {
    const u = e[i];
    if (!li(u))
      continue;
    const d = rf(u);
    if (!d)
      throw new Rt({ signature: u, type: "struct" });
    const h = d.properties.split(";"), l = [], y = h.length;
    for (let g = 0; g < y; g++) {
      const x = h[g].trim();
      if (!x)
        continue;
      const v = ht(x, {
        type: "struct"
      });
      l.push(v);
    }
    if (!l.length)
      throw new xf({ signature: u });
    t[d.name] = l;
  }
  const r = {}, o = Object.entries(t), s = o.length;
  for (let i = 0; i < s; i++) {
    const [u, d] = o[i];
    r[u] = mi(d, t);
  }
  return r;
}
const Pf = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*)(?<array>(?:\[\d*?\])+?)?$/;
function mi(e, t, n = /* @__PURE__ */ new Set()) {
  const r = [], o = e.length;
  for (let s = 0; s < o; s++) {
    const i = e[s];
    if (si.test(i.type))
      r.push(i);
    else {
      const d = Ke(Pf, i.type);
      if (!d?.type)
        throw new bf({ abiParameter: i });
      const { array: h, type: l } = d;
      if (l in t) {
        if (n.has(l))
          throw new Af({ type: l });
        r.push({
          ...i,
          type: `tuple${h ?? ""}`,
          components: mi(t[l] ?? [], t, /* @__PURE__ */ new Set([...n, l]))
        });
      } else if (hi(l))
        r.push(i);
      else
        throw new ff({ type: l });
    }
  }
  return r;
}
function pi(e) {
  const t = Df(e), n = [], r = e.length;
  for (let o = 0; o < r; o++) {
    const s = e[o];
    li(s) || n.push(If(s, t));
  }
  return n;
}
function Lf(e) {
  let t = !0, n = "", r = 0, o = "", s = !1;
  for (let i = 0; i < e.length; i++) {
    const u = e[i];
    if (["(", ")", ","].includes(u) && (t = !0), u === "(" && r++, u === ")" && r--, !!t) {
      if (r === 0) {
        if (u === " " && ["event", "function", ""].includes(o))
          o = "";
        else if (o += u, u === ")") {
          s = !0;
          break;
        }
        continue;
      }
      if (u === " ") {
        e[i - 1] !== "," && n !== "," && n !== ",(" && (n = "", t = !1);
        continue;
      }
      o += u, n += u;
    }
  }
  if (!s)
    throw new N("Unable to normalize signature.");
  return o;
}
const Of = (e) => {
  const t = typeof e == "string" ? e : Hd(e);
  return Lf(t);
};
function gi(e) {
  return Kd(Of(e));
}
const Gf = gi, yi = (e) => Fs(gi(e), 0, 4);
function bi(e) {
  const { abi: t, args: n = [], name: r } = e, o = nt(r, { strict: !1 }), s = t.filter((u) => o ? u.type === "function" ? yi(u) === r : u.type === "event" ? Gf(u) === r : !1 : "name" in u && u.name === r);
  if (s.length === 0)
    return;
  if (s.length === 1)
    return s[0];
  let i;
  for (const u of s) {
    if (!("inputs" in u))
      continue;
    if (!n || n.length === 0) {
      if (!u.inputs || u.inputs.length === 0)
        return u;
      continue;
    }
    if (!u.inputs || u.inputs.length === 0 || u.inputs.length !== n.length)
      continue;
    if (n.every((h, l) => {
      const y = "inputs" in u && u.inputs[l];
      return y ? fr(h, y) : !1;
    })) {
      if (i && "inputs" in i && i.inputs) {
        const h = wi(u.inputs, i.inputs, n);
        if (h)
          throw new $u({
            abiItem: u,
            type: h[0]
          }, {
            abiItem: i,
            type: h[1]
          });
      }
      i = u;
    }
  }
  return i || s[0];
}
function fr(e, t) {
  const n = typeof e, r = t.type;
  switch (r) {
    case "address":
      return rt(e, { strict: !1 });
    case "bool":
      return n === "boolean";
    case "function":
      return n === "string";
    case "string":
      return n === "string";
    default:
      return r === "tuple" && "components" in t ? Object.values(t.components).every((o, s) => fr(Object.values(e)[s], o)) : /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(r) ? n === "number" || n === "bigint" : /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(r) ? n === "string" || e instanceof Uint8Array : /[a-z]+[1-9]{0,3}(\[[0-9]{0,}\])+$/.test(r) ? Array.isArray(e) && e.every((o) => fr(o, {
        ...t,
        // Pop off `[]` or `[M]` from end of type
        type: r.replace(/(\[[0-9]{0,}\])$/, "")
      })) : !1;
  }
}
function wi(e, t, n) {
  for (const r in e) {
    const o = e[r], s = t[r];
    if (o.type === "tuple" && s.type === "tuple" && "components" in o && "components" in s)
      return wi(o.components, s.components, n[r]);
    const i = [o.type, s.type];
    if (i.includes("address") && i.includes("bytes20") ? !0 : i.includes("address") && i.includes("string") ? rt(n[r], { strict: !1 }) : i.includes("address") && i.includes("bytes") ? rt(n[r], { strict: !1 }) : !1)
      return i;
  }
}
const Pn = "/docs/contract/decodeFunctionResult";
function Vf(e) {
  const { abi: t, args: n, functionName: r, data: o } = e;
  let s = t[0];
  if (r) {
    const u = bi({ abi: t, args: n, name: r });
    if (!u)
      throw new en(r, { docsPath: Pn });
    s = u;
  }
  if (s.type !== "function")
    throw new en(void 0, { docsPath: Pn });
  if (!s.outputs)
    throw new Xu(s.name, { docsPath: Pn });
  const i = Od(s.outputs, o);
  if (i && i.length > 1)
    return i;
  if (i && i.length === 1)
    return i[0];
}
const Lo = "/docs/contract/encodeFunctionData";
function Wf(e) {
  const { abi: t, args: n, functionName: r } = e;
  let o = t[0];
  if (r) {
    const s = bi({
      abi: t,
      args: n,
      name: r
    });
    if (!s)
      throw new en(r, { docsPath: Lo });
    o = s;
  }
  if (o.type !== "function")
    throw new en(void 0, { docsPath: Lo });
  return {
    abi: [o],
    functionName: yi(Xn(o))
  };
}
function Zf(e) {
  const { args: t } = e, { abi: n, functionName: r } = e.abi.length === 1 && e.functionName?.startsWith("0x") ? e : Wf(e), o = n[0], s = r, i = "inputs" in o && o.inputs ? Us(o.inputs, t ?? []) : void 0;
  return gn([s, i ?? "0x"]);
}
function Jf({ blockNumber: e, chain: t, contract: n }) {
  const r = t?.contracts?.[n];
  if (!r)
    throw new $n({
      chain: t,
      contract: { name: n }
    });
  if (e && r.blockCreated && r.blockCreated > e)
    throw new $n({
      blockNumber: e,
      chain: t,
      contract: {
        name: n,
        blockCreated: r.blockCreated
      }
    });
  return r.address;
}
class qf extends N {
  constructor(t, { account: n, docsPath: r, chain: o, data: s, gas: i, gasPrice: u, maxFeePerGas: d, maxPriorityFeePerGas: h, nonce: l, to: y, value: g, stateOverride: b }) {
    const x = n ? mt(n) : void 0;
    let v = An({
      from: x?.address,
      to: y,
      value: typeof g < "u" && `${Or(g)} ${o?.nativeCurrency?.symbol || "ETH"}`,
      data: s,
      gas: i,
      gasPrice: typeof u < "u" && `${ge(u)} gwei`,
      maxFeePerGas: typeof d < "u" && `${ge(d)} gwei`,
      maxPriorityFeePerGas: typeof h < "u" && `${ge(h)} gwei`,
      nonce: l
    });
    b && (v += `
${pd(b)}`), super(t.shortMessage, {
      cause: t,
      docsPath: r,
      metaMessages: [
        ...t.metaMessages ? [...t.metaMessages, " "] : [],
        "Raw Call Arguments:",
        v
      ].filter(Boolean),
      name: "CallExecutionError"
    }), Object.defineProperty(this, "cause", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.cause = t;
  }
}
class jf extends N {
  constructor({ factory: t }) {
    super(`Deployment for counterfactual contract call failed${t ? ` for factory "${t}".` : ""}`, {
      metaMessages: [
        "Please ensure:",
        "- The `factory` is a valid contract deployment factory (ie. Create2 Factory, ERC-4337 Factory, etc).",
        "- The `factoryData` is a valid encoded function call for contract deployment function on the factory."
      ],
      name: "CounterfactualDeploymentFailedError"
    });
  }
}
class Yf extends N {
  constructor({ data: t, message: n }) {
    super(n || "", { name: "RawContractError" }), Object.defineProperty(this, "code", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: 3
    }), Object.defineProperty(this, "data", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), this.data = t;
  }
}
const Kf = "0x82ad56cb", Qf = "0x608060405234801561001057600080fd5b5060405161018e38038061018e83398101604081905261002f91610124565b6000808351602085016000f59050803b61004857600080fd5b6000808351602085016000855af16040513d6000823e81610067573d81fd5b3d81f35b634e487b7160e01b600052604160045260246000fd5b600082601f83011261009257600080fd5b81516001600160401b038111156100ab576100ab61006b565b604051601f8201601f19908116603f011681016001600160401b03811182821017156100d9576100d961006b565b6040528181528382016020018510156100f157600080fd5b60005b82811015610110576020818601810151838301820152016100f4565b506000918101602001919091529392505050565b6000806040838503121561013757600080fd5b82516001600160401b0381111561014d57600080fd5b61015985828601610081565b602085015190935090506001600160401b0381111561017757600080fd5b61018385828601610081565b915050925092905056fe", Hf = "0x608060405234801561001057600080fd5b506040516102c03803806102c083398101604081905261002f916101e6565b836001600160a01b03163b6000036100e457600080836001600160a01b03168360405161005c9190610270565b6000604051808303816000865af19150503d8060008114610099576040519150601f19603f3d011682016040523d82523d6000602084013e61009e565b606091505b50915091508115806100b857506001600160a01b0386163b155b156100e1578060405163101bb98d60e01b81526004016100d8919061028c565b60405180910390fd5b50505b6000808451602086016000885af16040513d6000823e81610103573d81fd5b3d81f35b80516001600160a01b038116811461011e57600080fd5b919050565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561015457818101518382015260200161013c565b50506000910152565b600082601f83011261016e57600080fd5b81516001600160401b0381111561018757610187610123565b604051601f8201601f19908116603f011681016001600160401b03811182821017156101b5576101b5610123565b6040528181528382016020018510156101cd57600080fd5b6101de826020830160208701610139565b949350505050565b600080600080608085870312156101fc57600080fd5b61020585610107565b60208601519094506001600160401b0381111561022157600080fd5b61022d8782880161015d565b93505061023c60408601610107565b60608601519092506001600160401b0381111561025857600080fd5b6102648782880161015d565b91505092959194509250565b60008251610282818460208701610139565b9190910192915050565b60208152600082518060208401526102ab816040850160208701610139565b601f01601f1916919091016040019291505056fe";
function Xf(e, { docsPath: t, ...n }) {
  const r = (() => {
    const o = Gr(e, n);
    return o instanceof xn ? e : o;
  })();
  return new qf(r, {
    docsPath: t,
    ...n
  });
}
function xi() {
  let e = () => {
  }, t = () => {
  };
  return { promise: new Promise((r, o) => {
    e = r, t = o;
  }), resolve: e, reject: t };
}
const Ln = /* @__PURE__ */ new Map();
function $f({ fn: e, id: t, shouldSplitBatch: n, wait: r = 0, sort: o }) {
  const s = async () => {
    const l = d();
    i();
    const y = l.map(({ args: g }) => g);
    y.length !== 0 && e(y).then((g) => {
      o && Array.isArray(g) && g.sort(o);
      for (let b = 0; b < l.length; b++) {
        const { resolve: x } = l[b];
        x?.([g[b], g]);
      }
    }).catch((g) => {
      for (let b = 0; b < l.length; b++) {
        const { reject: x } = l[b];
        x?.(g);
      }
    });
  }, i = () => Ln.delete(t), u = () => d().map(({ args: l }) => l), d = () => Ln.get(t) || [], h = (l) => Ln.set(t, [...d(), l]);
  return {
    flush: i,
    async schedule(l) {
      const { promise: y, resolve: g, reject: b } = xi();
      return n?.([...u(), l]) && s(), d().length > 0 ? (h({ args: l, resolve: g, reject: b }), y) : (h({ args: l, resolve: g, reject: b }), setTimeout(s, r), y);
    }
  };
}
async function _f(e, t) {
  const { account: n = e.account, batch: r = !!e.batch?.multicall, blockNumber: o, blockTag: s = "latest", accessList: i, blobs: u, code: d, data: h, factory: l, factoryData: y, gas: g, gasPrice: b, maxFeePerBlobGas: x, maxFeePerGas: v, maxPriorityFeePerGas: k, nonce: A, to: I, value: F, stateOverride: B, ...M } = t, T = n ? mt(n) : void 0;
  if (d && (l || y))
    throw new N("Cannot provide both `code` & `factory`/`factoryData` as parameters.");
  if (d && I)
    throw new N("Cannot provide both `code` & `to` as parameters.");
  const U = d && h, z = l && y && I && h, P = U || z, L = U ? nh({
    code: d,
    data: h
  }) : z ? rh({
    data: h,
    factory: l,
    factoryData: y,
    to: I
  }) : h;
  try {
    Cn(t);
    const Y = (o ? J(o) : void 0) || s, _ = Qs(B), O = e.chain?.formatters?.transactionRequest?.format, ae = (O || Wr)({
      // Pick out extra data that might exist on the chain's transaction request type.
      ...Vr(M, { format: O }),
      from: T?.address,
      accessList: i,
      blobs: u,
      data: L,
      gas: g,
      gasPrice: b,
      maxFeePerBlobGas: x,
      maxFeePerGas: v,
      maxPriorityFeePerGas: k,
      nonce: A,
      to: P ? void 0 : I,
      value: F
    });
    if (r && eh({ request: ae }) && !_)
      try {
        return await th(e, {
          ...ae,
          blockNumber: o,
          blockTag: s
        });
      } catch (Qe) {
        if (!(Qe instanceof Gs) && !(Qe instanceof $n))
          throw Qe;
      }
    const Oe = await e.request({
      method: "eth_call",
      params: _ ? [
        ae,
        Y,
        _
      ] : [ae, Y]
    });
    return Oe === "0x" ? { data: void 0 } : { data: Oe };
  } catch (j) {
    const Y = oh(j), { offchainLookup: _, offchainLookupSignature: O } = await import("./ccip-DIMl1M8r.js");
    if (e.ccipRead !== !1 && Y?.slice(0, 10) === O && I)
      return { data: await _(e, { data: Y, to: I }) };
    throw P && Y?.slice(0, 10) === "0x101bb98d" ? new jf({ factory: l }) : Xf(j, {
      ...t,
      account: T,
      chain: e.chain
    });
  }
}
function eh({ request: e }) {
  const { data: t, to: n, ...r } = e;
  return !(!t || t.startsWith(Kf) || !n || Object.values(r).filter((o) => typeof o < "u").length > 0);
}
async function th(e, t) {
  const { batchSize: n = 1024, wait: r = 0 } = typeof e.batch?.multicall == "object" ? e.batch.multicall : {}, { blockNumber: o, blockTag: s = "latest", data: i, multicallAddress: u, to: d } = t;
  let h = u;
  if (!h) {
    if (!e.chain)
      throw new Gs();
    h = Jf({
      blockNumber: o,
      chain: e.chain,
      contract: "multicall3"
    });
  }
  const y = (o ? J(o) : void 0) || s, { schedule: g } = $f({
    id: `${e.uid}.${y}`,
    wait: r,
    shouldSplitBatch(v) {
      return v.reduce((A, { data: I }) => A + (I.length - 2), 0) > n * 2;
    },
    fn: async (v) => {
      const k = v.map((F) => ({
        allowFailure: !0,
        callData: F.data,
        target: F.to
      })), A = Zf({
        abi: Uo,
        args: [k],
        functionName: "aggregate3"
      }), I = await e.request({
        method: "eth_call",
        params: [
          {
            data: A,
            to: h
          },
          y
        ]
      });
      return Vf({
        abi: Uo,
        args: [k],
        functionName: "aggregate3",
        data: I || "0x"
      });
    }
  }), [{ returnData: b, success: x }] = await g({ data: i, to: d });
  if (!x)
    throw new Yf({ data: b });
  return b === "0x" ? { data: void 0 } : { data: b };
}
function nh(e) {
  const { code: t, data: n } = e;
  return Ds({
    abi: pi(["constructor(bytes, bytes)"]),
    bytecode: Qf,
    args: [t, n]
  });
}
function rh(e) {
  const { data: t, factory: n, factoryData: r, to: o } = e;
  return Ds({
    abi: pi(["constructor(address, bytes, address, bytes)"]),
    bytecode: Hf,
    args: [o, t, n, r]
  });
}
function oh(e) {
  if (!(e instanceof N))
    return;
  const t = e.walk();
  return typeof t?.data == "object" ? t.data?.data : t.data;
}
const sh = /* @__PURE__ */ new Map(), ih = /* @__PURE__ */ new Map();
function ah(e) {
  const t = (o, s) => ({
    clear: () => s.delete(o),
    get: () => s.get(o),
    set: (i) => s.set(o, i)
  }), n = t(e, sh), r = t(e, ih);
  return {
    clear: () => {
      n.clear(), r.clear();
    },
    promise: n,
    response: r
  };
}
async function ch(e, { cacheKey: t, cacheTime: n = Number.POSITIVE_INFINITY }) {
  const r = ah(t), o = r.response.get();
  if (o && n > 0 && (/* @__PURE__ */ new Date()).getTime() - o.created.getTime() < n)
    return o.data;
  let s = r.promise.get();
  s || (s = e(), r.promise.set(s));
  try {
    const i = await s;
    return r.response.set({ created: /* @__PURE__ */ new Date(), data: i }), i;
  } finally {
    r.promise.clear();
  }
}
const uh = (e) => `blockNumber.${e}`;
async function lh(e, { cacheTime: t = e.cacheTime } = {}) {
  const n = await ch(() => e.request({
    method: "eth_blockNumber"
  }), { cacheKey: uh(e.uid), cacheTime: t });
  return BigInt(n);
}
function dh(e, { args: t, eventName: n } = {}) {
  return {
    ...e,
    blockHash: e.blockHash ? e.blockHash : null,
    blockNumber: e.blockNumber ? BigInt(e.blockNumber) : null,
    logIndex: e.logIndex ? Number(e.logIndex) : null,
    transactionHash: e.transactionHash ? e.transactionHash : null,
    transactionIndex: e.transactionIndex ? Number(e.transactionIndex) : null,
    ...n ? { args: t, eventName: n } : {}
  };
}
async function Ai(e, { blockHash: t, blockNumber: n, blockTag: r, hash: o, index: s }) {
  const i = r || "latest", u = n !== void 0 ? J(n) : void 0;
  let d = null;
  if (o ? d = await e.request({
    method: "eth_getTransactionByHash",
    params: [o]
  }, { dedupe: !0 }) : t ? d = await e.request({
    method: "eth_getTransactionByBlockHashAndIndex",
    params: [t, J(s)]
  }, { dedupe: !0 }) : d = await e.request({
    method: "eth_getTransactionByBlockNumberAndIndex",
    params: [u || i, J(s)]
  }, { dedupe: !!u }), !d)
    throw new Ws({
      blockHash: t,
      blockNumber: n,
      blockTag: i,
      hash: o,
      index: s
    });
  return (e.chain?.formatters?.transaction?.format || Ys)(d);
}
const fh = {
  "0x0": "reverted",
  "0x1": "success"
};
function hh(e) {
  const t = {
    ...e,
    blockNumber: e.blockNumber ? BigInt(e.blockNumber) : null,
    contractAddress: e.contractAddress ? e.contractAddress : null,
    cumulativeGasUsed: e.cumulativeGasUsed ? BigInt(e.cumulativeGasUsed) : null,
    effectiveGasPrice: e.effectiveGasPrice ? BigInt(e.effectiveGasPrice) : null,
    gasUsed: e.gasUsed ? BigInt(e.gasUsed) : null,
    logs: e.logs ? e.logs.map((n) => dh(n)) : null,
    to: e.to ? e.to : null,
    transactionIndex: e.transactionIndex ? ft(e.transactionIndex) : null,
    status: e.status ? fh[e.status] : null,
    type: e.type ? js[e.type] || e.type : null
  };
  return e.blobGasPrice && (t.blobGasPrice = BigInt(e.blobGasPrice)), e.blobGasUsed && (t.blobGasUsed = BigInt(e.blobGasUsed)), t;
}
async function Oo(e, { hash: t }) {
  const n = await e.request({
    method: "eth_getTransactionReceipt",
    params: [t]
  }, { dedupe: !0 });
  if (!n)
    throw new Zs({ hash: t });
  return (e.chain?.formatters?.transactionReceipt?.format || hh)(n);
}
const On = /* @__PURE__ */ new Map(), Go = /* @__PURE__ */ new Map();
let mh = 0;
function hr(e, t, n) {
  const r = ++mh, o = () => On.get(e) || [], s = () => {
    const l = o();
    On.set(e, l.filter((y) => y.id !== r));
  }, i = () => {
    const l = o();
    if (!l.some((g) => g.id === r))
      return;
    const y = Go.get(e);
    l.length === 1 && y && y(), s();
  }, u = o();
  if (On.set(e, [
    ...u,
    { id: r, fns: t }
  ]), u && u.length > 0)
    return i;
  const d = {};
  for (const l in t)
    d[l] = ((...y) => {
      const g = o();
      if (g.length !== 0)
        for (const b of g)
          b.fns[l]?.(...y);
    });
  const h = n(d);
  return typeof h == "function" && Go.set(e, h), i;
}
async function mr(e) {
  return new Promise((t) => setTimeout(t, e));
}
function ph(e, { emitOnBegin: t, initialWaitTime: n, interval: r }) {
  let o = !0;
  const s = () => o = !1;
  return (async () => {
    let u;
    t && (u = await e({ unpoll: s }));
    const d = await n?.(u) ?? r;
    await mr(d);
    const h = async () => {
      o && (await e({ unpoll: s }), await mr(r), h());
    };
    h();
  })(), s;
}
function gh(e, { emitOnBegin: t = !1, emitMissed: n = !1, onBlockNumber: r, onError: o, poll: s, pollingInterval: i = e.pollingInterval }) {
  const u = typeof s < "u" ? s : !(e.transport.type === "webSocket" || e.transport.type === "fallback" && e.transport.transports[0].config.type === "webSocket");
  let d;
  return u ? (() => {
    const y = ar([
      "watchBlockNumber",
      e.uid,
      t,
      n,
      i
    ]);
    return hr(y, { onBlockNumber: r, onError: o }, (g) => ph(async () => {
      try {
        const b = await ue(e, lh, "getBlockNumber")({ cacheTime: 0 });
        if (d) {
          if (b === d)
            return;
          if (b - d > 1 && n)
            for (let x = d + 1n; x < b; x++)
              g.onBlockNumber(x, d), d = x;
        }
        (!d || b > d) && (g.onBlockNumber(b, d), d = b);
      } catch (b) {
        g.onError?.(b);
      }
    }, {
      emitOnBegin: t,
      interval: i
    }));
  })() : (() => {
    const y = ar([
      "watchBlockNumber",
      e.uid,
      t,
      n
    ]);
    return hr(y, { onBlockNumber: r, onError: o }, (g) => {
      let b = !0, x = () => b = !1;
      return (async () => {
        try {
          const v = (() => {
            if (e.transport.type === "fallback") {
              const A = e.transport.transports.find((I) => I.config.type === "webSocket");
              return A ? A.value : e.transport;
            }
            return e.transport;
          })(), { unsubscribe: k } = await v.subscribe({
            params: ["newHeads"],
            onData(A) {
              if (!b)
                return;
              const I = kt(A.result?.number);
              g.onBlockNumber(I, d), d = I;
            },
            onError(A) {
              g.onError?.(A);
            }
          });
          x = k, b || x();
        } catch (v) {
          o?.(v);
        }
      })(), () => x();
    });
  })();
}
function Vo(e, { delay: t = 100, retryCount: n = 2, shouldRetry: r = () => !0 } = {}) {
  return new Promise((o, s) => {
    const i = async ({ count: u = 0 } = {}) => {
      const d = async ({ error: h }) => {
        const l = typeof t == "function" ? t({ count: u, error: h }) : t;
        l && await mr(l), i({ count: u + 1 });
      };
      try {
        const h = await e();
        o(h);
      } catch (h) {
        if (u < n && await r({ count: u, error: h }))
          return d({ error: h });
        s(h);
      }
    };
    i();
  });
}
async function yh(e, {
  confirmations: t = 1,
  hash: n,
  onReplaced: r,
  pollingInterval: o = e.pollingInterval,
  retryCount: s = 6,
  retryDelay: i = ({ count: d }) => ~~(1 << d) * 200,
  // exponential backoff
  timeout: u = 18e4
}) {
  const d = ar(["waitForTransactionReceipt", e.uid, n]);
  let h, l, y, g = !1;
  const { promise: b, resolve: x, reject: v } = xi(), k = u ? setTimeout(() => v(new td({ hash: n })), u) : void 0, A = hr(d, { onReplaced: r, resolve: x, reject: v }, (I) => {
    const F = ue(e, gh, "watchBlockNumber")({
      emitMissed: !0,
      emitOnBegin: !0,
      poll: !0,
      pollingInterval: o,
      async onBlockNumber(B) {
        const M = (U) => {
          clearTimeout(k), F(), U(), A();
        };
        let T = B;
        if (!g)
          try {
            if (y) {
              if (t > 1 && (!y.blockNumber || T - y.blockNumber + 1n < t))
                return;
              M(() => I.resolve(y));
              return;
            }
            if (h || (g = !0, await Vo(async () => {
              h = await ue(e, Ai, "getTransaction")({ hash: n }), h.blockNumber && (T = h.blockNumber);
            }, {
              delay: i,
              retryCount: s
            }), g = !1), y = await ue(e, Oo, "getTransactionReceipt")({ hash: n }), t > 1 && (!y.blockNumber || T - y.blockNumber + 1n < t))
              return;
            M(() => I.resolve(y));
          } catch (U) {
            if (U instanceof Ws || U instanceof Zs) {
              if (!h) {
                g = !1;
                return;
              }
              try {
                l = h, g = !0;
                const z = await Vo(() => ue(e, Wt, "getBlock")({
                  blockNumber: T,
                  includeTransactions: !0
                }), {
                  delay: i,
                  retryCount: s,
                  shouldRetry: ({ error: j }) => j instanceof qs
                });
                g = !1;
                const P = z.transactions.find(({ from: j, nonce: Y }) => j === l.from && Y === l.nonce);
                if (!P || (y = await ue(e, Oo, "getTransactionReceipt")({
                  hash: P.hash
                }), t > 1 && (!y.blockNumber || T - y.blockNumber + 1n < t)))
                  return;
                let L = "replaced";
                P.to === l.to && P.value === l.value && P.input === l.input ? L = "repriced" : P.from === P.to && P.value === 0n && (L = "cancelled"), M(() => {
                  I.onReplaced?.({
                    reason: L,
                    replacedTransaction: l,
                    transaction: P,
                    transactionReceipt: y
                  }), I.resolve(y);
                });
              } catch (z) {
                M(() => I.reject(z));
              }
            } else
              M(() => I.reject(U));
          }
      }
    });
  });
  return b;
}
function Gt(e, t, n) {
  const r = e[t.name];
  if (typeof r == "function")
    return r;
  const o = e[n];
  return typeof o == "function" ? o : (s) => t(e, s);
}
const bh = "2.13.4", wh = () => `@wagmi/core@${bh}`;
var Ci = function(e, t, n, r) {
  if (n === "a" && !r) throw new TypeError("Private accessor was defined without a getter");
  if (typeof t == "function" ? e !== t || !r : !t.has(e)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return n === "m" ? r : n === "a" ? r.call(e) : r ? r.value : t.get(e);
}, sn, vi;
class ot extends Error {
  get docsBaseUrl() {
    return "https://wagmi.sh/core";
  }
  get version() {
    return wh();
  }
  constructor(t, n = {}) {
    super(), sn.add(this), Object.defineProperty(this, "details", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "docsPath", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "metaMessages", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "shortMessage", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "WagmiCoreError"
    });
    const r = n.cause instanceof ot ? n.cause.details : n.cause?.message ? n.cause.message : n.details, o = n.cause instanceof ot && n.cause.docsPath || n.docsPath;
    this.message = [
      t || "An error occurred.",
      "",
      ...n.metaMessages ? [...n.metaMessages, ""] : [],
      ...o ? [
        `Docs: ${this.docsBaseUrl}${o}.html${n.docsSlug ? `#${n.docsSlug}` : ""}`
      ] : [],
      ...r ? [`Details: ${r}`] : [],
      `Version: ${this.version}`
    ].join(`
`), n.cause && (this.cause = n.cause), this.details = r, this.docsPath = o, this.metaMessages = n.metaMessages, this.shortMessage = t;
  }
  walk(t) {
    return Ci(this, sn, "m", vi).call(this, this, t);
  }
}
sn = /* @__PURE__ */ new WeakSet(), vi = function e(t, n) {
  return n?.(t) ? t : t.cause ? Ci(this, sn, "m", e).call(this, t.cause, n) : t;
};
class xh extends ot {
  constructor() {
    super("Chain not configured."), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "ChainNotConfiguredError"
    });
  }
}
class Ah extends ot {
  constructor() {
    super("Connector not connected."), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "ConnectorNotConnectedError"
    });
  }
}
class Ch extends ot {
  constructor({ address: t, connector: n }) {
    super(`Account "${t}" not found for connector "${n.name}".`), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "ConnectorAccountNotFoundError"
    });
  }
}
class vh extends ot {
  constructor({ connectionChainId: t, connectorChainId: n }) {
    super(`The current chain of the connector (id: ${n}) does not match the connection's chain (id: ${t}).`, {
      metaMessages: [
        `Current Chain ID:  ${n}`,
        `Expected Chain ID: ${t}`
      ]
    }), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "ConnectorChainMismatchError"
    });
  }
}
async function Ih(e, t = {}) {
  let n;
  if (t.connector) {
    const { connector: h } = t, [l, y] = await Promise.all([
      h.getAccounts(),
      h.getChainId()
    ]);
    n = {
      accounts: l,
      chainId: y,
      connector: h
    };
  } else
    n = e.state.connections.get(e.state.current);
  if (!n)
    throw new Ah();
  const r = t.chainId ?? n.chainId, o = await n.connector.getChainId();
  if (o !== n.chainId)
    throw new vh({
      connectionChainId: n.chainId,
      connectorChainId: o
    });
  const s = n.connector;
  if (s.getClient)
    return s.getClient({ chainId: r });
  const i = mt(t.account ?? n.accounts[0]);
  i.address = Il(i.address);
  const u = e.chains.find((h) => h.id === r), d = await n.connector.getProvider({ chainId: r });
  if (t.account && !n.accounts.some((h) => h.toLowerCase() === i.address.toLowerCase()))
    throw new Ch({
      address: i.address,
      connector: s
    });
  return Sa({
    account: i,
    chain: u,
    name: "Connector Client",
    transport: (h) => Ta(d)({ ...h, retryCount: 0 })
  });
}
function Ii(e) {
  const t = e.state.current, n = e.state.connections.get(t), r = n?.accounts, o = r?.[0], s = e.chains.find((u) => u.id === n?.chainId), i = e.state.status;
  switch (i) {
    case "connected":
      return {
        address: o,
        addresses: r,
        chain: s,
        chainId: n?.chainId,
        connector: n?.connector,
        isConnected: !0,
        isConnecting: !1,
        isDisconnected: !1,
        isReconnecting: !1,
        status: i
      };
    case "reconnecting":
      return {
        address: o,
        addresses: r,
        chain: s,
        chainId: n?.chainId,
        connector: n?.connector,
        isConnected: !!o,
        isConnecting: !1,
        isDisconnected: !1,
        isReconnecting: !0,
        status: i
      };
    case "connecting":
      return {
        address: o,
        addresses: r,
        chain: s,
        chainId: n?.chainId,
        connector: n?.connector,
        isConnected: !1,
        isConnecting: !0,
        isDisconnected: !1,
        isReconnecting: !1,
        status: i
      };
    case "disconnected":
      return {
        address: void 0,
        addresses: void 0,
        chain: void 0,
        chainId: void 0,
        connector: void 0,
        isConnected: !1,
        isConnecting: !1,
        isDisconnected: !0,
        isReconnecting: !1,
        status: i
      };
  }
}
async function Eh(e, t) {
  const { account: n, chainId: r, connector: o, gas: s, ...i } = t;
  let u;
  typeof n == "object" && n.type === "local" ? u = e.getClient({ chainId: r }) : u = await Ih(e, { account: n, chainId: r, connector: o });
  const { connector: d } = Ii(e), h = await (async () => {
    if (!(!("data" in t) || !t.data) && !(o ?? d)?.supportsSimulation && s !== null)
      return s === void 0 ? Gt(u, Hs, "estimateGas")({
        ...i,
        account: n,
        chain: r ? { id: r } : null
      }) : s;
  })();
  return await Gt(u, Ud, "sendTransaction")({
    ...i,
    ...n ? { account: n } : {},
    gas: h,
    chain: r ? { id: r } : null
  });
}
class kh extends ot {
  constructor({ connector: t }) {
    super(`"${t.name}" does not support programmatic chain switching.`), Object.defineProperty(this, "name", {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: "SwitchChainNotSupportedError"
    });
  }
}
async function Sh(e, t) {
  const { addEthereumChainParameter: n, chainId: r } = t, o = e.state.connections.get(t.connector?.uid ?? e.state.current);
  if (o) {
    const i = o.connector;
    if (!i.switchChain)
      throw new kh({ connector: i });
    return await i.switchChain({
      addEthereumChainParameter: n,
      chainId: r
    });
  }
  const s = e.chains.find((i) => i.id === r);
  if (!s)
    throw new xh();
  return e.setState((i) => ({ ...i, chainId: r })), s;
}
async function Th(e, t) {
  const { chainId: n, timeout: r = 0, ...o } = t, s = e.getClient({ chainId: n }), u = await Gt(s, yh, "waitForTransactionReceipt")({ ...o, timeout: r });
  if (u.status === "reverted") {
    const h = await Gt(s, Ai, "getTransaction")({ hash: u.transactionHash }), y = await Gt(s, _f, "call")({
      ...h,
      gasPrice: h.type !== "eip1559" ? h.gasPrice : void 0,
      maxFeePerGas: h.type === "eip1559" ? h.maxFeePerGas : void 0,
      maxPriorityFeePerGas: h.type === "eip1559" ? h.maxPriorityFeePerGas : void 0
    }), g = y?.data ? Ba(`0x${y.data.substring(138)}`) : "unknown reason";
    throw new Error(g);
  }
  return {
    ...u,
    chainId: s.chain.id
  };
}
function Bh(e) {
  if (!e.to) throw new Error("No tx recipient address specified");
  return {
    to: e.to,
    value: Pt(e.value || Wa.from("0")),
    data: e.data,
    nonce: e.nonce,
    chainId: e.chainId,
    gas: e.gasLimit ? Pt(e.gasLimit) : void 0,
    gasPrice: e.gasPrice ? Pt(e.gasPrice) : void 0,
    maxFeePerGas: e.maxFeePerGas ? Pt(e.maxFeePerGas) : void 0,
    maxPriorityFeePerGas: e.maxPriorityFeePerGas ? Pt(e.maxPriorityFeePerGas) : void 0
  };
}
function Pt(e) {
  return BigInt(e.toString());
}
function Nh(e) {
  const t = Fa(), n = ie(
    async (s) => {
      const i = e.getChainMetadata(s).chainId;
      await Sh(t, { chainId: i });
    },
    [t, e]
  ), r = ie(
    async ({
      tx: s,
      chainName: i,
      activeChainName: u
    }) => {
      if (s.type !== we.EthersV5)
        throw new Error(`Unsupported tx type: ${s.type}`);
      u && u !== i && await n(i);
      const d = e.getChainMetadata(i).chainId;
      q.debug("Checking wallet current chain"), Ii(t), q.debug(`Sending tx on chain ${i}`);
      const h = Bh(s.transaction), l = await Eh(t, {
        chainId: d,
        ...h
      });
      return { hash: l, confirm: () => Th(t, {
        chainId: d,
        hash: l,
        confirmations: 1
      }).then((b) => ({
        type: we.Viem,
        receipt: { ...b, contractAddress: b.contractAddress || null }
      })) };
    },
    [t, n, e]
  ), o = ie(
    async ({
      txs: s,
      chainName: i,
      activeChainName: u
    }) => {
      throw new Error("Multi Transactions not supported on EVM");
    },
    []
  );
  return {
    sendTransaction: r,
    sendMultiTransaction: o,
    switchNetwork: n
  };
}
function Fh(e) {
  const { sendTransaction: t } = qt(), n = ie(async (s) => {
    q.warn(`Solana wallet must be connected to origin chain ${s}`);
  }, []), r = ie(
    async ({
      tx: s,
      chainName: i,
      activeChainName: u
    }) => {
      if (s.type !== we.SolanaWeb3)
        throw new Error(`Unsupported tx type: ${s.type}`);
      u && u !== i && await n(i);
      const d = e.getRpcUrl(i), h = new wr(d, "confirmed"), {
        context: { slot: l },
        value: { blockhash: y, lastValidBlockHeight: g }
      } = await h.getLatestBlockhashAndContext();
      q.debug(`Sending tx on chain ${i}`);
      const b = await t(s.transaction, h, {
        minContextSlot: l
      });
      return { hash: b, confirm: () => h.confirmTransaction({ blockhash: y, lastValidBlockHeight: g, signature: b }).then(() => h.getTransaction(b)).then((v) => ({
        type: we.SolanaWeb3,
        receipt: v
      })) };
    },
    [n, t, e]
  ), o = ie(
    async ({
      txs: s,
      chainName: i,
      activeChainName: u
    }) => {
      throw new Error("Multi Transactions not supported on Solana");
    },
    [n, t, e]
  );
  return {
    sendTransaction: r,
    sendMultiTransaction: o,
    switchNetwork: n
  };
}
function Ei(e) {
  const t = yc(e), { cosmos: n } = ct(), { data: r, isLoading: o } = Ua({
    chainId: Object.keys(n ?? {}),
    multiChain: !0
  }), {
    data: s,
    isLoading: i
  } = Da({
    chainId: Object.keys(n ?? {}),
    multiChain: !0
  }), {
    data: u,
    isLoading: d
  } = Pa({
    chainId: Object.keys(n ?? {}),
    multiChain: !0
  }), h = ie(
    async (g) => {
      const b = e.getChainMetadata(g).displayName || g;
      throw new Error(
        `Cosmos wallet must be connected to origin chain ${b}}`
      );
    },
    [e]
  ), l = ie(
    async ({
      tx: g,
      chainName: b,
      activeChainName: x
    }) => {
      const v = t[b], k = n?.[v.chainId];
      if (!k)
        throw new Error(`Cosmos wallet not connected for ${b}`);
      if (!r || !u || !s)
        throw new Error(
          `Cosmos signing clients not initialized for ${b}`
        );
      x && x !== b && await h(b), q.debug(`Sending tx on chain ${b}`);
      let A, I;
      if (g.type === we.CosmJsWasm) {
        const B = s[v.chainId];
        if (!B)
          throw new Error(`CosmWasm client not initialized for ${b}`);
        A = await B.executeMultiple(
          k,
          [g.transaction],
          "auto"
        ), I = await B?.getTx(
          A.transactionHash
        );
      } else if (g.type === we.CosmJs) {
        const B = r[v.chainId], M = await Ga.connectWithSigner(
          v.rpcUrls[0].http,
          B?.offlineSignerAuto,
          {
            // set zero gas price here so it does not error. actual gas price
            // will be injected from the wallet registry like Keplr or Leap
            gasPrice: uo.fromString("0token")
          }
        );
        if (!M)
          throw new Error(`Stargate client not initialized for ${b}`);
        A = await M?.signAndBroadcast(
          k,
          [g.transaction],
          2
        ), I = await M?.getTx(A.transactionHash);
      } else if (g.type === we.CosmJsNative) {
        const B = r[v.chainId];
        A = await (await Va.connectWithSigner(
          v.rpcUrls.map((T) => T.http),
          B?.offlineSignerAuto,
          {
            metadata: {
              // set zero gas price here so it does not error. actual gas price
              // will be injected from the wallet registry like Keplr or Leap
              gasPrice: uo.fromString("0token")
            }
          }
        )).sendAndConfirmTransaction(g.transaction), I = {
          height: A.height,
          txIndex: A.txIndex,
          hash: A.transactionHash,
          code: A.code,
          events: A.events,
          gasUsed: A.gasUsed,
          gasWanted: A.gasWanted,
          rawLog: A.rawLog ?? "",
          msgResponses: A.msgResponses,
          tx: new Uint8Array()
        };
      } else
        throw new Error(`Invalid cosmos provider type ${g.type}`);
      const F = async () => (ga(
        I,
        `Cosmos tx failed: ${JSON.stringify(
          A,
          (B, M) => typeof M == "bigint" ? M.toString() : M
        )}`
      ), {
        type: g.type,
        receipt: { ...I, transactionHash: A.transactionHash }
      });
      return { hash: A.transactionHash, confirm: F };
    },
    [
      h,
      s,
      r,
      u,
      n,
      t
    ]
  ), y = ie(
    async ({
      txs: g,
      chainName: b,
      activeChainName: x
    }) => {
      throw new Error("Multi Transactions not supported on Cosmos");
    },
    []
  );
  return {
    sendTransaction: l,
    sendMultiTransaction: y,
    switchNetwork: h,
    isLoading: o || i || d
  };
}
function Mh(e) {
  const {
    switchNetwork: t,
    sendTransaction: n,
    sendMultiTransaction: r
  } = Nh(e), {
    switchNetwork: o,
    sendTransaction: s,
    sendMultiTransaction: i
  } = Fh(e), {
    switchNetwork: u,
    sendTransaction: d,
    sendMultiTransaction: h
  } = Ei(e);
  return R(
    () => ({
      [D.Ethereum]: {
        sendTransaction: n,
        sendMultiTransaction: r,
        switchNetwork: t
      },
      [D.Sealevel]: {
        sendTransaction: s,
        sendMultiTransaction: i,
        switchNetwork: o
      },
      [D.Cosmos]: {
        sendTransaction: d,
        sendMultiTransaction: h,
        switchNetwork: u
      },
      [D.CosmosNative]: {
        sendTransaction: d,
        sendMultiTransaction: h,
        switchNetwork: u
      }
    }),
    [
      t,
      n,
      r,
      o,
      s,
      i,
      u,
      d,
      h
    ]
  );
}
const Rh = We.leapApiBaseUrl;
class qr {
  static ky = jo.create({
    prefixUrl: Rh,
    timeout: !1
  });
  static async logTxn(t) {
    try {
      const n = {
        operation: t.operationType,
        data: t.data
      };
      await qr.ky.post("celestia/", {
        json: n
      });
    } catch (n) {
      console.error("Failed to log txn", n);
    }
  }
}
const zh = (e) => {
  switch (e) {
    case de.COSMIFRAME:
      return "cosmiframe-extension";
    case de.COSMOSTATION:
      return "cosmostation-extension";
    case de.KEPLR:
      return "keplr-extension";
    case de.LEAP:
      return "leap-extension";
    case de.STATION:
      return "station-extension";
    case de.VECTIS:
      return "vectis-extension";
    case de.XDEFI:
      return "xdefi-extension";
    case de.WALLETCONNECT:
      return "walletconnect";
    case de.WC_LEAP_MOBILE:
      return "leap-mobile";
    case de.WC_KEPLR_MOBILE:
      return "keplr-mobile";
    case de.WC_COSMOSTATION_MOBILE:
      return "cosmostation-mobile";
    case de.WC_CLOT_MOBILE:
      return "clot-mobile";
    case de.METAMASK_SNAP_COSMOS:
      return "cosmos-extension-metamask";
    case de.METAMASK_SNAP_LEAP:
      return "leap-metamask-cosmos-snap";
    case de.COMPASS:
      return "compass-extension";
    case de.INITIA:
      return "initia-extension";
    case de.OKX:
      return "okx-extension";
  }
}, Uh = (e, t, n) => {
  const r = {
    token: {
      amount: t,
      denom: e.token?.addressOrDenom
    },
    toChain: e.toChainId
  };
  return n && (r.mappingId = e.transferId), r;
}, Dh = (e, t, n) => {
  const r = {
    provider: e.provider,
    bridge: e.bridge,
    fromChain: e.fromChainId,
    token: {
      amount: t,
      denom: e.token?.addressOrDenom
    },
    toChain: e.toChainId
  };
  return n && (r.mappingId = e.transferId), r;
};
function Ph(e) {
  switch (e) {
    case D.Ethereum:
      return "evm";
    case D.Sealevel:
      return "svm";
    case D.Cosmos:
    case D.CosmosNative:
      return "cosmos";
    default:
      return "unknown";
  }
}
async function Lh(e, t) {
  let n;
  if (e.token?.decimals && !isNaN(parseFloat(t)) && e.token.coinGeckoId) {
    const r = parseFloat(t) / 10 ** (e.token?.decimals ?? 6), o = await ls(e.token.coinGeckoId);
    o !== void 0 && !isNaN(o) && (n = r * o);
  }
  return n;
}
const Oh = () => {
  const e = Mc();
  return { logTx: ie(
    async (n) => {
      if (Za.debug("useTxLogging", n), n.data === void 0)
        return;
      const {
        txHash: r,
        address: o,
        originChainProtocol: s,
        data: i,
        amount: u,
        transactionCount: d,
        walletClient: h
      } = n;
      let l;
      const y = Ph(s);
      y === "cosmos" && (l = n.fees);
      const g = e.find(
        (P) => P.name === i.fromChain
      ), b = e.find(
        (P) => P.name === i.toChain
      );
      let x, v;
      const k = d > 1;
      i.type === "ibc_transfer" ? v = Uh(
        {
          ...i,
          fromChainId: String(g?.chainId),
          toChainId: String(b?.chainId)
        },
        u,
        k
      ) : (x = "bridge_send", v = Dh(
        {
          ...i,
          fromChainId: String(g?.chainId),
          toChainId: String(b?.chainId)
        },
        u,
        k
      )), x = x ?? i.type;
      const A = await Lh(i, u), I = Ja.parse(window.navigator.userAgent), F = I.platform.type?.replace(" ", "_")?.toLowerCase() ?? "unknown", B = I.browser.name?.replace(" ", "_")?.toLowerCase() ?? "unknown", M = `${F}_${B}`, T = {
        ...v,
        browser: M,
        walletClient: y === "cosmos" ? zh(h) : h
      }, U = {
        txHash: r,
        chainId: String(g?.chainId),
        type: x,
        feeDenomination: l?.[0].denom,
        feeQuantity: l?.[0].amount,
        metadata: T,
        walletAddress: o,
        amount: A,
        isMainnet: !0
      }, z = `${y}.tx`;
      qr.logTxn({
        operationType: z,
        data: U
      });
    },
    [e]
  ) };
}, Gh = "ChainMismatchError", Vh = "block height exceeded", Wh = "timeout";
function Zh() {
  const { transfers: e, addTransfer: t, updateTransferStatus: n } = Tr(), r = e.length, o = Nt(), s = it(), i = hn(), u = Uu(o), d = Mh(o), { isLoading: h } = Ei(o), { logTx: l } = Oh(), [y, g] = he(!1), b = ie(
    (x) => Kh({
      warpCore: s,
      values: x,
      transferIndex: r,
      activeAccounts: i,
      activeChains: u,
      transactionFns: d,
      addTransfer: t,
      updateTransferStatus: n,
      setIsLoading: g,
      logTx: l
    }),
    [
      s,
      r,
      i,
      u,
      d,
      g,
      t,
      n,
      l
    ]
  );
  return {
    isLoading: y || h,
    triggerTransactions: b
  };
}
async function Jh(e) {
  const {
    warpCore: t,
    values: n,
    transferIndex: r,
    activeAccounts: o,
    updateTransferStatus: s
  } = e, { destination: i, denom: u, amount: d, sourceAddress: h } = n, l = t.multiProvider;
  q.debug("Preparing transfer transaction(s)"), s(r, ne.Preparing);
  const y = un(t, u), g = y?.getConnectionForChain(i);
  if (!y || !g)
    throw new Error("No token route found between chains");
  const b = y, x = g, v = b.protocol, A = b.isNft() ? d : br(d, b.decimals), I = b.amount(A);
  if (!o.accounts[v]) throw new Error("No active account found for origin chain");
  return {
    originToken: b,
    connection: x,
    originProtocol: v,
    originTokenAmount: I,
    sender: h,
    multiProvider: l
  };
}
async function qh(e, t) {
  const { warpCore: n, values: r, transferIndex: o, addTransfer: s, updateTransferStatus: i } = e, { origin: u, destination: d, amount: h, recipient: l } = r, { originToken: y, connection: g, originTokenAmount: b, sender: x } = t;
  if (!await n.isDestinationCollateralSufficient({
    originTokenAmount: b,
    destination: d
  }))
    throw new Error("Insufficient destination collateral");
  s({
    timestamp: (/* @__PURE__ */ new Date()).getTime(),
    status: ne.Preparing,
    origin: u,
    destination: d,
    originTokenAddressOrDenom: y.addressOrDenom,
    destTokenAddressOrDenom: g?.token.addressOrDenom,
    sender: x,
    recipient: l,
    amount: h
  }), i(o, ne.CreatingTxs);
}
async function jh(e, t) {
  const {
    warpCore: n,
    values: r,
    transferIndex: o,
    transactionFns: s,
    activeChains: i,
    updateTransferStatus: u,
    logTx: d
  } = e, { origin: h, destination: l, recipient: y, gasInfo: g } = r, {
    originProtocol: b,
    originTokenAmount: x,
    sender: v,
    multiProvider: k,
    originToken: A
  } = t, I = await n.getTransferRemoteTxs({
    originTokenAmount: x,
    destination: l,
    sender: v,
    recipient: y
  }), F = s[b].sendTransaction, B = s[b].sendMultiTransaction, M = i.chains[b], T = [];
  let U;
  const z = {
    txHash: "",
    address: v,
    recipient: y,
    data: {
      type: "bridge_send",
      transferId: crypto.randomUUID(),
      fromChain: h,
      toChain: l,
      token: A,
      bridge: "hyperlane",
      provider: ""
    },
    originChainProtocol: b,
    transactionCount: I.length,
    amount: x.amount.toString(),
    walletClient: M.walletClient,
    fees: g?.gasFees.map((L) => ({
      denom: L.denom ?? L.symbol,
      amount: L.amountRaw
    }))
  };
  if (I.length > 1 && I.every((L) => L.type === we.Starknet)) {
    u(
      o,
      Xt[lt.Transfer][0]
    );
    const { hash: L, confirm: j } = await B({
      txs: I,
      chainName: h,
      activeChainName: M.chainName
    });
    u(
      o,
      Xt[lt.Transfer][1]
    ), U = await j();
    const Y = Wn(lt.Transfer);
    q.debug(`${Y} transaction confirmed, hash:`, L), T.push(L);
  } else
    for (const L of I) {
      u(o, Xt[L.category][0]);
      const { hash: j, confirm: Y } = await F({
        tx: L,
        chainName: h,
        activeChainName: M.chainName
      });
      L.category === lt.Transfer && (z.txHash = j, d(z)), u(o, Xt[L.category][1]), U = await Y();
      const _ = Wn(L.category);
      q.debug(`${_} transaction confirmed, hash:`, j), T.push(j);
    }
  const P = U ? mc(k, h, U) : void 0;
  return { hashes: T, txReceipt: U, msgId: P };
}
function Yh(e, t, n, r, o, s) {
  const i = e instanceof Error ? e.message : String(e);
  r(n, ne.Failed), q.error(`Error at stage ${t}`, { error: e, errorDetails: i }), i.includes(Gh) || (i.includes(Vh) || i.includes(Wh) ? q.error(
    "Transaction timed out",
    `${lc(o, s)} may be busy. Please try again.`
  ) : q.error(
    "Unable to transfer tokens",
    Qh[t] || "Unable to transfer tokens."
  ));
}
async function Kh(e) {
  const { transferIndex: t, updateTransferStatus: n, setIsLoading: r } = e;
  r(!0);
  const o = ne.Preparing;
  try {
    const s = await Jh(e);
    await qh(e, s);
    const { hashes: i, msgId: u } = await jh(e, s);
    n(t, ne.ConfirmedTransfer, {
      originTxHash: i.at(-1),
      msgId: u
    });
  } catch (s) {
    throw Yh(
      s,
      o,
      t,
      n,
      e.warpCore.multiProvider,
      e.values.origin
    ), s;
  }
  r(!1);
}
const Qh = {
  [ne.Preparing]: "Error while preparing the transactions.",
  [ne.CreatingTxs]: "Error while creating the transactions.",
  [ne.SigningApprove]: "Error while signing the approve transaction.",
  [ne.ConfirmingApprove]: "Error while confirming the approve transaction.",
  [ne.SigningTransfer]: "Error while signing the transfer transaction.",
  [ne.ConfirmingTransfer]: "Error while confirming the transfer transaction."
}, Xt = {
  [lt.Approval]: [
    ne.SigningApprove,
    ne.ConfirmingApprove
  ],
  [lt.Revoke]: [
    ne.SigningRevoke,
    ne.ConfirmingRevoke
  ],
  [lt.Transfer]: [
    ne.SigningTransfer,
    ne.ConfirmingTransfer
  ]
}, Hh = ({
  originTokenAmount: e,
  destination: t,
  sender: n,
  recipient: r
}) => {
  const o = it();
  return Ce({
    queryKey: ["useRemoteTxs", n, r],
    retry: !1,
    queryFn: async () => o.getTransferRemoteTxs({
      originTokenAmount: e,
      destination: t,
      sender: n,
      recipient: r
    })
  });
}, Xh = (e) => {
  const t = e.inputAmount, n = it(), { accounts: r } = hn(), o = un(n, e.fromToken?.key), s = Pe(e.fromChain?.key), i = Pe(e.toChain?.key), u = Et(
    e.fromChain?.key
  ), d = Et(
    e.toChain?.key
  ), h = tt(u), l = tt(d);
  u && (u.chainType === D.Cosmos || u.chainType === D.CosmosNative) && r[u.chainType]?.publicKey?.[String(u?.chainId)];
  const y = o?.isNft(), [g, b] = he("idle"), x = y ? t.toString() : br(t, o?.decimals), { isLoading: v, isApproveRequired: k } = Fu(h, o, x), { data: A, isLoading: I } = Hh({
    destination: i,
    sender: h,
    recipient: l,
    originTokenAmount: o?.amount(x)
  }), { triggerTransactions: F, isLoading: B } = Zh(), M = ie(
    async ({ gas: T }) => {
      b("loading");
      const [, U] = await cc(
        F({
          denom: e.fromToken?.key,
          origin: s,
          destination: i,
          amount: t,
          recipient: l,
          sourceAddress: h,
          gasInfo: T
        })
      );
      if (U) {
        b("error");
        return;
      }
      b("success");
    },
    [
      i,
      l,
      F,
      e.fromToken?.key,
      t,
      s,
      h
    ]
  );
  return {
    isApproveRequired: k,
    isApproveLoading: v,
    isTransferLoading: B,
    handleConfirm: M,
    txStatus: g,
    txs: A,
    isTxsLoading: I
  };
}, ki = ({
  message: e,
  subMessage: t,
  txCount: n = 1,
  currentTxStatus: r
}) => {
  const [o, s] = he(0);
  $(() => {
    if (r === ne.ConfirmingApprove) {
      s((u) => u + 1);
      return;
    }
  }, [r]);
  const i = new Array(n).fill(0);
  return /* @__PURE__ */ m("div", { children: /* @__PURE__ */ S("div", { className: "flex flex-col items-center gap-3 text-center text-foreground", children: [
    /* @__PURE__ */ m("div", { className: "flex items-center justify-center gap-4", children: i.map((u, d) => d === o ? /* @__PURE__ */ m(
      "div",
      {
        className: "border-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2"
      },
      d
    ) : d < o ? /* @__PURE__ */ m(xa, { className: "size-4" }, d) : /* @__PURE__ */ m(
      "div",
      {
        className: "border-foreground/30 text-muted-foreground flex size-4 items-center justify-center rounded-full border-2 text-[10px]",
        children: d + 1
      },
      d
    )) }),
    /* @__PURE__ */ m("div", { className: "text-sm", children: e || "Sign your transaction in your wallet to continue" }),
    /* @__PURE__ */ m("div", { className: "text-muted-foreground text-xs", children: t || "If your wallet does not show a transaction request or never confirms, please try the transfer again." })
  ] }) });
}, $h = () => /* @__PURE__ */ m("div", { className: "bg-secondary rounded-2xl border p-4 text-xs text-foreground", children: "Multi-step transactions require more than one approval." });
function Si({
  className: e,
  orientation: t = "horizontal",
  decorative: n = !0,
  ...r
}) {
  return /* @__PURE__ */ m(
    qa.Root,
    {
      "data-slot": "separator",
      decorative: n,
      orientation: t,
      className: se(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        e
      ),
      ...r
    }
  );
}
const Ti = (e) => /* @__PURE__ */ S("div", { className: "mb-5 text-foreground", children: [
  /* @__PURE__ */ S("div", { className: "mb-4 flex items-center gap-2", children: [
    /* @__PURE__ */ m(
      "button",
      {
        type: "button",
        onClick: e.onBack,
        "aria-label": "Back",
        className: "text-foreground/80 hover:bg-foreground/10 rounded-full p-1",
        children: /* @__PURE__ */ m(Bt, { className: "size-4 text-foreground" })
      }
    ),
    /* @__PURE__ */ m("div", { className: "text-sm font-semibold", children: "Review transaction" })
  ] }),
  /* @__PURE__ */ S("div", { className: "relative flex flex-col gap-1", children: [
    /* @__PURE__ */ m(
      Wo,
      {
        title: "You pay",
        amount: e.fromAmount || "0.00",
        token: e.fromToken,
        chain: e.fromChain,
        displayFormat: e.displayFormat
      }
    ),
    /* @__PURE__ */ m("div", { className: "bg-card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full", children: /* @__PURE__ */ m(
      oe,
      {
        size: "icon",
        variant: "secondary",
        className: "border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100",
        disabled: !0,
        children: /* @__PURE__ */ m(an, { className: "transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" })
      }
    ) }),
    /* @__PURE__ */ m(
      Wo,
      {
        title: "You receive",
        amount: e.toAmount || "0.00",
        token: e.toToken,
        chain: e.toChain,
        displayFormat: e.displayFormat
      }
    )
  ] })
] });
function Wo(e) {
  return /* @__PURE__ */ S("div", { className: "bg-card-foreground rounded-2xl p-4", children: [
    /* @__PURE__ */ m("div", { className: "text-muted-foreground text-xs", children: e.title }),
    /* @__PURE__ */ S("div", { className: "mt-1 flex items-center justify-between", children: [
      /* @__PURE__ */ S("div", { children: [
        /* @__PURE__ */ S("div", { className: "text-2xl font-semibold", children: [
          e.displayFormat === Q.FIAT ? "$" : "",
          e.amount,
          " ",
          e.displayFormat === Q.TOKEN ? e.token?.symbol : ""
        ] }),
        /* @__PURE__ */ S("div", { className: "mt-1 flex items-center gap-1", children: [
          /* @__PURE__ */ m(
            fs,
            {
              selectedChain: e.chain,
              assetData: e.token,
              inputAmount: e.amount,
              inputType: e.displayFormat,
              showSwitch: !1
            }
          ),
          /* @__PURE__ */ m(
            Si,
            {
              orientation: "vertical",
              className: "h-1 w-1 rounded-full border-2 border-foreground"
            }
          ),
          /* @__PURE__ */ S("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ m("span", { className: "text-secondary-foreground text-sm", children: "From" }),
            /* @__PURE__ */ S("div", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ S(Se, { className: "size-4 rounded-full", children: [
                /* @__PURE__ */ m(Te, { src: e.chain?.logoURI }),
                /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-4" }) })
              ] }),
              /* @__PURE__ */ m("span", { className: "text-sm font-bold", children: e.chain?.displayName })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ m("div", { className: "flex items-center gap-2 text-sm", children: /* @__PURE__ */ S("div", { className: "relative", children: [
        /* @__PURE__ */ S(Se, { className: "size-12", children: [
          /* @__PURE__ */ m(Te, { src: `${e.token?.logoURI}` }),
          /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-12" }) })
        ] }),
        /* @__PURE__ */ S(Se, { className: "absolute right-0 bottom-0 size-4 rounded-full", children: [
          /* @__PURE__ */ m(Te, { src: e.chain?.logoURI }),
          /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-4" }) })
        ] })
      ] }) })
    ] })
  ] });
}
const _h = ({
  className: e
}) => {
  const t = W((A) => A.state.from.chain), n = W((A) => A.state.to.chain), r = W((A) => A.state.from.token), o = W((A) => A.state.from.amount), s = W(
    (A) => A.state.amountDisplayFormat
  ), i = W((A) => A.setScreen), u = Tr((A) => A.transfers), { data: d } = Sr(r?.coingeckoId), h = R(() => {
    if (!o) return "0";
    let A = new X(o);
    if (s === Q.FIAT) {
      if (!d) return "0";
      A = new X(o).dividedBy(d);
    }
    return A.toString();
  }, [o, d, s]), l = R(() => u[u.length - 1]?.status, [u]), { handleConfirm: y, txStatus: g, txs: b, isTxsLoading: x } = Xh({
    fromChain: t,
    fromToken: r,
    toChain: n,
    inputAmount: h
  });
  $(() => {
    g === "error" ? i("failure") : g === "success" && i("success");
  }, [g, i]);
  const { isFetching: v, gasInfo: k } = us(
    {
      originChainId: t?.key,
      destinationChainId: n?.key,
      asset: r?.key,
      inputAmount: h || "0"
    },
    !1
  );
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ S("div", { className: "flex-1", children: [
      /* @__PURE__ */ m(
        Ti,
        {
          fromAmount: o,
          fromToken: r,
          fromChain: t,
          toAmount: o,
          toToken: r,
          toChain: n,
          displayFormat: s,
          onBack: () => i("home")
        }
      ),
      /* @__PURE__ */ m(pn, { gasInfo: k, isGasLoading: v, children: /* @__PURE__ */ m(ts, { fromToken: r }) }),
      b && !x && b?.length > 1 ? /* @__PURE__ */ m($h, {}) : null
    ] }),
    (g === "loading" || g === "validating") && /* @__PURE__ */ m("div", { className: "mt-auto w-full", children: /* @__PURE__ */ m(
      ki,
      {
        txCount: b?.length,
        currentTxStatus: l
      }
    ) }),
    g === "idle" && /* @__PURE__ */ m(
      oe,
      {
        className: "mt-auto w-full",
        size: "lg",
        onClick: () => y({ gas: k }),
        disabled: v || x,
        children: "Confirm"
      }
    )
  ] });
}, em = {
  initial: { opacity: 0 },
  animate: { opacity: 1 }
}, tm = {
  duration: 0.2,
  ease: "easeOut"
}, nm = ({ asset: e, isSelected: t, onSelect: n, balanceInfo: r, isLoadingBalances: o }) => /* @__PURE__ */ m(
  oe,
  {
    asChild: !0,
    size: "sm",
    variant: "ghost",
    className: "text-foreground bg-secondary/40 rounded-md2 flex h-auto w-full items-center justify-start gap-3 px-3 py-2 ring-inset disabled:!opacity-50",
    onClick: () => n(e.originDenom),
    disabled: t,
    children: /* @__PURE__ */ S(
      Ee.button,
      {
        initial: "initial",
        animate: "animate",
        transition: tm,
        variants: em,
        children: [
          /* @__PURE__ */ S(Se, { className: "h-8 w-8 shrink-0 bg-white p-1", children: [
            /* @__PURE__ */ m(Te, { src: It(e.logoUri) ?? "" }),
            /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, {}) })
          ] }),
          /* @__PURE__ */ m("div", { className: "w-full text-left", children: /* @__PURE__ */ S("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ S("span", { className: "flex flex-col", children: [
              /* @__PURE__ */ m("span", { className: "text-base font-bold", children: e.symbol }),
              /* @__PURE__ */ m("span", { className: "text-secondary-foreground text-xs capitalize", children: e.chainName })
            ] }),
            /* @__PURE__ */ m(vt, { mode: "wait", children: o ? /* @__PURE__ */ m(
              Ee.div,
              {
                initial: "hidden",
                animate: "visible",
                exit: "hidden",
                transition: De,
                variants: _e,
                children: /* @__PURE__ */ m(Je, { className: "h-4 w-10" })
              },
              "balance-skeleton"
            ) : /* @__PURE__ */ m(
              Ee.div,
              {
                initial: "hidden",
                animate: "visible",
                exit: "hidden",
                transition: De,
                variants: _e,
                className: "flex flex-col items-end text-right",
                children: /* @__PURE__ */ m("span", { className: "text-secondary-foreground text-xs font-medium", children: r?.amount ? `${Ae(r?.amount)} ${e.symbol}` : "" })
              },
              "balance"
            ) })
          ] }) })
        ]
      }
    )
  },
  e.originDenom
), rm = ji(nm), om = (e) => /* @__PURE__ */ S(
  oe,
  {
    className: "bg-secondary/40 h-auto min-w-[100px] items-center justify-start rounded-2xl border border-border/25 px-4 py-3",
    size: "sm",
    variant: "ghost",
    disabled: e.isSelected,
    onClick: e.onSelect,
    children: [
      /* @__PURE__ */ S(Se, { className: "size-5 shrink-0 rounded-none", children: [
        /* @__PURE__ */ m(Te, { src: e.chain.logoURI }),
        /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-5" }) })
      ] }),
      /* @__PURE__ */ m("span", { className: "text-md font-bold", children: e.chain.displayName })
    ]
  },
  e.chain.chainId
), sm = (e) => /* @__PURE__ */ m(
  "svg",
  {
    width: "14",
    height: "14",
    viewBox: "0 0 14 14",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    ...e,
    children: /* @__PURE__ */ m(
      "path",
      {
        d: "M5.125 10.0001C3.7625 10.0001 2.60938 9.52819 1.66563 8.58444C0.721875 7.64069 0.25 6.48756 0.25 5.12506C0.25 3.76256 0.721875 2.60944 1.66563 1.66569C2.60938 0.721936 3.7625 0.250061 5.125 0.250061C6.4875 0.250061 7.64062 0.721936 8.58438 1.66569C9.52812 2.60944 10 3.76256 10 5.12506C10 5.67506 9.9125 6.19381 9.7375 6.68131C9.5625 7.16881 9.325 7.60006 9.025 7.97506L13.225 12.1751C13.3625 12.3126 13.4313 12.4876 13.4313 12.7001C13.4313 12.9126 13.3625 13.0876 13.225 13.2251C13.0875 13.3626 12.9125 13.4313 12.7 13.4313C12.4875 13.4313 12.3125 13.3626 12.175 13.2251L7.975 9.02506C7.6 9.32506 7.16875 9.56256 6.68125 9.73756C6.19375 9.91256 5.675 10.0001 5.125 10.0001ZM5.125 8.50006C6.0625 8.50006 6.85938 8.17194 7.51562 7.51569C8.17188 6.85944 8.5 6.06256 8.5 5.12506C8.5 4.18756 8.17188 3.39069 7.51562 2.73444C6.85938 2.07819 6.0625 1.75006 5.125 1.75006C4.1875 1.75006 3.39062 2.07819 2.73438 2.73444C2.07812 3.39069 1.75 4.18756 1.75 5.12506C1.75 6.06256 2.07812 6.85944 2.73438 7.51569C3.39062 8.17194 4.1875 8.50006 5.125 8.50006Z",
        fill: "currentColor"
      }
    )
  }
), Zo = {
  error: "ring-destructive focus-within:ring-destructive ring-1",
  success: "ring-accent-success focus-within:ring-accent-success ring-1",
  warning: "ring-accent-warning focus-within:ring-accent-warning ring-1",
  default: "ring-border ring-1 data-[disabled=true]:ring-0 hover:ring-foreground/25"
}, Bi = gr.forwardRef(
  ({
    className: e,
    leadingElement: t,
    trailingElement: n,
    status: r,
    inputClassName: o,
    ...s
  }, i) => /* @__PURE__ */ S(
    "div",
    {
      "data-disabled": s.disabled,
      className: se(
        "md:text-md bg-secondary-200 placeholder:text-muted-foreground flex h-12 w-full items-center gap-2 truncate rounded-xl px-5 text-xs font-medium caret-blue-200 shadow-sm outline-0 transition-shadow placeholder-shown:truncate disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        Zo[r || "default"] ?? Zo.default,
        e
      ),
      children: [
        t,
        /* @__PURE__ */ m(
          "input",
          {
            ref: i,
            className: se(
              "placeholder:text-muted-foreground no-appearance-search flex-1 rounded-md rounded-l-md border-none bg-transparent py-1 text-base outline-none placeholder-shown:font-sans",
              o
            ),
            ...s
          }
        ),
        n
      ]
    }
  )
);
Bi.displayName = "Input";
const pr = gr.forwardRef((e, t) => /* @__PURE__ */ m(
  Bi,
  {
    ...e,
    type: "search",
    ref: t,
    trailingElement: e.onClear ? /* @__PURE__ */ m(
      oe,
      {
        type: "button",
        title: "Clear",
        size: "icon",
        variant: "secondary",
        className: "size-7.5",
        onClick: (n) => {
          n.target.closest("input")?.blur(), e.onClear?.();
        },
        children: /* @__PURE__ */ m(Ea, {})
      }
    ) : /* @__PURE__ */ m(sm, { className: "size-4 shrink-0" })
  }
));
pr.displayName = "SearchInput";
const Ni = ({
  open: e,
  title: t,
  chains: n,
  tokens: r,
  onClose: o,
  selectedChain: s,
  selectedToken: i,
  onSelectChain: u,
  onSelectToken: d,
  onlyChainSelection: h
}) => {
  const [l, y] = ut.useState(""), [g, b] = ut.useState(""), x = ut.useMemo(() => {
    const B = g.trim().toLowerCase(), M = n || [];
    return B ? n ? new lo(n, {
      keys: ["chainId", "displayName", "name"],
      threshold: 0.2
    }).search(B).map((U) => U.item) : [] : M;
  }, [n, g]), v = ut.useMemo(() => !s || h ? [] : r ? Array.isArray(r) ? r.map((B) => ({
    ...B,
    chainName: s.displayName
  })) : r[s.key].map((B) => ({
    ...B,
    chainName: s.displayName
  })) || [] : [], [s, r, h]), { data: k, isLoading: A } = dn(
    {
      chainId: s?.key,
      assets: v
    },
    !h
  ), I = R(() => {
    if (v?.length !== 0)
      return k ? v.sort((B, M) => {
        const T = k.balances[B.originDenom]?.amount;
        return k.balances[M.originDenom]?.amount?.isGreaterThan(T ?? 0) ? 1 : -1;
      }) : v.sort((B, M) => B.symbol.localeCompare(M.symbol));
  }, [v, k]), F = ut.useMemo(() => {
    const B = l.trim().toLowerCase(), M = I || [];
    return B ? new lo(M, {
      keys: ["symbol", "originDenom", "name"],
      threshold: 0.2
    }).search(B).map((U) => U.item) : M;
  }, [I, l]);
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ S("div", { className: "mb-6 flex items-center gap-2", children: [
      /* @__PURE__ */ m(
        "button",
        {
          type: "button",
          "aria-label": "Back",
          onClick: o,
          className: "text-foreground/80 hover:bg-foreground/10 rounded-full p-1.5",
          children: /* @__PURE__ */ m(Bt, { className: "size-4 text-foreground" })
        }
      ),
      /* @__PURE__ */ m("div", { className: "text-base font-semibold", children: t })
    ] }),
    /* @__PURE__ */ S("div", { className: "flex h-[554px] flex-col", children: [
      n && /* @__PURE__ */ S("div", { className: "flex-shrink-0", children: [
        /* @__PURE__ */ m(
          pr,
          {
            className: "bg-secondary mb-3 ring-0 text-foreground",
            value: g,
            onChange: (B) => b(B.target.value),
            placeholder: "Search by chain name",
            disabled: x === void 0 || !v
          }
        ),
        x.length > 0 ? /* @__PURE__ */ m("div", { className: "flex flex-wrap gap-2", children: x?.map((B) => /* @__PURE__ */ m(
          om,
          {
            chain: B,
            onSelect: () => u?.(B),
            isSelected: B.chainId === s?.key
          },
          B.chainId
        )) }) : /* @__PURE__ */ m(
          ho,
          {
            icon: /* @__PURE__ */ m(so, { size: 32, className: "text-foreground" }),
            message: `No chains found for '${g}'`,
            subtext: "Try searching for a different term"
          }
        )
      ] }),
      !h && /* @__PURE__ */ S(ye, { children: [
        /* @__PURE__ */ m("div", { className: "my-5 flex flex-shrink-0 justify-center", children: /* @__PURE__ */ m(Si, { className: "rounded-md2 max-w-5 border-1 border-white" }) }),
        r && /* @__PURE__ */ S("div", { className: "flex min-h-0 flex-1 flex-col", children: [
          /* @__PURE__ */ m(
            pr,
            {
              className: "bg-secondary mb-3 flex-shrink-0 ring-0 text-foreground",
              value: l,
              onChange: (B) => y(B.target.value),
              placeholder: "Search by token name",
              disabled: F === void 0 || !v
            }
          ),
          /* @__PURE__ */ m("div", { className: "no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto", children: A ? Array.from({ length: 3 }).map((B, M) => /* @__PURE__ */ S(
            "div",
            {
              className: "bg-secondary/40 rounded-md2 flex h-auto w-full items-center justify-start gap-3 px-3 py-2",
              children: [
                /* @__PURE__ */ m(Je, { className: "h-8 w-8 rounded-full" }),
                /* @__PURE__ */ S("div", { className: "flex w-full items-center justify-between", children: [
                  /* @__PURE__ */ S("div", { className: "flex flex-col gap-1", children: [
                    /* @__PURE__ */ m(Je, { className: "h-4 w-12" }),
                    /* @__PURE__ */ m(Je, { className: "h-3 w-16" })
                  ] }),
                  /* @__PURE__ */ m(Je, { className: "h-4 w-10" })
                ] })
              ]
            },
            M
          )) : F?.length > 0 ? F?.map((B) => /* @__PURE__ */ m(
            rm,
            {
              asset: B,
              onSelect: () => d?.(B),
              isSelected: B.originDenom === i,
              balanceInfo: k?.balances[B.originDenom]
            },
            B.originDenom
          )) : /* @__PURE__ */ m(
            ho,
            {
              icon: /* @__PURE__ */ m(so, { size: 32, className: "text-foreground" }),
              message: `No assets found for '${l}'`,
              subtext: "Try searching for a different term"
            }
          ) })
        ] })
      ] })
    ] })
  ] });
}, im = ({ className: e, selectorCtx: t }) => {
  const n = W((k) => k.state.from.chain), r = W((k) => k.state.to.chain), o = W((k) => k.state.from.token), s = W((k) => k.state.to.token), { setScreen: i, setFromChain: u, setToChain: d, setFromToken: h } = W(), l = Pe(n?.key), y = Pe(r?.key), g = Ir(
    n?.key,
    l,
    y
  ), b = ln(), x = zc(void 0, !0), v = R(() => x && n?.key ? x(b, n.key) : b, [x, n?.key, b]);
  return $(() => {
    r?.key && g.length == 0 && d({
      key: v[0]?.chainId,
      displayName: v[0]?.displayName,
      logoURI: v[0]?.logoURI,
      chainType: v[0]?.chainType
    });
  }, [v, g, r?.key]), /* @__PURE__ */ m(
    Ni,
    {
      open: !0,
      title: t?.showOnlyChains ? "Select chain" : "Select chain & token",
      chains: t?.showOnlyChains ? v : b,
      onlyChainSelection: t?.showOnlyChains,
      tokens: g,
      onClose: () => i("home"),
      selectedChain: t?.side === "from" ? n : r,
      selectedToken: t?.side === "from" ? o?.key : s?.key,
      onSelectChain: (k) => {
        t && (t.side === "from" ? u({
          key: k.chainId,
          displayName: k.displayName,
          logoURI: k.logoURI || void 0,
          chainType: k.chainType
        }) : d({
          key: k.chainId,
          displayName: k.displayName,
          logoURI: k.logoURI || void 0,
          chainType: k.chainType
        }), h(void 0));
      },
      onSelectToken: (k) => {
        t && (t.side === "from" && h({
          key: k.originDenom,
          symbol: k.symbol,
          logoURI: k.logoUri,
          coingeckoId: k.coingeckoId
        }), i("home"));
      }
    }
  );
}, Fi = ({ recivedAmount: e, toChain: t, toToken: n, explorerLink: r }) => /* @__PURE__ */ S("div", { className: "my-auto flex flex-col items-center gap-3 rounded-xl px-5 py-6", children: [
  /* @__PURE__ */ m("div", { className: "text-sm font-semibold", children: "Txn Successful!" }),
  /* @__PURE__ */ S("div", { className: "relative mb-3", children: [
    /* @__PURE__ */ S(Se, { className: "size-24", children: [
      /* @__PURE__ */ m(Te, { src: `${n?.logoURI}` }),
      /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-24" }) })
    ] }),
    /* @__PURE__ */ S(Se, { className: "absolute right-0 bottom-0 size-8 rounded-full", children: [
      /* @__PURE__ */ m(Te, { src: t?.logoURI }),
      /* @__PURE__ */ m(Be, { children: /* @__PURE__ */ m(ke, { className: "size-8" }) })
    ] })
  ] }),
  /* @__PURE__ */ S("div", { className: "text-center", children: [
    /* @__PURE__ */ S("p", { className: "text-3.5xl font-bold", children: [
      " ",
      Ae(e),
      " ",
      n?.symbol
    ] }),
    /* @__PURE__ */ S("p", { className: "text-sm font-normal", children: [
      "Received on ",
      t?.displayName
    ] })
  ] }),
  r && /* @__PURE__ */ m(
    "a",
    {
      className: "text-sm underline",
      href: r,
      target: "_blank",
      rel: "noreferrer",
      children: "View on Explorer"
    }
  )
] }), am = ({
  className: e
}) => {
  const t = W((d) => d.setScreen), n = Tr((d) => d.transfers), r = W((d) => d.state.from.amount), o = W((d) => d.state.to.chain), s = W((d) => d.state.from.token), i = Nt(), u = R(() => {
    const d = n[n.length - 1];
    if (!d) return;
    const { origin: h, msgId: l, originTxHash: y } = d;
    return i.tryGetExplorerTxUrl(h, {
      hash: l || y
    });
  }, [n, i]);
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ m("div", { className: "mb-4 flex items-center gap-2 text-foreground", children: /* @__PURE__ */ m(
      "button",
      {
        type: "button",
        onClick: () => t("home"),
        "aria-label": "Back",
        className: "text-foreground/80 hover:bg-foreground/10 rounded-full p-1",
        children: /* @__PURE__ */ m(Bt, { className: "size-4 text-foreground" })
      }
    ) }),
    /* @__PURE__ */ m(
      Fi,
      {
        recivedAmount: r,
        toChain: o,
        toToken: s,
        explorerLink: u
      }
    ),
    /* @__PURE__ */ m(
      oe,
      {
        className: "mt-auto w-full transition-all hover:scale-105",
        size: "lg",
        onClick: () => t("home"),
        children: "Bridge Again"
      }
    )
  ] });
}, cm = ({
  className: e,
  onStatusChange: t
}) => {
  const n = W((v) => v.state.screen), r = W((v) => v.state.from.chain), o = W((v) => v.state.to.chain), s = W((v) => v.state.from.token), { setFromToken: i, setScreen: u } = W(), [d, h] = he(null), l = Pe(r?.key), y = Pe(o?.key), g = Ir(
    r?.key,
    l,
    y
  );
  $(() => {
    r?.key && g && !s && g.length > 0 && i({
      key: g[0].originDenom,
      symbol: g[0].symbol,
      logoURI: g[0].logoUri
    });
  }, [i, s, r?.key, g]);
  const b = (v) => {
    u(v);
  }, x = (v) => {
    h(v);
  };
  switch ($(() => {
    t && t(n ?? "home");
  }, [n, t]), n) {
    case "home":
      return /* @__PURE__ */ m(
        bo,
        {
          className: e,
          onNavigate: b,
          onSetSelectorContext: x
        }
      );
    case "review":
      return /* @__PURE__ */ m(_h, { className: e });
    case "success":
      return /* @__PURE__ */ m(am, { className: e });
    case "failure":
      return /* @__PURE__ */ m(Zc, { className: e });
    case "selector":
      return /* @__PURE__ */ m(
        im,
        {
          className: e,
          selectorCtx: d
        }
      );
    default:
      return /* @__PURE__ */ m(
        bo,
        {
          className: e,
          onNavigate: b,
          onSetSelectorContext: x
        }
      );
  }
}, um = ({
  className: e
}) => {
  const t = V((n) => n.setScreen);
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ S("div", { className: "mb-4 flex items-center gap-2 text-foreground", children: [
      /* @__PURE__ */ m(
        "button",
        {
          type: "button",
          onClick: () => t("home"),
          "aria-label": "Back",
          className: "text-foreground/80 hover:bg-foreground/10 rounded-full p-1",
          children: /* @__PURE__ */ m(Bt, { className: "size-4 text-foreground" })
        }
      ),
      /* @__PURE__ */ m("div", { className: "text-sm font-semibold", children: "Back" })
    ] }),
    /* @__PURE__ */ m(
      es,
      {
        icon: /* @__PURE__ */ m(Yo, { className: "size-8 text-red-500" }),
        message: "Transaction Failed",
        subtext: "Something went wrong during the transaction. Please try again."
      }
    ),
    /* @__PURE__ */ m(
      oe,
      {
        className: "mt-auto w-full",
        size: "lg",
        onClick: () => t("home"),
        children: "Try Again"
      }
    )
  ] });
}, Mi = (e) => {
  if (e) {
    const t = e?.fees.relayer;
    return {
      gasFees: t ? [
        {
          amount: Ae(t.amountFormatted),
          symbol: t.currency.symbol,
          denom: t.currency.address,
          amountRaw: t.amount
        }
      ] : [],
      fiatAmount: Qo(
        new X(t?.amountUsd ?? "0").toString(),
        "$"
      )
    };
  }
  return {
    gasFees: [],
    fiatAmount: null
  };
}, lm = async (e) => ze.getRoute(e);
function Ri(e, t = !0) {
  const {
    sender: n,
    recipient: r,
    sourceChainId: o,
    destinationChainId: s,
    sourceAsset: i,
    destinationAsset: u,
    amountIn: d,
    affiliateFees: h
  } = e;
  return Ce({
    queryKey: [
      "swapQuote",
      n,
      r,
      o,
      s,
      i,
      u,
      d,
      h
    ],
    queryFn: async () => {
      if (!o || !s)
        throw new Error("Source and destination chains ids are required");
      if (!i || !u)
        throw new Error("Source and destination assets are required");
      const l = {
        user: n,
        recipient: r,
        originChainId: o,
        destinationChainId: s,
        originCurrency: i,
        destinationCurrency: u,
        amount: d,
        tradeType: Ho.EXACT_INPUT
      };
      h && (l.appFees = h);
      const y = await lm(l);
      if (y.success)
        return y.route;
      throw new Error(y.error || "Failed to fetch swap quote");
    },
    enabled: t && !!(n && r && o && s && i && u && d && Number(d) > 0),
    retry: !1,
    refetchInterval: 3e4
  });
}
const dm = () => {
  const { state: e, setToAddress: t } = V(), [n, r] = he(
    e.to.address || ""
  ), o = n.trim(), s = R(
    () => gs(o),
    [o]
  ), i = o && !s && "The entered address is invalid", u = R(() => s ? o : "", [o, s]);
  return $(() => {
    t(u);
  }, [u, t]), /* @__PURE__ */ S("div", { className: "flex flex-col gap-1 mb-3", children: [
    /* @__PURE__ */ S(
      "label",
      {
        htmlFor: "recipient-address",
        className: "text-foreground-2 text-sm font-medium",
        children: [
          "Recipient Address",
          " ",
          /* @__PURE__ */ m("span", { className: "text-foreground-3 text-xs", children: "(optional)" })
        ]
      }
    ),
    /* @__PURE__ */ m(
      "input",
      {
        id: "recipient-address",
        type: "text",
        placeholder: "Enter recipient address (optional)",
        className: "border-card-surface-2 bg-card-surface focus:border-primary w-full rounded-md border px-3 py-2 text-base outline-none",
        value: n,
        onChange: (d) => r(d.target.value)
      }
    ),
    i && /* @__PURE__ */ m("div", { className: "text-sm text-amber-600", children: i })
  ] });
}, fm = (e) => e.inputAmount ? e.isInsufficientBalance ? "Insufficient balance" : e.isGasLoading ? /* @__PURE__ */ m(Kn, { text: "Fetching quote" }) : e.quoteError ? "Amount too low" : `Swap to ${e.chainDisplayName}` : "Enter amount", Jo = ({
  className: e,
  onNavigate: t,
  onSetSelectorContext: n
}) => {
  const r = V((Z) => Z.state.from.chain), o = V((Z) => Z.state.to.chain), s = V((Z) => Z.state.from.token), i = V((Z) => Z.state.to.token), u = V((Z) => Z.state.from.amount), d = V(
    (Z) => Z.state.amountDisplayFormat
  ), { switchChains: h, setFromAmount: l, setAmountDisplayFormat: y } = V(), { tokens: g, isLoading: b } = jt(), { data: x, isLoading: v } = at(), k = x?.chains, A = R(() => {
    if (!(!k || !r?.key))
      return k.find((Z) => Z.chainId === r?.key);
  }, [k, r?.key]), I = R(() => {
    if (!(!k || !o?.key))
      return k.find((Z) => Z.chainId === o?.key);
  }, [k, o?.key]), F = R(() => {
    if (!s || !g || !r) return null;
    const Z = g[r.key];
    return Z ? Z.find((Yt) => Yt.originDenom === s?.key) : null;
  }, [s, g, r]), B = tt(A), M = mn(I), { data: T, isLoading: U } = dn(
    { chainId: r?.key },
    !!r?.key && !!B
  ), z = R(() => {
    if (!T || !s?.key) return "0";
    const Z = T.balances[s.key];
    return Z ? Z.amount : "0";
  }, [T, s?.key]), { data: P } = ds(
    {
      chainId: r?.key,
      tokenAddress: s?.key
    },
    !!(r?.key && s?.key)
  ), L = R(() => {
    if (!u) return "0";
    let Z = new X(u);
    if (d === Q.FIAT) {
      if (!P) return "0";
      Z = new X(u).dividedBy(P);
    }
    return Z.toString();
  }, [P, u, d]), j = R(() => !F || !L ? "0" : new X(L).multipliedBy(
    new X(10).pow(F.decimals)
  ).toFixed(0), [F, L]), Y = R(() => !L || !z ? !1 : new X(L).isGreaterThan(z), [L, z]), {
    data: _,
    isLoading: O,
    error: le
  } = Ri(
    {
      sender: B || "",
      recipient: M || "",
      sourceChainId: r?.key,
      destinationChainId: o?.key,
      sourceAsset: s?.key,
      destinationAsset: i?.key,
      amountIn: j
    },
    !!(r && o && s && i && u && !Y)
  ), ae = R(() => {
    if (!_) return "";
    const { details: Z } = _;
    return d === Q.FIAT ? Z.currencyOut.amountUsd : Z.currencyOut.amountFormatted;
  }, [_, d]), Oe = Mi(_), Qe = fm({
    isGasLoading: O,
    inputAmount: Number(u),
    chainDisplayName: I?.displayName,
    quoteError: le,
    isInsufficientBalance: Y
  });
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ S("div", { className: "overflow-y-scroll max-h-[90vh]", children: [
      /* @__PURE__ */ m(ms, {}),
      /* @__PURE__ */ S("div", { className: "relative mb-5 flex items-center gap-3", children: [
        /* @__PURE__ */ m(
          _t,
          {
            title: "From",
            selectType: "source",
            chainDetails: r,
            onClick: () => {
              n({ side: "from", kind: "chain" }), t("selector");
            }
          }
        ),
        /* @__PURE__ */ m("div", { className: "bg-card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full", children: /* @__PURE__ */ m(
          oe,
          {
            size: "icon",
            variant: "secondary",
            className: "border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100",
            disabled: r?.key === o?.key,
            onClick: () => h(),
            children: /* @__PURE__ */ m(Ko, { className: "transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" })
          }
        ) }),
        /* @__PURE__ */ m(
          _t,
          {
            title: "To",
            selectType: "destination",
            chainDetails: o,
            onClick: () => {
              n({ side: "to", kind: "chain" }), t("selector");
            }
          }
        )
      ] }),
      /* @__PURE__ */ S("div", { className: "relative mb-3 flex flex-col gap-1", children: [
        /* @__PURE__ */ m(
          Yn,
          {
            label: "You send",
            value: u,
            selectedChain: r,
            assetDetails: s,
            onChange: (Z) => l(Z),
            onOpenSelector: () => {
              n({ side: "from", kind: "token" }), t("selector");
            },
            showDropdownIcon: g && r?.key ? g[r?.key]?.length > 1 : !1,
            selectType: "source",
            setFromAmount: l,
            displayFormat: d,
            setDisplayFormat: y,
            isLoading: b
          }
        ),
        /* @__PURE__ */ m("div", { className: "bg-card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full", children: /* @__PURE__ */ m(
          oe,
          {
            size: "icon",
            variant: "secondary",
            className: "border-card bg-card-foreground group hover:bg-foreground/10 h-auto w-auto cursor-pointer border-4 p-2 text-base disabled:opacity-100",
            disabled: !0,
            children: /* @__PURE__ */ m(an, { className: "transition-transform duration-300 group-hover:scale-110 group-hover:rotate-180 group-disabled:opacity-50" })
          }
        ) }),
        /* @__PURE__ */ m(
          Yn,
          {
            label: "You get",
            value: ae,
            selectedChain: o,
            assetDetails: i,
            onOpenSelector: () => {
              n({ side: "to", kind: "token" }), t("selector");
            },
            disabled: !0,
            selectType: "destination",
            isLoading: b,
            displayFormat: d,
            showDropdownIcon: g && o?.key ? g[o?.key]?.length > 1 : !1
          }
        )
      ] }),
      /* @__PURE__ */ m(dm, {}),
      _ && /* @__PURE__ */ m(pn, { gasInfo: Oe, isGasLoading: O, children: /* @__PURE__ */ m(
        ps,
        {
          fromChain: r,
          toChain: o,
          fromToken: s,
          toToken: i,
          fromAmount: u || "0",
          toAmount: ae || "0"
        }
      ) })
    ] }),
    /* @__PURE__ */ m(
      hs,
      {
        className: "mt-auto",
        sourceChain: A,
        destinationChain: I,
        children: /* @__PURE__ */ m(
          oe,
          {
            className: se(
              "mt-auto w-full transition-all hover:scale-105 font-medium text-md",
              {
                "!bg-destructive/90 text-white": !!le || Y
              }
            ),
            size: "lg",
            onClick: () => t("review"),
            disabled: !u || Y || !r || !s || !o || !i || b || O || v || U || !_,
            children: Qe
          }
        )
      }
    )
  ] });
};
class Gn extends Error {
  /**
   *
   * @param code Error Code
   * @param txnIndex Error Transaction Index
   * @param message Error Message
   */
  constructor(t, n, r) {
    super(r), this.code = t, this.txnIndex = n;
  }
  code;
  txnIndex;
}
const hm = (e) => {
  const [t, n] = ut.useState("idle"), { data: r } = at(), [o, s] = he(
    void 0
  ), i = r?.chains, u = e.quote?.steps.length || 0, { data: d } = Ma(), { connector: h, chain: l } = Jt(), { switchChainAsync: y } = Ra(), { wallet: g } = qt(), [b, x] = he(), [v, k] = he(
    new Array(u).fill({
      status: Ve.IDLE
    })
  ), A = async () => {
    try {
      if (e.fromChain?.chainType === D.Ethereum)
        return l?.id !== Number(e.fromChain?.key) && await M(), {
          wallet: d,
          name: h?.name.toLowerCase().replace(" ", "-") ?? "unknown"
        };
      if (e.fromChain?.chainType === D.Sealevel && i) {
        let T = "";
        const U = i?.find(
          (L) => L.chainId === e.fromChain?.key
        );
        xt(U?.chainId) === Number(cn.solana) ? T = "https://mainnet.helius-rpc.com/?api-key=5175da47-fc80-456d-81e2-81e6e7459f73" : U && (T = U?.rpcUrl);
        const z = new wr(T);
        return {
          wallet: Ha(
            g?.adapter.publicKey?.toBase58(),
            xt(U?.chainId),
            z,
            async (L, j) => ({
              signature: await g?.adapter.sendTransaction(
                L,
                z,
                j
              )
            })
          ),
          name: g?.adapter.name.toLowerCase().replace(" ", "-") ?? "unknown"
        };
      }
      throw new Error("No wallet client found");
    } catch (T) {
      throw new Error("Error getting transacting wallet client", T);
    }
  }, I = ie(
    (T, U) => {
      k((z) => {
        const P = [...z];
        return P[T] = U, P;
      });
    },
    []
  );
  $(() => {
    if (!i) return;
    const T = 0, U = o?.currentStep ?? o?.steps[0];
    if (U) {
      const z = o?.currentStepItem ?? U.items[0];
      switch (z?.errorData && (z.errorData?.name?.includes("SolverStatusTimeoutError") ? x(
        new Gn(
          9,
          T,
          `SolverStatusTimeoutError ${z.errorData.txHash}`
        )
      ) : x(
        new Gn(4, T, "Transaction failed")
      )), z?.progressState) {
        case "confirming": {
          U.id === "approve" ? I(T, {
            status: Ve.CONFIRMING_ALLOWANCE
          }) : I(T, {
            status: Ve.NEEDS_APPROVAL
          });
          break;
        }
        case "signing": {
          I(T, {
            status: Ve.NEEDS_APPROVAL
          });
          break;
        }
        case "posting":
        case "validating": {
          I(T, {
            status: Ve.BROADCASTING
          });
          break;
        }
        case "complete": {
          if (U.id === "approve" && z?.txHashes) {
            const P = i?.find(
              (L) => z.txHashes && Number(L.chainId) === z.txHashes[0].chainId
            );
            I(T, {
              status: Ve.BROADCASTED,
              txHash: z.txHashes[0].txHash,
              chainId: String(z?.txHashes[0].chainId),
              explorerLink: P ? `${P?.explorerUrl}/tx/${z.txHashes[0].txHash}` : ""
            });
            break;
          }
          if (!z?.internalTxHashes)
            x(
              new Gn(
                5,
                T,
                "Transaction broadcast failed"
              )
            );
          else {
            z?.internalTxHashes[0].txHash;
            const P = i?.find(
              (L) => z.internalTxHashes && Number(L.chainId) === z.internalTxHashes[0].chainId
            );
            I(T, {
              status: Ve.BROADCASTED,
              txHash: z.internalTxHashes[0].txHash,
              chainId: String(z?.internalTxHashes[0].chainId),
              explorerLink: P ? `${P?.explorerUrl}/tx/${z.internalTxHashes[0].txHash}` : ""
            });
          }
          break;
        }
      }
    }
  }, [i, o, I]);
  const F = ie(async () => {
    n("pending");
    try {
      const T = await A();
      ja().actions.execute({
        quote: e.quote,
        wallet: T?.wallet,
        onProgress: (U) => {
          s(U);
        }
      }).catch((U) => {
        throw U;
      });
    } catch {
      n("error"), e.onComplete?.({ screen: "failure", payload: o });
    }
  }, [A, e]), B = R(() => {
    if (b?.code)
      return "FAILED";
    if (v[0]?.status === Ve.BROADCASTED)
      return "SUCCESS";
  }, [b, v]);
  $(() => {
    B === "SUCCESS" ? (n("success"), e.onComplete?.({ screen: "success", payload: o })) : B === "FAILED" && (n("error"), e.onComplete?.({ screen: "failure", payload: o }));
  }, [B, u, e, o]);
  const M = ie(async () => {
    if (!(!e.fromChain?.key || !y))
      try {
        await y({
          chainId: Number(e.fromChain?.key)
        });
      } catch {
      }
  }, [e.fromChain?.key, y]);
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ S("div", { className: "flex-1", children: [
      /* @__PURE__ */ m(
        Ti,
        {
          fromAmount: e.fromAmount,
          fromToken: e.fromToken,
          fromChain: e.fromChain,
          toAmount: e.toAmount,
          toToken: e.toToken,
          toChain: e.toChain,
          onBack: e.onBack,
          displayFormat: e.displayFormat
        }
      ),
      e.children
    ] }),
    t === "pending" && /* @__PURE__ */ m("div", { className: "mt-auto w-full", children: /* @__PURE__ */ m(ki, {}) }),
    t === "idle" && /* @__PURE__ */ m(
      oe,
      {
        className: "mt-auto w-full transition-all hover:scale-105",
        size: "lg",
        onClick: F,
        children: "Confirm"
      }
    )
  ] });
}, mm = () => {
  const e = V((T) => T.state.from.chain), t = V((T) => T.state.to.chain), n = V((T) => T.state.from.token), r = V((T) => T.state.to.token), o = V((T) => T.state.from.amount), s = V(
    (T) => T.state.amountDisplayFormat
  ), i = V((T) => T.setScreen), u = V((T) => T.setTxData), { tokens: d } = jt(), { data: h } = at(), l = h?.chains, y = R(() => {
    if (!(!l || !e?.key))
      return l.find((T) => T.chainId === e?.key);
  }, [l, e?.key]), g = R(() => {
    if (!(!l || !t?.key))
      return l.find((T) => T.chainId === t?.key);
  }, [l, t?.key]), b = R(() => {
    if (!n || !d || !e) return null;
    const T = d[e.key];
    return T ? T.find((U) => U.originDenom === n?.key) : null;
  }, [n, d, e]), x = tt(y), v = mn(g), k = R(() => !b || !o ? "0" : new X(o).multipliedBy(
    new X(10).pow(b.decimals)
  ).toFixed(0), [b, o]), { data: A, isLoading: I } = Ri(
    {
      sender: x || "",
      recipient: v || "",
      sourceChainId: e?.key,
      destinationChainId: t?.key,
      sourceAsset: n?.key,
      destinationAsset: r?.key,
      amountIn: k
    },
    !1
  ), F = R(() => {
    if (!A) return "";
    const { details: T } = A;
    return T.currencyOut.amountFormatted;
  }, [A]), B = Mi(A);
  return /* @__PURE__ */ m(
    hm,
    {
      fromAmount: o || "0.00",
      fromChain: e,
      fromToken: n,
      toAmount: F || "0.00",
      toChain: t,
      toToken: r,
      quote: A,
      displayFormat: s,
      onBack: () => i("home"),
      onComplete: (T) => {
        u(T.payload), i(T.screen);
      },
      children: /* @__PURE__ */ m(pn, { gasInfo: B, isGasLoading: I, children: /* @__PURE__ */ m(
        ps,
        {
          fromChain: e,
          toChain: t,
          fromToken: n,
          toToken: r,
          fromAmount: o || "0",
          toAmount: F || "0"
        }
      ) })
    }
  );
}, pm = ({
  className: e,
  selectorCtx: t
}) => {
  const n = V((x) => x.state.from.chain), r = V((x) => x.state.to.chain), o = V((x) => x.state.from.token), s = V((x) => x.state.to.token), { setScreen: i, setFromChain: u, setToChain: d, setFromToken: h, setToToken: l } = V(), { tokens: y } = jt(), { data: g } = at(), b = g?.chains;
  return /* @__PURE__ */ m("div", { className: "flex-1", children: /* @__PURE__ */ m(
    Ni,
    {
      open: !0,
      title: "Select chain & token",
      chains: b,
      tokens: y,
      onClose: () => i("home"),
      selectedChain: t?.side === "from" ? n : r,
      selectedToken: t?.side === "from" ? o?.key : s?.key,
      onSelectChain: (x) => {
        t && (t.side === "from" ? (u({
          key: x.chainId,
          displayName: x.displayName,
          logoURI: x.logoURI || void 0,
          chainType: x.chainType
        }), h(void 0)) : (d({
          key: x.chainId,
          displayName: x.displayName,
          logoURI: x.logoURI || void 0,
          chainType: x.chainType
        }), l(void 0)));
      },
      onSelectToken: (x) => {
        t && (t.side === "from" ? h({
          key: x.originDenom,
          symbol: x.symbol,
          logoURI: x.logoUri,
          coingeckoId: x.coingeckoId
        }) : l({
          key: x.originDenom,
          symbol: x.symbol,
          logoURI: x.logoUri,
          coingeckoId: x.coingeckoId
        }), i("home"));
      }
    }
  ) });
}, gm = ({
  className: e
}) => {
  const t = V((h) => h.setScreen), n = V((h) => h.state.txData), r = V((h) => h.state.to.chain), o = V((h) => h.state.to.token), { data: s } = at(), i = s?.chains, u = n?.details?.currencyOut?.amountFormatted || "0", d = R(() => {
    if (n?.txHashes) {
      const { txHash: h, chainId: l } = n.txHashes[0], y = i?.find(
        (g) => xt(g.chainId) == l
      );
      if (y?.explorerUrl)
        return `${y.explorerUrl}/tx/${h}`;
    }
    return "";
  }, [n, i]);
  return /* @__PURE__ */ S(ye, { children: [
    /* @__PURE__ */ m("div", { className: "mb-4 flex items-center gap-2 text-foreground", children: /* @__PURE__ */ m(
      "button",
      {
        type: "button",
        onClick: () => t("home"),
        "aria-label": "Back",
        className: "text-foreground/80 hover:bg-foreground/10 rounded-full p-1",
        children: /* @__PURE__ */ m(Bt, { className: "size-4 text-foreground" })
      }
    ) }),
    /* @__PURE__ */ m(
      Fi,
      {
        recivedAmount: u,
        toChain: r,
        toToken: o,
        explorerLink: d
      }
    ),
    /* @__PURE__ */ m(
      oe,
      {
        className: "mt-auto w-full",
        size: "lg",
        onClick: () => t("home"),
        children: "Swap Again"
      }
    )
  ] });
}, ym = ({ className: e }) => {
  const t = V((y) => y.state.screen), { setFromToken: n, setToToken: r, setScreen: o } = V(), [s, i] = he(null), { tokens: u } = jt(), { data: d } = at();
  $(() => {
    if (!u) return;
    const y = V.getState().state.from.chain;
    if (y) {
      const b = u[y.key];
      !V.getState().state.from.token && b?.length > 0 && n({
        key: b[0].originDenom,
        symbol: b[0].symbol,
        logoURI: b[0].logoUri
      });
    }
    const g = V.getState().state.to.chain;
    if (g) {
      const b = u[g.key];
      !V.getState().state.to.token && b?.length > 0 && r({
        key: b[0].originDenom,
        symbol: b[0].symbol,
        logoURI: b[0].logoUri
      });
    }
  }, [u, n, r]), $(() => {
    d?._raw && Ya({
      baseApiUrl: Ka,
      chains: d?._raw.map((y) => Qa(y))
    });
  }, [d?._raw]);
  const h = (y) => {
    o(y);
  }, l = (y) => {
    i(y);
  };
  switch (t) {
    case "home":
      return /* @__PURE__ */ m(
        Jo,
        {
          className: e,
          onNavigate: h,
          onSetSelectorContext: l
        }
      );
    case "review":
      return /* @__PURE__ */ m(mm, { className: e });
    case "success":
      return /* @__PURE__ */ m(gm, { className: e });
    case "failure":
      return /* @__PURE__ */ m(um, { className: e });
    case "selector":
      return /* @__PURE__ */ m(pm, { className: e, selectorCtx: s });
    default:
      return /* @__PURE__ */ m(
        Jo,
        {
          className: e,
          onNavigate: h,
          onSetSelectorContext: l
        }
      );
  }
}, ep = (e) => {
  const t = st(), n = Ft((A) => A.setInputState), r = V((A) => A.setFromChain), o = V((A) => A.setToChain), s = V((A) => A.setFromToken), i = V((A) => A.setToToken), u = W((A) => A.setFromChain), d = W((A) => A.setToChain), h = W((A) => A.setFromToken), l = W((A) => A.setToToken), y = yr(!1);
  $(() => {
    if (y.current) return;
    y.current = !0;
    const {
      defaultSourceChain: A,
      defaultSourceToken: I,
      defaultDestinationChain: F,
      defaultDestinationToken: B,
      defaultTab: M
    } = t;
    A?.key && (r(A), u(A)), F?.key && (o(F), d(F)), I !== void 0 && (s(I), h(I)), B !== void 0 && (i(B), l(B));
    const T = M;
    T !== void 0 && n({ tab: T });
  }, [
    t,
    n,
    r,
    o,
    s,
    i,
    u,
    d,
    h,
    l
  ]);
  const { address: g } = Jt(), { wallet: b } = qt(), { setAddress: x, cosmos: v } = ct(), { data: k } = xr({
    multiChain: !0,
    onConnect: ({ accounts: A }) => {
      x({
        chain: "cosmos",
        address: A ? Object.fromEntries(
          Object.entries(A).map(
            ([I, F]) => F ? [I, F.bech32Address] : null
          ).filter((I) => I !== null)
        ) : null
      });
    },
    onDisconnect: () => {
      x({
        chain: "cosmos",
        address: null
      });
    }
  });
  return $(() => {
    k && !v && k && x({
      chain: "cosmos",
      address: k ? Object.fromEntries(
        Object.entries(k).map(
          ([A, I]) => I ? [A, I.bech32Address] : null
        ).filter((A) => A !== null)
      ) : null
    });
  }, [k, x, v]), $(() => {
    x(g ? {
      chain: "evm",
      address: g
    } : {
      chain: "evm",
      address: null
    });
  }, [g, x]), $(() => {
    b?.adapter.publicKey ? x({
      chain: "solana",
      address: b.adapter.publicKey.toBase58()
    }) : x({
      chain: "solana",
      address: null
    });
  }, [b?.adapter.publicKey, x]), /* @__PURE__ */ m(
    Ee.div,
    {
      initial: "hidden",
      animate: "visible",
      exit: "hidden",
      transition: De,
      variants: _e,
      className: se(
        "bg-background w-full my-4 relative z-0 flex h-[640px] flex-col rounded-3xl p-4 shadow-sm sm:p-8 ",
        e.className
      ),
      children: /* @__PURE__ */ m(bm, { onStatusChange: e.onStatusChange })
    },
    "bridge-view"
  );
}, bm = ({
  onStatusChange: e
}) => {
  const { inputState: t } = Ft();
  return /* @__PURE__ */ S(Xa, { children: [
    t.tab === pe.FAST && /* @__PURE__ */ m(ym, {}),
    t.tab === pe.ADVANCED && /* @__PURE__ */ m(Lc, { children: /* @__PURE__ */ m(cm, { onStatusChange: e }) })
  ] });
}, tp = ({
  children: e,
  ...t
}) => /* @__PURE__ */ m(Nc, { ...t, children: e });
export {
  Yu as A,
  N as B,
  ks as H,
  Vt as I,
  pe as T,
  ep as W,
  Fs as a,
  Hm as b,
  _f as c,
  Od as d,
  St as e,
  Xn as f,
  Us as g,
  nt as h,
  rt as i,
  Xm as j,
  Rr as k,
  nn as l,
  yn as m,
  $m as n,
  Ed as o,
  tp as p,
  _m as r,
  ar as s,
  yi as t
};
