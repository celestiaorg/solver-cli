// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IAllocator } from "../../interfaces/IAllocator.sol";
import { SignatureCheckerLib } from "solady/utils/SignatureCheckerLib.sol";
import { EfficiencyLib } from "../../lib/EfficiencyLib.sol";

/**
 * @notice Interface for retrieving EIP-712 domain separator from a contract.
 */
interface EIP712 {
    /**
     * @notice Retrieves the EIP-712 domain separator for the contract.
     * @return The domain separator as a bytes32 value.
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/**
 * @notice Struct representing an attestation for a token transfer.
 * @dev Used as part of the EIP-712 signature verification process.
 */
struct Attestation {
    address operator; // The address performing the transfer.
    address from; // The address tokens are being transferred from.
    address to; // The address tokens are being transferred to.
    uint256 id; // The ERC6909 token identifier being transferred.
    uint256 amount; // The amount of tokens being transferred.
}

/**
 * @notice Struct representing an attestation authorization with replay protection.
 * @dev Combines an attestation with nonce, expiration, and salt for signature verification.
 */
struct AttestationAuthorization {
    Attestation attestation; // The underlying attestation data.
    uint256 nonce; // A nonce to prevent replay attacks.
    uint256 expires; // The timestamp at which the authorization expires.
    uint256 salt; // Additional entropy for uniqueness.
}

/**
 * @title AttestableAllocator
 * @notice Allocator implementation contract for use with The Compact that supports off-chain
 * attestations for both claims and direct ERC6909 transfers. Implements the IAllocator interface
 * and uses EIP-712 signatures to authorize operations. Transfer attestations are temporarily stored
 * in transient storage and consumed during subsequent operations.
 */
contract AttestableAllocator is IAllocator {
    using SignatureCheckerLib for address;
    using EfficiencyLib for bool;

    /// @notice The address tasked with signing transfer attestations and claim authorizations.
    address private _attester;

    /// @dev The address of the current owner of the contract.
    address private _owner;

    /// @dev The address of the pending owner awaiting acceptance of ownership transfer.
    address private _pendingOwner;

    /// @dev The address of The Compact V1 contract.
    address private constant THE_COMPACT = address(0x00000000000000171ede64904551eeDF3C6C9788);

    /// @dev `keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")`.
    bytes32 private constant _DOMAIN_TYPEHASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;

    /// @dev `keccak256(bytes("AttestableAllocator"))`.
    bytes32 private constant _NAME_HASH = 0x006c5bd3d81d59beca36348c4ab4286f42f2f5a7ecbdc57baac2471b9092937b;

    /// @dev `keccak256("1")`.
    bytes32 private constant _VERSION_HASH = 0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;

    /// @dev `keccak256("Attestation(address operator,address from,address to,uint256 id,uint256 amount)")`.
    bytes32 private constant _ATTESTATION_TYPEHASH = 0x84a5005a0081c3836926ed057fabffe423f917ae839c7a706683e4f8288b51ce;

    /// @dev `keccak256("AttestationAuthorization(Attestation attestation,uint256 nonce,uint256 expires,uint256 salt)Attestation(address operator,address from,address to,uint256 id,uint256 amount)")`.
    bytes32 private constant _ATTESTATION_AUTHORIZATION_TYPEHASH =
        0xd8d4e27b25502b20afe92a091411a0da3c85797f5170f29816b820b8dc2b6f43;

    /// @dev Base slot for transient attestation storage. `keccak256("_ATTESTATION_SLOT")) - 1`.
    uint256 private constant _ATTESTATION_SLOT = 0x0247899d9210c97d4cb118062dcff5aa82785ec3368793bbe21b5bbd7088da6e;

    /// @dev Storage scope identifier for nonce buckets.
    uint256 private constant _NONCE_SCOPE = 0x84435b2c;

    /// @dev The initial domain separator for this contract, cached at deployment.
    bytes32 private immutable _INITIAL_ATTESTABLE_ALLOCATOR_DOMAIN_SEPARATOR;

    /// @dev The initial domain separator for The Compact contract, cached at deployment.
    bytes32 private immutable _INITIAL_COMPACT_DOMAIN_SEPARATOR;

    /// @dev The chain ID at deployment time, used to detect chain forks.
    uint256 private immutable _INITIAL_CHAIN_ID;

    /**
     * @notice Emitted when ownership transfer is initiated.
     * @param previousOwner The current owner initiating the transfer.
     * @param newOwner      The address of the pending new owner.
     */
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    /**
     * @notice Emitted when ownership transfer is completed.
     * @param previousOwner The previous owner of the contract.
     * @param newOwner      The new owner of the contract.
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @notice Emitted when the attester address is updated.
     * @param previousAttester The previous attester address.
     * @param newAttester      The new attester address.
     */
    event AttesterUpdated(address indexed previousAttester, address indexed newAttester);

    /// @notice Thrown when a claim is not properly authorized.
    error ClaimUnauthorized();

    /// @notice Thrown when an attestation is invalid or has not been authorized.
    error InvalidAttestation();

    /// @notice Thrown when an attestation authorization has expired.
    error AttestationExpired();

    /**
     * @notice Thrown when attempting to use a nonce that has already been consumed.
     * @param nonce The nonce that was already consumed.
     */
    error InvalidNonce(uint256 nonce);

    /**
     * @notice Thrown when an unauthorized account attempts an owner-only action.
     * @param account The account that attempted the unauthorized action.
     */
    error InvalidOwner(address account);

    /**
     * @notice Thrown when attempting to initialize with a zero address as owner.
     */
    error MissingOwner();

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        if (_owner != msg.sender) {
            revert InvalidOwner(msg.sender);
        }

        _;
    }

