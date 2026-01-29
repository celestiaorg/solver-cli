// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/interfaces/IInputSettlerEscrow.sol";
import "../src/input/types/StandardOrderType.sol";
import "../src/input/types/MandateOutputType.sol";

contract SubmitOrder is Script {
    function run() external {
        // Read environment variables
        address inputSettler = vm.envAddress("INPUT_SETTLER");
        address user = vm.envAddress("USER_ADDRESS");
        address inputToken = vm.envAddress("INPUT_TOKEN");
        address inputOracle = vm.envAddress("INPUT_ORACLE");
        uint256 amount = vm.envUint("AMOUNT");
        uint256 nonce = vm.envUint("NONCE");
        uint32 expires = uint32(vm.envUint("EXPIRES"));
        uint32 fillDeadline = uint32(vm.envUint("FILL_DEADLINE"));

        // Output chain params
        uint256 destChainId = vm.envUint("DEST_CHAIN_ID");
        bytes32 outputOracle = vm.envBytes32("OUTPUT_ORACLE");
        bytes32 outputSettler = vm.envBytes32("OUTPUT_SETTLER");
        bytes32 outputToken = vm.envBytes32("OUTPUT_TOKEN");
        bytes32 recipient = vm.envBytes32("RECIPIENT");

        // Build inputs
        uint256[2][] memory inputs = new uint256[2][](1);
        inputs[0] = [uint256(uint160(inputToken)), amount];

        // Build outputs
        MandateOutput[] memory outputs = new MandateOutput[](1);
        outputs[0] = MandateOutput({
            oracle: outputOracle,
            settler: outputSettler,
            chainId: destChainId,
            token: outputToken,
            amount: amount,  // Same amount (1:1)
            recipient: recipient,
            callbackData: "",
            context: ""
        });

        // Build order
        StandardOrder memory order = StandardOrder({
            user: user,
            nonce: nonce,
            originChainId: block.chainid,
            expires: expires,
            fillDeadline: fillDeadline,
            inputOracle: inputOracle,
            inputs: inputs,
            outputs: outputs
        });

        // Submit
        vm.startBroadcast();
        IInputSettlerEscrow(inputSettler).open(order);
        vm.stopBroadcast();

        console.log("Order submitted successfully!");
        console.log("Order ID:", vm.toString(IInputSettlerEscrow(inputSettler).orderIdentifier(order)));
    }
}
