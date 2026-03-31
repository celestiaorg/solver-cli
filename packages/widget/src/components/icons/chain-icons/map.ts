import React from "react";

import { AbstractIcon } from "./abstract";
import { ArbitrumIcon } from "./arbitrum";
import { BaseIcon } from "./base";
import { CelestiaIcon } from "./celestia";
import { EclipseIcon } from "./eclipse";
import { EthereumIcon } from "./ethereum";
import { SolanaIcon } from "./solana";

type ChainIconMap = {
  [key: string]: {
    Icon: React.FC<React.ComponentProps<"svg">>;
    className: string;
    textClassName?: string;
  };
};

export const chainIconMap: ChainIconMap = {
  1: {
    Icon: EthereumIcon,
    className: "bg-gradient-to-b from-[#F0CDC2] to-[#B8FAF6]",
    textClassName: "text-black",
  },
  8453: {
    Icon: BaseIcon,
    className: "bg-gradient-to-b from-[#1D58F1] to-[#0E47DE]",
  },
  2741: {
    Icon: AbstractIcon,
    className: "bg-gradient-to-b from-[#01A455] to-[#003E20]",
  },
  42161: {
    Icon: ArbitrumIcon,
    className: "bg-gradient-to-b from-[#152B4B] to-[#3265B1]",
  },
  1399811149: {
    Icon: SolanaIcon,
    className: "bg-gradient-to-b from-[#000508] to-[#2C1C32]",
  },
  1408864445: {
    Icon: EclipseIcon,
    className: "bg-gradient-to-b from-[#004300] to-[#1E7D1E]",
  },
  celestia: {
    Icon: CelestiaIcon,
    className: "bg-gradient-to-b from-[#7C3FDC] to-[#32027F]",
  },
};