    /**
     * @notice Constructs the AttestableAllocator contract.
     * @param initialOwner    The address to be set as the initial owner of the contract.
     * @param initialAttester The address initially authorized to sign attestations and claim authorizations.
     * @dev Caches domain separators and chain ID for efficient EIP-712 signature verification.
     */
    constructor(address initialOwner, address initialAttester) {
        if (initialOwner == address(0)) {
            revert MissingOwner();
        }
        _transferOwnership(initialOwner);
        _updateAttester(initialAttester);

        _INITIAL_COMPACT_DOMAIN_SEPARATOR = EIP712(THE_COMPACT).DOMAIN_SEPARATOR();
        _INITIAL_CHAIN_ID = block.chainid;

        bytes32 domainSeparator;
        assembly ("memory-safe") {
            // Retrieve the free memory pointer.
            let m := mload(0x40)

            // Prepare domain data: EIP-712 typehash, name hash, version hash, chain ID, & verifying contract.
            mstore(m, _DOMAIN_TYPEHASH)
            mstore(add(m, 0x20), _NAME_HASH)
            mstore(add(m, 0x40), _VERSION_HASH)
            mstore(add(m, 0x60), chainid())
            mstore(add(m, 0x80), address())

            // Derive the domain separator.
            domainSeparator := keccak256(m, 0xa0)
        }

        _INITIAL_ATTESTABLE_ALLOCATOR_DOMAIN_SEPARATOR = domainSeparator;
    }

    /**
     * @notice Authorizes an attestation for a subsequent ERC6909 transfer. The attestation is
     * stored in transient storage and consumed when the corresponding attest function is called.
     * @param attestationHash           The EIP-712 hash of the attestation data.
     * @param nonce                     A nonce to prevent replay attacks.
     * @param expires                   The timestamp at which the authorization expires.
     * @param salt                      Additional entropy for uniqueness.
     * @param attestationAuthorization  The signature authorizing the attestation.
     * @return authorized               Always returns true if the authorization is successful.
     * @dev Reverts if the authorization has expired, the nonce has already been consumed, or
     * the attestation authorization is invalid.
     */
    function authorizeAttestation(
        bytes32 attestationHash,
        uint256 nonce,
        uint256 expires,
        uint256 salt,
        bytes memory attestationAuthorization
    ) external returns (bool authorized) {
        if (expires <= block.timestamp) {
            revert AttestationExpired();
        }

        _consumeNonce(nonce);

        _attester.isValidSignatureNow(
            _withDomain(
                keccak256(abi.encode(_ATTESTATION_AUTHORIZATION_TYPEHASH, attestationHash, nonce, expires, salt)),
                _toLatestDomainSeparator()
            ),
            attestationAuthorization
        );

        _setAttestation(attestationHash);

        authorized = true;
    }

