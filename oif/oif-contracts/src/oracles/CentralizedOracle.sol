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

    constructor(address _operator) {
        if (_operator == address(0)) revert ZeroAddress();
        operator = _operator;
    }

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
