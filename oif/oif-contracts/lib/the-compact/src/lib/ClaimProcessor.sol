// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ITheCompactClaims } from "../interfaces/ITheCompactClaims.sol";
import { ClaimProcessorLogic } from "./ClaimProcessorLogic.sol";

import { Claim } from "../types/Claims.sol";

import { BatchClaim } from "../types/BatchClaims.sol";

import { MultichainClaim, ExogenousMultichainClaim } from "../types/MultichainClaims.sol";

import { BatchMultichainClaim, ExogenousBatchMultichainClaim } from "../types/BatchMultichainClaims.sol";

/**
 * @title ClaimProcessor
 * @notice Inherited contract implementing external functions for processing claims against
 * a signed or registered compact. Each of these functions is only callable by the arbiter
 * indicated by the respective compact.
 */
contract ClaimProcessor is ITheCompactClaims, ClaimProcessorLogic {
    /// @inheritdoc ITheCompactClaims
    function claim(Claim calldata claimPayload) external returns (bytes32 claimHash) {
        return _processClaim(claimPayload);
    }

    /// @inheritdoc ITheCompactClaims
    function batchClaim(BatchClaim calldata claimPayload) external returns (bytes32 claimHash) {
        return _processBatchClaim(claimPayload);
    }

    /// @inheritdoc ITheCompactClaims
    function multichainClaim(MultichainClaim calldata claimPayload) external returns (bytes32 claimHash) {
        return _processMultichainClaim(claimPayload);
    }

    /// @inheritdoc ITheCompactClaims
    function exogenousClaim(ExogenousMultichainClaim calldata claimPayload) external returns (bytes32 claimHash) {
        return _processExogenousMultichainClaim(claimPayload);
    }

    /// @inheritdoc ITheCompactClaims
    function batchMultichainClaim(BatchMultichainClaim calldata claimPayload) external returns (bytes32 claimHash) {
        return _processBatchMultichainClaim(claimPayload);
    }

    /// @inheritdoc ITheCompactClaims
    function exogenousBatchClaim(ExogenousBatchMultichainClaim calldata claimPayload)
        external
        returns (bytes32 claimHash)
    {
        return _processExogenousBatchMultichainClaim(claimPayload);
    }
}
