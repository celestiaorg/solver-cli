use serde::de::DeserializeOwned;
use serde_json::Value;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Network error ({label}): {source}")]
    Network {
        label: String,
        #[source]
        source: reqwest::Error,
    },

    #[error("[{status}] {label}: {message}")]
    Upstream {
        label: String,
        status: u16,
        message: String,
        code: Option<String>,
        reason: Option<String>,
        details: Option<Value>,
        body: Value,
    },

    #[error("[{status}] {label}: non-JSON response: {body}")]
    NonJson {
        label: String,
        status: u16,
        body: String,
    },

    #[error("Failed to decode {label} response: {source}")]
    Decode {
        label: String,
        #[source]
        source: serde_json::Error,
        body: String,
    },
}

impl ApiError {
    pub fn from_reqwest(label: impl Into<String>, err: reqwest::Error) -> Self {
        ApiError::Network {
            label: label.into(),
            source: err,
        }
    }
}

/// Read a response and return the deserialized body, preserving upstream
/// status/code/details on error so callers can surface the real reason
/// rather than a flattened "request failed" string.
pub async fn parse_response<T: DeserializeOwned>(
    response: reqwest::Response,
    label: &str,
) -> Result<T, ApiError> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| ApiError::from_reqwest(label, e))?;

    let parsed: Result<Value, _> = if text.is_empty() {
        Ok(Value::Null)
    } else {
        serde_json::from_str(&text)
    };

    if !status.is_success() {
        return Err(match parsed {
            Ok(body) => upstream_from_body(label, status.as_u16(), body),
            Err(_) => ApiError::NonJson {
                label: label.to_string(),
                status: status.as_u16(),
                body: text,
            },
        });
    }

    let body = parsed.map_err(|e| ApiError::Decode {
        label: label.to_string(),
        source: e,
        body: text.clone(),
    })?;

    serde_json::from_value(body).map_err(|e| ApiError::Decode {
        label: label.to_string(),
        source: e,
        body: text,
    })
}

fn upstream_from_body(label: &str, status: u16, body: Value) -> ApiError {
    let pick_str = |k: &str| -> Option<String> {
        body.get(k)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    let message = pick_str("message")
        .or_else(|| pick_str("error"))
        .or_else(|| pick_str("reason"))
        .unwrap_or_else(|| format!("Request failed: {status}"));

    ApiError::Upstream {
        label: label.to_string(),
        status,
        message,
        code: pick_str("code"),
        reason: pick_str("reason"),
        details: body.get("details").cloned(),
        body,
    }
}

/// Order status payloads come back either as a plain string ("filled",
/// "failed") or as a tagged enum like { "failed": { "reason": "..." } }.
/// Surface the inner reason/message rather than just the tag.
pub fn describe_order_status(status: &Value) -> (String, String) {
    if let Some(s) = status.as_str() {
        return (s.to_string(), s.to_string());
    }
    if let Some(obj) = status.as_object() {
        if let Some((tag, inner)) = obj.iter().next() {
            if let Some(inner_obj) = inner.as_object() {
                let text = ["reason", "message", "error", "detail"]
                    .iter()
                    .find_map(|k| inner_obj.get(*k).and_then(|v| v.as_str()))
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| inner.to_string());
                return (tag.clone(), format!("{tag}: {text}"));
            }
            if let Some(s) = inner.as_str() {
                if !s.is_empty() {
                    return (tag.clone(), format!("{tag}: {s}"));
                }
            }
            return (tag.clone(), tag.clone());
        }
    }
    ("unknown".to_string(), "unknown".to_string())
}
