import type { SupportedAsset, SupportedChain } from "../lib/types";

export type SelectType = "source" | "destination";

export type SelectAssetChangeOpts = {
  type: SelectType;
  open: boolean;
  searchQuery?: string;
  asset?: SupportedAsset;
};

export type SelectAssetChangeCb = (props: SelectAssetChangeOpts) => void;

export type SelectChainChangeOpts = {
  type: SelectType;
  open: boolean;
  searchQuery?: string;
  chain?: SupportedChain;
};

export type SelectChainChangeCb = (props: SelectChainChangeOpts) => void;
