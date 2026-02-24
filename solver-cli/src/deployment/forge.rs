use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, info};

/// Runner for Foundry forge commands
pub struct ForgeRunner {
    contracts_path: std::path::PathBuf,
}

impl ForgeRunner {
    pub fn new(contracts_path: &Path) -> Self {
        Self {
            contracts_path: contracts_path.to_path_buf(),
        }
    }

    /// Deploy OIF infrastructure contracts (oracle, settlers) using forge script.
    /// Token deployment is handled separately by the Hyperlane warp route.
    pub async fn deploy(
        &self,
        rpc_url: &str,
        private_key: &str,
        operator_address: Option<&str>,
    ) -> Result<DeploymentOutput> {
        info!("Running forge script deployment (OIF infra only)...");

        // Ensure the private key has 0x prefix for vm.envUint
        let pk = if private_key.starts_with("0x") {
            private_key.to_string()
        } else {
            format!("0x{}", private_key)
        };

        let mut cmd = Command::new("forge");
        cmd.current_dir(&self.contracts_path)
            .arg("script")
            .arg("script/Deploy.s.sol:Deploy")
            .arg("--rpc-url")
            .arg(rpc_url)
            .arg("--broadcast")
            .arg("-vvv")
            .env("PRIVATE_KEY", &pk);

        // Set OPERATOR_ADDRESS if provided (ensures consistency across chains)
        if let Some(operator) = operator_address {
            cmd.env("OPERATOR_ADDRESS", operator);
            info!("Using operator address: {}", operator);
        }

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        debug!("Running forge command in {:?}", self.contracts_path);

        let output = cmd.output().await.context("Failed to run forge script")?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        debug!("Forge stdout:\n{}", stdout);
        debug!("Forge stderr:\n{}", stderr);

        if !output.status.success() {
            anyhow::bail!(
                "Forge script failed with exit code {:?}\nstdout: {}\nstderr: {}",
                output.status.code(),
                stdout,
                stderr
            );
        }

        // Parse addresses from output
        Self::parse_deployment_output(&stdout, &stderr)
    }

    /// Parse deployment output from forge script logs
    fn parse_deployment_output(stdout: &str, stderr: &str) -> Result<DeploymentOutput> {
        let combined = format!("{}\n{}", stdout, stderr);
        let mut addresses = HashMap::new();

        // Parse lines like "AlwaysYesOracle deployed at: 0x..."
        for line in combined.lines() {
            if line.contains("deployed at:") || line.contains("Deployed") {
                if let Some((name, addr)) = Self::parse_deployment_line(line) {
                    addresses.insert(name, addr);
                }
            }
        }

        // Also try parsing console.log output format: "Contract: 0x..."
        for line in combined.lines() {
            // Format: "  AlwaysYesOracle: 0x5FbDB2315678afecb367f032d93F642f64180aa3"
            let trimmed = line.trim();
            if trimmed.contains(": 0x") && !trimmed.starts_with("//") {
                let parts: Vec<&str> = trimmed.splitn(2, ": 0x").collect();
                if parts.len() == 2 {
                    let name = parts[0].trim().to_string();
                    let addr = format!("0x{}", parts[1].trim());
                    if addr.len() == 42 {
                        addresses.insert(name, addr);
                    }
                }
            }
        }

        // Fallback: Look for specific patterns in the broadcast artifacts
        if addresses.is_empty() {
            // Try to extract from typical forge output
            for line in combined.lines() {
                let trimmed = line.trim();
                // Look for "Contract Address: 0x..." or "new ... @0x..."
                if trimmed.contains("0x") && trimmed.len() < 200 {
                    if let Some(addr) = Self::extract_address(trimmed) {
                        // Try to determine contract name from context
                        if trimmed.to_lowercase().contains("oracle") {
                            addresses.insert("AlwaysYesOracle".to_string(), addr);
                        } else if trimmed.to_lowercase().contains("escrow")
                            || trimmed.to_lowercase().contains("input")
                        {
                            addresses.insert("InputSettlerEscrow".to_string(), addr);
                        } else if trimmed.to_lowercase().contains("output")
                            || trimmed.to_lowercase().contains("simple")
                        {
                            addresses.insert("OutputSettlerSimple".to_string(), addr);
                        } else if trimmed.to_lowercase().contains("token")
                            || trimmed.to_lowercase().contains("erc20")
                            || trimmed.to_lowercase().contains("mock")
                        {
                            addresses.insert("MockERC20".to_string(), addr);
                        }
                    }
                }
            }
        }

        Ok(DeploymentOutput { addresses })
    }

    fn parse_deployment_line(line: &str) -> Option<(String, String)> {
        // Try format: "ContractName deployed at: 0x..."
        if let Some(idx) = line.find("deployed at:") {
            let name = line[..idx].split_whitespace().last()?.to_string();
            let addr = line[idx + 12..].trim().to_string();
            if addr.starts_with("0x") && addr.len() >= 42 {
                return Some((name, addr[..42].to_string()));
            }
        }

        // Try format: "Deployed ContractName to 0x..."
        if let Some(idx) = line.find("Deployed") {
            let rest = &line[idx + 8..];
            let parts: Vec<&str> = rest.split_whitespace().collect();
            if parts.len() >= 3 && parts.contains(&"to") {
                let name = parts[0].to_string();
                if let Some(addr_part) = parts.iter().find(|p| p.starts_with("0x")) {
                    if addr_part.len() >= 42 {
                        return Some((name, addr_part[..42].to_string()));
                    }
                }
            }
        }

        None
    }

    fn extract_address(s: &str) -> Option<String> {
        // Find 0x followed by 40 hex chars
        if let Some(start) = s.find("0x") {
            let candidate = &s[start..];
            if candidate.len() >= 42 {
                let addr = &candidate[..42];
                if addr[2..].chars().all(|c| c.is_ascii_hexdigit()) {
                    return Some(addr.to_string());
                }
            }
        }
        None
    }

    /// Build contracts
    pub async fn build(&self) -> Result<()> {
        info!("Building contracts...");

        let output = Command::new("forge")
            .current_dir(&self.contracts_path)
            .arg("build")
            .output()
            .await
            .context("Failed to run forge build. Is Foundry installed and forge in PATH? Run: forge --version")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Forge build failed: {}", stderr);
        }

        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct DeploymentOutput {
    pub addresses: HashMap<String, String>,
}

impl DeploymentOutput {
    pub fn oracle(&self) -> Option<&String> {
        self.addresses
            .get("CentralizedOracle")
            .or_else(|| self.addresses.get("AlwaysYesOracle"))
            .or_else(|| self.addresses.get("Oracle"))
    }

    pub fn input_settler(&self) -> Option<&String> {
        self.addresses
            .get("InputSettlerEscrow")
            .or_else(|| self.addresses.get("InputSettler"))
            .or_else(|| self.addresses.get("Escrow"))
    }

    pub fn output_settler(&self) -> Option<&String> {
        self.addresses
            .get("OutputSettlerSimple")
            .or_else(|| self.addresses.get("OutputSettler"))
    }

    pub fn permit2(&self) -> Option<&String> {
        self.addresses.get("Permit2")
    }

    pub fn permit2(&self) -> Option<&String> {
        self.addresses.get("Permit2")
    }
}
