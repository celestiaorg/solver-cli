import {
  PopulatedTransaction as Ethers5Transaction,
  BigNumber as EthersBN,
} from "ethers";
import { SendTransactionParameters } from "wagmi/actions";

export function ethers5TxToWagmiTx(
  tx: Ethers5Transaction,
): SendTransactionParameters {
  if (!tx.to) throw new Error("No tx recipient address specified");
  return {
    to: tx.to as `0x${string}`,
    value: ethersBnToBigInt(tx.value || EthersBN.from("0")),
    data: tx.data as `0x{string}` | undefined,
    nonce: tx.nonce,
    chainId: tx.chainId,
    gas: tx.gasLimit ? ethersBnToBigInt(tx.gasLimit) : undefined,
    gasPrice: tx.gasPrice ? ethersBnToBigInt(tx.gasPrice) : undefined,
    maxFeePerGas: tx.maxFeePerGas
      ? ethersBnToBigInt(tx.maxFeePerGas)
      : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas
      ? ethersBnToBigInt(tx.maxPriorityFeePerGas)
      : undefined,
  };
}

function ethersBnToBigInt(bn: EthersBN): bigint {
  return BigInt(bn.toString());
}