    /**
     * @notice Called on standard transfers to validate the transfer. Consumes a previously
     * authorized attestation from transient storage.
     * @param operator The address performing the transfer.
     * @param from     The address tokens are being transferred from.
     * @param to       The address tokens are being transferred to.
     * @param id       The ERC6909 token identifier being transferred.
     * @param amount   The amount of tokens being transferred.
     * @return         Must return this function selector (0x1a808f91).
     * @dev Reverts if the attestation was not previously authorized or has already been consumed, or if not called by The Compact.
     */
    function attest(address operator, address from, address to, uint256 id, uint256 amount) external returns (bytes4) {
        _consumeAttestation(keccak256(abi.encode(_ATTESTATION_TYPEHASH, operator, from, to, id, amount)));

        if (msg.sender == THE_COMPACT) {
            return this.attest.selector;
        }

        revert InvalidAttestation();
    }

    /**
     * @notice Initiates ownership transfer to a new owner. Requires acceptance from the new owner.
     * @param newOwner The address of the proposed new owner.
     * @dev Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(_owner, newOwner);
    }

    /**
     * @notice Accepts ownership transfer. Must be called by the pending owner.
     * @dev Completes the two-step ownership transfer process.
     */
    function acceptOwnership() external {
        if (_pendingOwner != msg.sender) {
            revert InvalidOwner(msg.sender);
        }

        _transferOwnership(msg.sender);
    }

    /**
     * @notice Updates the attester address.
     * @param newAttester The address of the new attester.
     * @dev Can only be called by the current owner.
     */
    function updateAttester(address newAttester) external onlyOwner {
        _updateAttester(newAttester);
    }

    /**
     * @notice External view function for retrieving the current owner address.
     * @return The address of the current owner.
     */
    function owner() external view returns (address) {
        return _owner;
    }

    /**
     * @notice External view function for retrieving the current attester address.
     * @return The address of the current attester.
     */
    function attester() external view returns (address) {
        return _attester;
    }

    /**
     * @notice External view function for retrieving the pending owner address.
     * @return The address of the pending owner awaiting acceptance.
     */
    function pendingOwner() external view returns (address) {
        return _pendingOwner;
    }

    /**
     * @notice Authorize a claim. Called from The Compact as part of claim processing.
     * @param claimHash      The message hash representing the claim.
     * -param arbiter        The account tasked with verifying and submitting the claim.
     * -param sponsor        The account to source the tokens from.
     * -param nonce          A parameter to enforce replay protection, scoped to allocator.
     * -param expires        The time at which the claim expires.
     * -param idsAndAmounts  The allocated token IDs and amounts.
     * @param allocatorData  Arbitrary data provided by the arbiter (signature in this case).
     * @return               Must return the function selector (0x7bb023f7).
     * @dev Verifies that the claim hash is signed by the authorized signer.
     */
    function authorizeClaim(
        bytes32 claimHash, // The message hash representing the claim.
        address, // arbiter
        address, // sponsor
        uint256, //  nonce
        uint256, // expires
        uint256[2][] calldata, // idsAndAmounts
        bytes calldata allocatorData // Arbitrary data provided by the arbiter.
    ) external view returns (bytes4) {
        if ((msg.sender == THE_COMPACT).and(_isClaimAuthorized(claimHash, allocatorData))) {
            return this.authorizeClaim.selector;
        }

        revert ClaimUnauthorized();
    }

    /**
     * @notice Check if given allocatorData authorizes a claim. Intended to be called offchain.
     * @param claimHash      The message hash representing the claim.
     * -param arbiter        The account tasked with verifying and submitting the claim.
     * -param sponsor        The account to source the tokens from.
     * -param nonce          A parameter to enforce replay protection, scoped to allocator.
     * -param expires        The time at which the claim expires.
     * -param idsAndAmounts  The allocated token IDs and amounts.
     * @param allocatorData  Arbitrary data provided by the arbiter (signature in this case).
     * @return               A boolean indicating whether the claim is authorized.
     * @dev Verifies that the claim hash is signed by the authorized signer.
     */
    function isClaimAuthorized(
        bytes32 claimHash, // The message hash representing the claim.
        address, // arbiter
        address, // sponsor
        uint256, //  nonce
        uint256, // expires
        uint256[2][] calldata, // idsAndAmounts
        bytes calldata allocatorData // Arbitrary data provided by the arbiter.
    ) external view returns (bool) {
        return _isClaimAuthorized(claimHash, allocatorData);
    }

    /**
     * @notice Checks if an attestation has been authorized and is available for consumption.
     * @param attestationHash The EIP-712 hash of the attestation to check.
     * @return attestable     Whether the attestation is currently authorized.
     * @dev Reads from transient storage to check if the attestation was previously authorized.
     */
    function isAttestable(bytes32 attestationHash) external view returns (bool attestable) {
        bytes32 slot = _attestationSlot(attestationHash);
        assembly {
            attestable := tload(slot)
        }
    }

