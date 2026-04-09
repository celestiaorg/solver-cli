export type WalletEcosystem = "all" | "cosmos" | "evm" | "solana";

export const ecosystemLogo = {
  all: "/ecosystems/All.png",
  cosmos: "/ecosystems/Cosmos.png",
  evm: "/ecosystems/EVM.png",
  solana: "/ecosystems/Solana.png",
};

/**
 * @description Ecosystems supported for Leap Exclusives/Rewards
 */
export const AvailableChadEcosystems: {
  ecosystem: WalletEcosystem;
  name: string;
  icon: string;
  iconClassName?: string;
  connected: boolean;
  isEligible: boolean;
}[] = [
  {
    ecosystem: "cosmos",
    name: "Cosmos",
    icon: ecosystemLogo.cosmos,
    iconClassName: "rounded-full",
    connected: false,
    isEligible: false,
  },
  {
    ecosystem: "evm",
    name: "EVM",
    icon: ecosystemLogo.evm,
    connected: false,
    isEligible: false,
  },
];
