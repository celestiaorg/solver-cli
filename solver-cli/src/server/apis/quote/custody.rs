//! Custody decision engine for cross-chain token transfers.
//!
//! This module implements the logic for determining how tokens should be secured
//! during cross-chain transfers. It analyzes token capabilities, user preferences,
//! and protocol availability to select the optimal custody mechanism for each quote.
//!
//! ## Overview
//!
//! The custody module makes intelligent decisions about:
//! - Whether to use resource locks (pre-authorized funds) or escrow mechanisms
//! - Which specific protocol to use (Permit2, EIP-3009, TheCompact, etc.)
//! - How to optimize for gas costs, security, and user experience
//!
//! ## Custody Mechanisms
//!
//! ### Resource Locks
//! Pre-authorized fund allocations that don't require token movement:
//! - **TheCompact**: Advanced resource locking with allocation proofs
//! - **Custom Locks**: Protocol-specific locking mechanisms
//!
//! ### Escrow Mechanisms
//! Traditional token custody through smart contracts:
//! - **Permit2**: Universal approval system with signature-based transfers
//! - **EIP-3009**: Native gasless transfers for supported tokens (USDC, etc.)
//!
//! ## Decision Process
//!
//! 1. **Check for existing locks**: If user has pre-authorized funds, prefer using them
//! 2. **Analyze token capabilities**: Determine which protocols the token supports
//! 3. **Evaluate chain support**: Ensure the protocol is available on the source chain
//! 4. **Optimize selection**: Choose based on gas costs, security, and UX preferences
//!
//! ## Token Analysis
//!
//! The module maintains knowledge about token capabilities:
//! - EIP-3009 support (primarily USDC and similar tokens)
//! - Permit2 availability (universal but requires deployment)
//! - Custom protocol support (token-specific features)

use std::sync::Arc;

use alloy_primitives::{Address, U256};
use solver_delivery::DeliveryService;
use solver_types::standards::eip7683::LockType;
use solver_types::{AssetLockReference, LockKind, OrderInput, QuoteError, Transaction};

/// Detects EIP-3009 support by checking for RECEIVE_WITH_AUTHORIZATION_TYPEHASH on-chain.
async fn detect_eip3009_via_rpc(
    chain_id: u64,
    token_address: Address,
    delivery_service: Arc<DeliveryService>,
) -> Result<bool, Box<dyn std::error::Error>> {
    // selector for RECEIVE_WITH_AUTHORIZATION_TYPEHASH() view function: 0x7f2eecc3
    let call_data = hex::decode("7f2eecc3")?;
    let tx = Transaction {
        to: Some(solver_types::Address(token_address.to_vec())),
        data: call_data,
        value: U256::ZERO,
        gas_limit: None,
        gas_price: None,
        max_fee_per_gas: None,
        max_priority_fee_per_gas: None,
        nonce: None,
        chain_id,
    };
    match delivery_service.contract_call(chain_id, tx).await {
        Ok(result) => {
            let expected = hex::decode(
                "d099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8",
            )?;
            Ok(result.len() == 32 && result[..] == expected[..])
        }
        Err(_) => Ok(false),
    }
}

/// Custody strategy decision
#[derive(Debug, Clone)]
pub enum CustodyDecision {
    ResourceLock { lock: AssetLockReference },
    Escrow { lock_type: LockType },
}

/// Custody strategy decision engine
pub struct CustodyStrategy {
    /// Reference to delivery service for contract calls.
    delivery_service: Arc<DeliveryService>,
}

impl CustodyStrategy {
    pub fn new(delivery_service: Arc<DeliveryService>) -> Self {
        Self { delivery_service }
    }

    pub async fn decide_custody(
        &self,
        input: &OrderInput,
        origin_submission: Option<&solver_types::OriginSubmission>,
    ) -> Result<CustodyDecision, QuoteError> {
        if let Some(lock) = &input.lock {
            return self.handle_explicit_lock(lock);
        }
        self.decide_escrow_strategy(input, origin_submission).await
    }

    fn handle_explicit_lock(
        &self,
        lock: &solver_types::AssetLockReference,
    ) -> Result<CustodyDecision, QuoteError> {
        match lock.kind {
            LockKind::TheCompact => Ok(CustodyDecision::ResourceLock { lock: lock.clone() }),
            LockKind::Rhinestone => Ok(CustodyDecision::ResourceLock { lock: lock.clone() }),
        }
    }

    async fn decide_escrow_strategy(
        &self,
        input: &OrderInput,
        origin_submission: Option<&solver_types::OriginSubmission>,
    ) -> Result<CustodyDecision, QuoteError> {
        let chain_id = input.asset.ethereum_chain_id().map_err(|e| {
            QuoteError::InvalidRequest(format!("Invalid chain ID in asset address: {}", e))
        })?;

        let token_address = input
            .asset
            .ethereum_address()
            .map_err(|e| QuoteError::InvalidRequest(format!("Invalid Ethereum address: {}", e)))?;

        let supports_eip3009 =
            detect_eip3009_via_rpc(chain_id, token_address, self.delivery_service.clone())
                .await
                .unwrap_or(false);

        // Permit2 is deployed at the canonical address on all supported chains.
        let permit2_available = true;

        // Respect user's explicit auth scheme preference from originSubmission
        if let Some(origin) = origin_submission {
            if let Some(schemes) = &origin.schemes {
                // Check for explicit EIP-3009 preference
                if schemes.contains(&solver_types::AuthScheme::Eip3009) {
                    if supports_eip3009 {
                        return Ok(CustodyDecision::Escrow {
                            lock_type: LockType::Eip3009Escrow,
                        });
                    } else {
                        return Err(QuoteError::UnsupportedSettlement(
                            "EIP-3009 requested but not supported by this token".to_string(),
                        ));
                    }
                }

                // Check for explicit Permit2 preference
                if schemes.contains(&solver_types::AuthScheme::Permit2) {
                    if permit2_available {
                        return Ok(CustodyDecision::Escrow {
                            lock_type: LockType::Permit2Escrow,
                        });
                    } else {
                        return Err(QuoteError::UnsupportedSettlement(
                            "Permit2 requested but not available on this chain".to_string(),
                        ));
                    }
                }
            }
        }

        // Fallback to automatic selection if no explicit preference
        if supports_eip3009 {
            Ok(CustodyDecision::Escrow {
                lock_type: LockType::Eip3009Escrow,
            })
        } else if permit2_available {
            Ok(CustodyDecision::Escrow {
                lock_type: LockType::Permit2Escrow,
            })
        } else {
            Err(QuoteError::UnsupportedSettlement(
                "No supported settlement mechanism available for this token".to_string(),
            ))
        }
    }
}