    /**
     * @notice Internal view function for checking if a nonce has been consumed in the
     * allocator's scope.
     * @param nonceToCheck The nonce to check.
     * @return consumed    Whether the nonce has been consumed.
     */
    function isConsumed(uint256 nonceToCheck) external view returns (bool consumed) {
        return _isConsumedBy(nonceToCheck);
    }

    /**
     * @notice Internal function to mark an attestation as authorized in transient storage.
     * @param key The attestation hash to authorize.
     * @dev Stores a value of 1 in the derived transient storage slot.
     */
    function _setAttestation(bytes32 key) internal {
        bytes32 slot = _attestationSlot(key);
        assembly {
            tstore(slot, 1)
        }
    }

    /**
     * @notice Internal function to consume a previously authorized attestation from transient storage.
     * @param key The attestation hash to consume.
     * @dev Reverts if the attestation was not previously authorized. Clears the attestation after consumption.
     */
    function _consumeAttestation(bytes32 key) internal {
        bytes32 slot = _attestationSlot(key);
        bool value;
        assembly {
            value := tload(slot)
        }

        if (!value) {
            revert InvalidAttestation();
        }

        assembly {
            tstore(slot, 0)
        }
    }

    /**
     * @notice Internal function to complete ownership transfer.
     * @param newOwner The address to transfer ownership to.
     * @dev Clears the pending owner and emits the OwnershipTransferred event.
     */
    function _transferOwnership(address newOwner) internal {
        delete _pendingOwner;
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @notice Internal function to update the attester address.
     * @param newAttester The address of the new attester.
     * @dev Emits the AttesterUpdated event with previous and new attester addresses.
     */
    function _updateAttester(address newAttester) internal {
        address oldAttester = _attester;
        _attester = newAttester;
        emit AttesterUpdated(oldAttester, newAttester);
    }

    /**
     * @notice Internal function implementing nonce consumption logic. Uses the last byte
     * of the nonce to determine which bit to set in a 256-bit storage bucket unique to
     * the account and scope. Reverts if the nonce has already been consumed.
     * @param nonce   The nonce to consume.
     */
    function _consumeNonce(uint256 nonce) internal {
        uint256 scope = _NONCE_SCOPE;

        // The last byte of the nonce is used to assign a bit in a 256-bit bucket;
        // specific nonces are consumed for each account and can only be used once.
        // NOTE: this function temporarily overwrites the free memory pointer, but
        // restores it before returning.
        assembly ("memory-safe") {
            // Store free memory pointer; its memory location will be overwritten.
            let freeMemoryPointer := mload(0x40)

            // derive the nonce bucket slot:
            // keccak256(_NONCE_SCOPE ++ nonce[0:31])
            mstore(0x0c, scope)
            mstore(0x20, nonce)
            let bucketSlot := keccak256(0x28, 0x17)

            // Retrieve nonce bucket and check if nonce has been consumed.
            let bucketValue := sload(bucketSlot)
            let bit := shl(and(0xff, nonce), 1)
            if and(bit, bucketValue) {
                // `InvalidNonce(uint256)`.
                mstore(0x0c, shl(96, 0xdbc205b1))
                revert(0x1c, 0x24)
            }

            // Invalidate the nonce by setting its bit.
            sstore(bucketSlot, or(bucketValue, bit))

            // Restore the free memory pointer.
            mstore(0x40, freeMemoryPointer)
        }
    }

    /**
     * @notice Internal view function implementing nonce consumption checking logic.
     * Uses the last byte of the nonce to determine which bit to check in a 256-bit
     * storage bucket unique to the account and scope.
     * @param nonceToCheck The nonce to check.
     * @return consumed    Whether the nonce has been consumed.
     */
    function _isConsumedBy(uint256 nonceToCheck) private view returns (bool consumed) {
        uint256 scope = _NONCE_SCOPE;
        assembly ("memory-safe") {
            // Store free memory pointer; its memory location will be overwritten.
            let freeMemoryPointer := mload(0x40)

            // derive the nonce bucket slot:
            // keccak256(_ALLOCATOR_NONCE_SCOPE ++ nonce[0:31])
            mstore(0x0c, scope)
            mstore(0x20, nonceToCheck)

            // Load the nonce bucket and check whether the target nonce bit is set.
            // 1. `sload(keccak256(0x28, 0x17))`      – load the 256-bit bucket.
            // 2. `and(0xff, nonceToCheck)`           – isolate the least-significant byte (bit index 0-255).
            // 3. `shl(index, 1)`                     – build a mask (1 << index).
            // 4. `and(mask, bucket)`                 – leave only the target bit.
            // 5. `gt(result, 0)`                     – cast to a clean boolean (avoids dirty bits).
            consumed := gt(and(shl(and(0xff, nonceToCheck), 1), sload(keccak256(0x28, 0x17))), 0)

            // Restore the free memory pointer.
            mstore(0x40, freeMemoryPointer)
        }
    }

    /**
     * @notice Internal view function to check if a claim is authorized by verifying the signature.
     * @param claimHash      The message hash representing the claim.
     * @param allocatorData  The signature data to verify.
     * @return               Whether the claim is authorized by a valid signature.
     * @dev Uses The Compact's domain separator for EIP-712 signature verification.
     */
    function _isClaimAuthorized(
        bytes32 claimHash, // The message hash representing the claim.
        bytes calldata allocatorData // Arbitrary data provided by the arbiter.
    )
        internal
        view
        returns (bool)
    {
        return _attester.isValidSignatureNow(_withDomain(claimHash, _getCompactDomainSeparator()), allocatorData);
    }

    /**
     * @notice Internal view function to retrieve The Compact's domain separator.
     * @return The current domain separator for The Compact contract.
     * @dev Uses cached value if on the same chain as deployment, otherwise queries the contract.
     */
    function _getCompactDomainSeparator() private view returns (bytes32) {
        if (_INITIAL_CHAIN_ID == block.chainid) {
            return _INITIAL_COMPACT_DOMAIN_SEPARATOR;
        }

        return EIP712(THE_COMPACT).DOMAIN_SEPARATOR();
    }

    /**
     * @notice Internal view function that returns the current domain separator, deriving a new one
     * if the chain ID has changed from the initial chain ID.
     * @return domainSeparator       The current domain separator.
     */
    function _toLatestDomainSeparator() internal view returns (bytes32 domainSeparator) {
        // Set the initial domain separator as the default domain separator.
        domainSeparator = _INITIAL_ATTESTABLE_ALLOCATOR_DOMAIN_SEPARATOR;
        uint256 initialChainId = _INITIAL_CHAIN_ID;

        assembly ("memory-safe") {
            // Derive domain separator again if initial chain ID differs from current one.
            if xor(chainid(), initialChainId) {
                // Retrieve the free memory pointer.
                let m := mload(0x40)

                // Prepare domain data: EIP-712 typehash, name hash, version hash, chain ID, & verifying contract.
                mstore(m, _DOMAIN_TYPEHASH)
                mstore(add(m, 0x20), _NAME_HASH)
                mstore(add(m, 0x40), _VERSION_HASH)
                mstore(add(m, 0x60), chainid())
                mstore(add(m, 0x80), address())

                // Derive the domain separator.
                domainSeparator := keccak256(m, 0xa0)
            }
        }
    }

    /**
     * @notice Internal pure function that combines a message hash with a domain separator
     * to create a domain-specific hash according to EIP-712.
     * @param messageHash     The EIP-712 hash of the message data.
     * @param domainSeparator The domain separator to combine with the message hash.
     * @return domainHash     The domain-specific hash.
     */
    function _withDomain(bytes32 messageHash, bytes32 domainSeparator) internal pure returns (bytes32 domainHash) {
        assembly ("memory-safe") {
            // Retrieve and cache the free memory pointer.
            let m := mload(0x40)

            // Prepare the 712 prefix.
            mstore(0, 0x1901)

            // Prepare the domain separator.
            mstore(0x20, domainSeparator)

            // Prepare the message hash and compute the domain hash.
            mstore(0x40, messageHash)
            domainHash := keccak256(0x1e, 0x42)

            // Restore the free memory pointer.
            mstore(0x40, m)
        }
    }

    /**
     * @notice Internal pure function to derive the transient storage slot for an attestation.
     * @param key   The attestation hash.
     * @return slot The derived storage slot.
     * @dev Combines the attestation hash with the base attestation slot to create a unique slot.
     */
    function _attestationSlot(bytes32 key) internal pure returns (bytes32 slot) {
        assembly {
            mstore(0x00, key)
            mstore(0x20, _ATTESTATION_SLOT)
            slot := keccak256(0x00, 0x40)
        }
    }
}
