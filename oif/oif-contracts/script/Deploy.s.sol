// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script, console2 } from "forge-std/Script.sol";

import { InputSettlerEscrow } from "../src/input/escrow/InputSettlerEscrow.sol";
import { OutputSettlerSimple } from "../src/output/simple/OutputSettlerSimple.sol";
import { CentralizedOracle } from "../src/oracles/CentralizedOracle.sol";
import { MockERC20 } from "../test/mocks/MockERC20.sol";
import "../../lib/permit2/src/Permit2.sol";

/**
 * @title OIF Deploy Script
 * @notice Deploys the core OIF contracts for E2E testing
 * @dev Run with: forge script script/Deploy.s.sol:Deploy --rpc-url $RPC --broadcast
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // Use consistent operator across all chains
        address operator = vm.envOr("OPERATOR_ADDRESS", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy CentralizedOracle with operator
        CentralizedOracle oracle = new CentralizedOracle(operator);
        console2.log("CentralizedOracle:", address(oracle));
        console2.log("Operator:", operator);

        // Deploy InputSettlerEscrow
        InputSettlerEscrow inputSettler = new InputSettlerEscrow();
        console2.log("InputSettlerEscrow:", address(inputSettler));

        // Deploy OutputSettlerSimple
        OutputSettlerSimple outputSettler = new OutputSettlerSimple();
        console2.log("OutputSettlerSimple:", address(outputSettler));

        vm.stopBroadcast();

        // Output as JSON for easy parsing
        console2.log("\n--- JSON OUTPUT ---");
        console2.log("{");
        console2.log("  \"oracle\": \"%s\",", address(oracle));
        console2.log("  \"operator\": \"%s\",", operator);
        console2.log("  \"inputSettler\": \"%s\",", address(inputSettler));
        console2.log("  \"outputSettler\": \"%s\"", address(outputSettler));
        console2.log("}");
    }
}

/**
 * @title DeployToken Script
 * @notice Deploys a MockERC20 token for testing
 * @dev Run with: forge script script/Deploy.s.sol:DeployToken --rpc-url $RPC --broadcast
 */
contract DeployToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory name = vm.envOr("TOKEN_NAME", string("Mock ETH"));
        string memory symbol = vm.envOr("TOKEN_SYMBOL", string("ETH"));
        uint8 decimals = uint8(vm.envOr("TOKEN_DECIMALS", uint256(6)));

        vm.startBroadcast(deployerPrivateKey);

        MockERC20 token = new MockERC20(name, symbol, decimals);
        console2.log("MockERC20 (%s):", symbol, address(token));

        vm.stopBroadcast();

        console2.log("\n--- JSON OUTPUT ---");
        console2.log("{");
        console2.log("  \"token\": \"%s\",", address(token));
        console2.log("  \"name\": \"%s\",", name);
        console2.log("  \"symbol\": \"%s\",", symbol);
        console2.log("  \"decimals\": %d", decimals);
        console2.log("}");
    }
}

/**
 * @title DeployAll Script
 * @notice Deploys all contracts including token in one go
 */
contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory tokenName = vm.envOr("TOKEN_NAME", string("Mock ETH"));
        string memory tokenSymbol = vm.envOr("TOKEN_SYMBOL", string("ETH"));
        uint8 tokenDecimals = uint8(vm.envOr("TOKEN_DECIMALS", uint256(6)));
        // Use consistent operator across all chains
        address operator = vm.envOr("OPERATOR_ADDRESS", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy CentralizedOracle with operator
        CentralizedOracle oracle = new CentralizedOracle(operator);
        console2.log("CentralizedOracle:", address(oracle));
        console2.log("Operator:", operator);

        // Deploy settlers
        InputSettlerEscrow inputSettler = new InputSettlerEscrow();
        console2.log("InputSettlerEscrow:", address(inputSettler));

        OutputSettlerSimple outputSettler = new OutputSettlerSimple();
        console2.log("OutputSettlerSimple:", address(outputSettler));

        // Deploy token
        MockERC20 token = new MockERC20(tokenName, tokenSymbol, tokenDecimals);
        console2.log("MockERC20 (%s):", tokenSymbol, address(token));

        // Deploy Permit2
        Permit2 permit2 = new Permit2();
        console2.log("Permit2:", address(permit2));

        vm.stopBroadcast();

        // Output as JSON
        console2.log("\n--- JSON OUTPUT ---");
        console2.log("{");
        console2.log("  \"oracle\": \"%s\",", address(oracle));
        console2.log("  \"operator\": \"%s\",", operator);
        console2.log("  \"inputSettler\": \"%s\",", address(inputSettler));
        console2.log("  \"outputSettler\": \"%s\",", address(outputSettler));
        console2.log("  \"permit2\": \"%s\",", address(permit2));
        console2.log("  \"token\": \"%s\",", address(token));
        console2.log("  \"tokenName\": \"%s\",", tokenName);
        console2.log("  \"tokenSymbol\": \"%s\",", tokenSymbol);
        console2.log("  \"tokenDecimals\": %d", tokenDecimals);
        console2.log("}");
    }
}
