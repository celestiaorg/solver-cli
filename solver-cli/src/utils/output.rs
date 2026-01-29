use colored::*;
use std::fmt::Display;

use crate::OutputFormat;

/// Print a section header
pub fn print_header(title: &str) {
    println!("\n{}", title.bold().cyan());
    println!("{}", "─".repeat(title.len()).cyan());
}

/// Print a success message
pub fn print_success(msg: &str) {
    println!("{} {}", "✓".green(), msg);
}

/// Print an error message
pub fn print_error(msg: &str) {
    eprintln!("{} {}", "✗".red(), msg.red());
}

/// Print a warning message
pub fn print_warning(msg: &str) {
    println!("{} {}", "!".yellow(), msg.yellow());
}

/// Print an info message
pub fn print_info(msg: &str) {
    println!("{} {}", "•".blue(), msg);
}

/// Print a key-value pair
pub fn print_kv(key: &str, value: impl Display) {
    println!("  {}: {}", key.dimmed(), value);
}

/// Print an address
pub fn print_address(label: &str, address: &str) {
    println!("  {}: {}", label.dimmed(), address.bright_green());
}

/// Print a balance
pub fn print_balance(label: &str, amount: &str, symbol: &str) {
    println!(
        "  {}: {} {}",
        label.dimmed(),
        amount.bright_yellow(),
        symbol
    );
}

/// Print a summary block
pub fn print_summary_start() {
    println!("\n{}", "═══ SUMMARY ═══".bold().green());
}

pub fn print_summary_end() {
    println!("{}\n", "═══════════════".bold().green());
}

/// Print a divider
pub fn print_divider() {
    println!("{}", "───────────────────────────────────────".dimmed());
}

/// Format output based on mode
pub struct OutputFormatter {
    format: OutputFormat,
}

impl OutputFormatter {
    pub fn new(format: OutputFormat) -> Self {
        Self { format }
    }

    pub fn header(&self, title: &str) {
        match self.format {
            OutputFormat::Human => print_header(title),
            OutputFormat::Json => {} // Headers not printed in JSON mode
        }
    }

    pub fn success(&self, msg: &str) {
        match self.format {
            OutputFormat::Human => print_success(msg),
            OutputFormat::Json => {} // Accumulated in final JSON
        }
    }

    pub fn error(&self, msg: &str) {
        match self.format {
            OutputFormat::Human => print_error(msg),
            OutputFormat::Json => eprintln!(r#"{{"error": "{}"}}"#, msg),
        }
    }

    pub fn kv(&self, key: &str, value: impl Display) {
        match self.format {
            OutputFormat::Human => print_kv(key, value),
            OutputFormat::Json => {} // Accumulated in final JSON
        }
    }

    pub fn json<T: serde::Serialize>(&self, value: &T) -> anyhow::Result<()> {
        match self.format {
            OutputFormat::Human => {} // Already printed
            OutputFormat::Json => {
                let json = serde_json::to_string_pretty(value)?;
                println!("{}", json);
            }
        }
        Ok(())
    }

    pub fn is_json(&self) -> bool {
        matches!(self.format, OutputFormat::Json)
    }
}

/// Table for displaying tabular data
pub struct Table {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    col_widths: Vec<usize>,
}

impl Table {
    pub fn new(headers: Vec<&str>) -> Self {
        let headers: Vec<String> = headers.iter().map(|s| s.to_string()).collect();
        let col_widths = headers.iter().map(|h| h.len()).collect();
        Self {
            headers,
            rows: vec![],
            col_widths,
        }
    }

    pub fn add_row(&mut self, row: Vec<&str>) {
        let row: Vec<String> = row.iter().map(|s| s.to_string()).collect();
        for (i, cell) in row.iter().enumerate() {
            if i < self.col_widths.len() {
                self.col_widths[i] = self.col_widths[i].max(cell.len());
            }
        }
        self.rows.push(row);
    }

    pub fn print(&self) {
        // Print header
        let header_line: String = self
            .headers
            .iter()
            .enumerate()
            .map(|(i, h)| format!("{:width$}", h, width = self.col_widths[i]))
            .collect::<Vec<_>>()
            .join(" │ ");
        println!("  {}", header_line.bold());

        // Print separator
        let sep: String = self
            .col_widths
            .iter()
            .map(|w| "─".repeat(*w))
            .collect::<Vec<_>>()
            .join("─┼─");
        println!("  {}", sep.dimmed());

        // Print rows
        for row in &self.rows {
            let line: String = row
                .iter()
                .enumerate()
                .map(|(i, c)| format!("{:width$}", c, width = self.col_widths.get(i).copied().unwrap_or(c.len())))
                .collect::<Vec<_>>()
                .join(" │ ");
            println!("  {}", line);
        }
    }
}
