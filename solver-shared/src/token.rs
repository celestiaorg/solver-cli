//! Token kind enums shared between the CLI surface (`clap`) and the persisted
//! state.json / TOML schemas (`serde`). Both encodings use the same lowercase
//! string spellings, so existing config and state files keep parsing.

use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Underlying asset kind for a registered token.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "lowercase")]
#[clap(rename_all = "lowercase")]
pub enum TokenType {
    #[default]
    Erc20,
    Native,
}

impl TokenType {
    /// Canonical lowercase identifier used in state.json and downstream configs.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Erc20 => "erc20",
            Self::Native => "native",
        }
    }
}

impl fmt::Display for TokenType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Hyperlane warp router variant for a token. Maps to the on-chain contract
/// kind: `HypERC20Collateral`, `HypSynthetic`, or `HypNative`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "lowercase")]
#[clap(rename_all = "lowercase")]
pub enum WarpTokenType {
    Collateral,
    Synthetic,
    Native,
}

impl WarpTokenType {
    /// Canonical lowercase identifier used in state.json and downstream configs.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Collateral => "collateral",
            Self::Synthetic => "synthetic",
            Self::Native => "native",
        }
    }
}

impl fmt::Display for WarpTokenType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_type_serde_roundtrip() {
        for (variant, encoded) in [
            (TokenType::Erc20, "\"erc20\""),
            (TokenType::Native, "\"native\""),
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            assert_eq!(json, encoded);
            let back: TokenType = serde_json::from_str(encoded).unwrap();
            assert_eq!(back, variant);
        }
    }

    #[test]
    fn warp_token_type_serde_roundtrip() {
        for (variant, encoded) in [
            (WarpTokenType::Collateral, "\"collateral\""),
            (WarpTokenType::Synthetic, "\"synthetic\""),
            (WarpTokenType::Native, "\"native\""),
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            assert_eq!(json, encoded);
            let back: WarpTokenType = serde_json::from_str(encoded).unwrap();
            assert_eq!(back, variant);
        }
    }

    #[test]
    fn token_type_rejects_unknown() {
        let err = serde_json::from_str::<TokenType>("\"weird\"").unwrap_err();
        assert!(err.to_string().contains("unknown variant"));
    }

    #[test]
    fn warp_token_type_rejects_unknown() {
        let err = serde_json::from_str::<WarpTokenType>("\"weird\"").unwrap_err();
        assert!(err.to_string().contains("unknown variant"));
    }

    #[test]
    fn clap_value_enum_parses_lowercase() {
        let parsed = TokenType::from_str("erc20", true).unwrap();
        assert_eq!(parsed, TokenType::Erc20);
        let parsed = WarpTokenType::from_str("synthetic", true).unwrap();
        assert_eq!(parsed, WarpTokenType::Synthetic);
    }

    #[test]
    fn display_matches_as_str() {
        assert_eq!(TokenType::Erc20.to_string(), "erc20");
        assert_eq!(WarpTokenType::Collateral.to_string(), "collateral");
    }
}
