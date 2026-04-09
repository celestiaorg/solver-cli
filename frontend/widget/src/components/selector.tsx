"use client";

import { ArrowLeft, Question } from "@phosphor-icons/react";
import Fuse from "fuse.js";

import React, { useMemo } from "react";

import { useBalances } from "../hooks/use-balance";

import { AssetItem } from "../components/asset/asset-item";
import { ChainItemChip } from "../components/chain/chain-item";
import { PrevArrowIcon } from "../components/icons/arrow";
import { ZeroState } from "../components/miscellaneous";
import { SearchInput } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";

import type { ChainRef, SupportedAsset, SupportedChain } from "../lib/types";

type ChainAndTokenSelectorProps = {
  open: boolean;
  title: string;
  selectedChain?: ChainRef;
  selectedToken?: string;
  onlyChainSelection?: boolean;
  onlyTokenSelection?: boolean;
  chains?: SupportedChain[]; // networks
  tokens?: Record<string, SupportedAsset[]> | SupportedAsset[]; // tokens
  onClose: () => void;
  onSelectChain?: (item: SupportedChain) => void;
  onSelectToken?: (item: SupportedAsset) => void;
};

export const ChainAndTokenSelector: React.FC<ChainAndTokenSelectorProps> = ({
  open,
  title,
  chains,
  tokens,
  onClose,
  selectedChain,
  selectedToken,
  onSelectChain,
  onSelectToken,
  onlyChainSelection,
}) => {
  const [tokenQuery, setTokenQuery] = React.useState("");
  const [chainQuery, setChainQuery] = React.useState("");
  const filteredChains = React.useMemo(() => {
    const q = chainQuery.trim().toLowerCase();
    const list = chains || [];
    if (!q) return list;
    if (!chains) return [];
    const fusedChains = new Fuse(chains, {
      keys: ["chainId", "displayName", "name"],
      threshold: 0.2,
    });
    return fusedChains.search(q).map((r) => r.item);
  }, [chains, chainQuery]);

  const chainTokens = React.useMemo(() => {
    if (!selectedChain || onlyChainSelection) return [];
    if (!tokens) return [];
    if (Array.isArray(tokens))
      return tokens.map((t) => ({
        ...t,
        chainName: selectedChain.displayName,
      }));
    return (
      tokens[selectedChain.key].map((t) => ({
        ...t,
        chainName: selectedChain.displayName,
      })) || []
    );
  }, [selectedChain, tokens, onlyChainSelection]);

  const { data: balances, isLoading } = useBalances(
    {
      chainId: selectedChain?.key as string,
      assets: chainTokens,
    },
    !onlyChainSelection,
  );

  const sortedAssets = useMemo(() => {
    if (chainTokens?.length === 0) {
      return undefined;
    }

    if (balances) {
      return chainTokens.sort((a, b) => {
        const balanceA = balances.balances[a.originDenom]?.amount;
        const balanceB = balances.balances[b.originDenom]?.amount;

        // Sort by balance descending
        return balanceB?.isGreaterThan(balanceA ?? 0) ? 1 : -1;
      });
    }

    return chainTokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [chainTokens, balances]);

  const filteredTokens = React.useMemo(() => {
    const q = tokenQuery.trim().toLowerCase();
    const list = sortedAssets || [];
    if (!q) return list;
    const fusedTokens = new Fuse(list, {
      keys: ["symbol", "originDenom", "name"],
      threshold: 0.2,
    });
    return fusedTokens.search(q).map((r) => r.item);
  }, [sortedAssets, tokenQuery]);

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          aria-label="Back"
          onClick={onClose}
          className="text-foreground/80 hover:bg-foreground/10 rounded-full p-1.5"
        >
          <ArrowLeft className="size-4 text-foreground" />
        </button>
        <div className="text-base font-semibold">{title}</div>
      </div>
      <div className="flex h-[554px] flex-col">
        {chains && (
          <div className="flex-shrink-0">
            <SearchInput
              className="bg-secondary mb-3 ring-0 text-foreground"
              value={chainQuery}
              onChange={(e) => setChainQuery(e.target.value)}
              placeholder="Search by chain name"
              disabled={filteredChains === undefined || !chainTokens}
            />
            {filteredChains.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredChains?.map((item) => (
                  <ChainItemChip
                    key={item.chainId}
                    chain={item}
                    onSelect={() => onSelectChain?.(item)}
                    isSelected={item.chainId === selectedChain?.key}
                  />
                ))}
              </div>
            ) : (
              <ZeroState
                icon={<Question size={32} className="text-foreground" />}
                message={`No chains found for '${chainQuery}'`}
                subtext="Try searching for a different term"
              />
            )}
          </div>
        )}
        {!onlyChainSelection && (
          <>
            <div className="my-5 flex flex-shrink-0 justify-center">
              <Separator className="rounded-md2 max-w-5 border-1 border-white" />
            </div>

            {tokens && (
              <div className="flex min-h-0 flex-1 flex-col">
                <SearchInput
                  className="bg-secondary mb-3 flex-shrink-0 ring-0 text-foreground"
                  value={tokenQuery}
                  onChange={(e) => setTokenQuery(e.target.value)}
                  placeholder="Search by token name"
                  disabled={filteredTokens === undefined || !chainTokens}
                />
                <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="bg-secondary/40 rounded-md2 flex h-auto w-full items-center justify-start gap-3 px-3 py-2"
                      >
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex w-full items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                          <Skeleton className="h-4 w-10" />
                        </div>
                      </div>
                    ))
                  ) : filteredTokens?.length > 0 ? (
                    filteredTokens?.map((item) => (
                      <AssetItem
                        key={item.originDenom}
                        asset={item}
                        onSelect={() => onSelectToken?.(item)}
                        isSelected={item.originDenom === selectedToken}
                        balanceInfo={balances?.balances[item.originDenom]}
                      />
                    ))
                  ) : (
                    <ZeroState
                      icon={<Question size={32} className="text-foreground" />}
                      message={`No assets found for '${tokenQuery}'`}
                      subtext="Try searching for a different term"
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default ChainAndTokenSelector;
