use anyhow::Result;
use clap::Subcommand;
use std::collections::HashSet;
use std::env;
use std::path::PathBuf;

use crate::utils::*;
use crate::OutputFormat;

#[derive(Subcommand)]
pub enum OfacCommand {
    /// Update the OFAC sanctions list from the official SDN source
    Update {
        /// Project directory
        #[arg(long)]
        dir: Option<PathBuf>,
    },
}

impl OfacCommand {
    pub async fn run(self, output: OutputFormat) -> Result<()> {
        match self {
            OfacCommand::Update { dir } => Self::update(dir, output).await,
        }
    }

    async fn update(dir: Option<PathBuf>, output: OutputFormat) -> Result<()> {
        let out = OutputFormatter::new(output);
        let project_dir = dir.unwrap_or_else(|| env::current_dir().unwrap());
        let config_dir = project_dir.join(".config");

        out.header("Updating OFAC Sanctions List");

        let url = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML";
        print_info(&format!("Source: {}", url));

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()?;

        let response = client.get(url).send().await?;

        if !response.status().is_success() {
            anyhow::bail!(
                "Failed to fetch OFAC SDN list: HTTP {}",
                response.status()
            );
        }

        let xml = response.text().await?;
        print_info(&format!("Downloaded {} bytes", xml.len()));

        let addresses = parse_eth_addresses_from_sdn_xml(&xml);
        let count = addresses.len();
        print_info(&format!("Found {} Ethereum addresses", count));

        tokio::fs::create_dir_all(&config_dir).await?;
        let ofac_path = config_dir.join("ofac.json");
        let json = serde_json::to_string_pretty(&addresses)?;
        tokio::fs::write(&ofac_path, &json).await?;

        print_success(&format!("Saved to: {}", ofac_path.display()));
        print_info("Run 'solver-cli configure' to include the list in the solver config.");

        if out.is_json() {
            out.json(&serde_json::json!({
                "count": count,
                "path": ofac_path.display().to_string(),
            }))?;
        }

        Ok(())
    }
}

/// Parse Ethereum addresses from an OFAC SDN XML document.
///
/// Scans for `<id>` blocks that contain `Digital Currency Address - ETH`
/// and extracts the corresponding `<idNumber>` value.
pub fn parse_eth_addresses_from_sdn_xml(xml: &str) -> Vec<String> {
    let mut addresses: HashSet<String> = HashSet::new();

    // Each <id>...</id> block may contain one crypto address entry.
    for block in xml.split("<id>").skip(1) {
        let block = match block.split("</id>").next() {
            Some(b) => b,
            None => continue,
        };

        if !block.contains("Digital Currency Address - ETH") {
            continue;
        }

        let start = match block.find("<idNumber>") {
            Some(i) => i + "<idNumber>".len(),
            None => continue,
        };
        let end = match block.find("</idNumber>") {
            Some(i) => i,
            None => continue,
        };
        if end <= start {
            continue;
        }

        let raw = block[start..end].trim();
        // Normalise to lowercase with 0x prefix
        let addr = if raw.starts_with("0x") || raw.starts_with("0X") {
            raw.to_lowercase()
        } else {
            format!("0x{}", raw.to_lowercase())
        };

        // Ethereum addresses are 42 chars: "0x" + 40 hex digits
        if addr.len() == 42 && addr[2..].chars().all(|c| c.is_ascii_hexdigit()) {
            addresses.insert(addr);
        }
    }

    let mut sorted: Vec<String> = addresses.into_iter().collect();
    sorted.sort();
    sorted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_eth_addresses() {
        let xml = r#"
<sdnEntry>
  <idList>
    <id>
      <idType>Digital Currency Address - ETH</idType>
      <idNumber>0xABCDEF1234567890ABCDEF1234567890ABCDEF12</idNumber>
    </id>
    <id>
      <idType>Digital Currency Address - XBT</idType>
      <idNumber>1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf</idNumber>
    </id>
    <id>
      <idType>Digital Currency Address - ETH</idType>
      <idNumber>0x0000000000000000000000000000000000000001</idNumber>
    </id>
  </idList>
</sdnEntry>"#;

        let addrs = parse_eth_addresses_from_sdn_xml(xml);
        assert_eq!(addrs.len(), 2);
        assert!(addrs.contains(&"0xabcdef1234567890abcdef1234567890abcdef12".to_string()));
        assert!(addrs.contains(&"0x0000000000000000000000000000000000000001".to_string()));
        // Bitcoin address must not be included
        assert!(!addrs.iter().any(|a| a.contains("1A1z")));
    }

    #[test]
    fn test_parse_no_eth_addresses() {
        let xml = r#"<sdnEntry><idList></idList></sdnEntry>"#;
        let addrs = parse_eth_addresses_from_sdn_xml(xml);
        assert!(addrs.is_empty());
    }
}
