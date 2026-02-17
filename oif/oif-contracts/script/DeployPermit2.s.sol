// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import "../../lib/permit2/src/Permit2.sol";

contract DeployPermit2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Permit2
        Permit2 permit2 = new Permit2();
        console.log("Permit2 deployed at:", address(permit2));

        vm.stopBroadcast();
    }
}
