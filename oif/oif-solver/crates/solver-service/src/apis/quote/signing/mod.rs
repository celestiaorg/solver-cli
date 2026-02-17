//! Cryptographic signing and signature payload generation for quotes.
//!
//! This module provides the infrastructure for generating signature payloads that users
//! must sign to authorize cross-chain token transfers. It supports multiple signing schemes
//! and protocols to accommodate different token standards and settlement mechanisms.
//!
//! ## Architecture
//!
//! The signing module is organized into:
//! - **Payloads**: Protocol-specific message generation (EIP-3009, etc.)
//! - **Schemes**: Signature schemes (EIP-712, EIP-191, etc.)
//! - **Validation**: Signature verification and validation logic
//!
//! ## Supported Protocols
//!
//! ### EIP-3009
//! Transfer with authorization for USDC and similar tokens:
//! - Native gasless transfers
//! - Built-in authorization mechanics
//! - receiveWithAuthorization for secure transfers
//!
//! ## Security Model
//!
//! All signature payloads include:
//! - **Domain Separation**: Chain and contract-specific binding
//! - **Replay Protection**: Nonces and expiry timestamps
//! - **Intent Verification**: Oracle addresses for settlement validation
//! - **Amount Authorization**: Explicit token amounts and recipients

pub mod payloads {}
