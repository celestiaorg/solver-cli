// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseInputOracle} from "./BaseInputOracle.sol";
import {ECDSA} from "openzeppelin/utils/cryptography/ECDSA.sol";
import {
    MessageHashUtils
} from "openzeppelin/utils/cryptography/MessageHashUtils.sol";

contract CentralizedOracle is BaseInputOracle {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    error UnauthorizedSigner();
    error ZeroAddress();

    address public operator;

    /**
     * @notice Initializes the centralized oracle with the authorized attestation signer.
     * @param _operator Address allowed to sign attestations accepted by this oracle.
     * @dev Reverts with `ZeroAddress` if `_operator` is the zero address.
     */
    constructor(address _operator) {
        if (_operator == address(0)) revert ZeroAddress();
        operator = _operator;
    }

    /**
     * @notice Verifies and stores an attestation proving an output fill.
     * @param signature EIP-191 (`personal_sign`) signature over
     * `keccak256(abi.encodePacked(remoteChainId, remoteOracle, application, dataHash))`.
     * @param remoteChainId Chain ID where the proved output fill occurred.
     * @param remoteOracle Oracle identifier on the remote chain (bytes32-encoded address/ID).
     * @param application Application identifier, typically the output settler identifier.
     * @param dataHash Hash of the fill payload being attested.
     * @dev Recovers the signer from `signature` and requires it to match `operator`.
     * Stores the attestation in `_attestations` and emits `OutputProven` on success.
     * Reverts with `UnauthorizedSigner` if signature verification fails.
     */
    function submitAttestation(
        bytes calldata signature,
        uint256 remoteChainId,
        bytes32 remoteOracle,
        bytes32 application,
        bytes32 dataHash
    ) external {
        // Reconstruct the message that was signed
        bytes32 messageHash = keccak256(
            abi.encodePacked(remoteChainId, remoteOracle, application, dataHash)
        );

        // Apply EIP-191 prefix for personal_sign
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();

        // Recover signer and verify it's the operator
        address signer = ethSignedHash.recover(signature);
        if (signer != operator) revert UnauthorizedSigner();

        // Store attestation
        _attestations[remoteChainId][remoteOracle][application][
            dataHash
        ] = true;

        emit OutputProven(remoteChainId, remoteOracle, application, dataHash);
    }
}
