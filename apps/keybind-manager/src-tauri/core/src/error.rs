use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("schema error: {0}")]
    Schema(String),
    #[error("generation error: {0}")]
    Generate(String),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("validation failed: {0}")]
    Validation(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuredError {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub retryable: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
}

impl StructuredError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        StructuredError {
            code: code.into(),
            message: message.into(),
            detail: None,
            retryable: false,
            action: None,
        }
    }

    pub fn detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn retryable(mut self) -> Self {
        self.retryable = true;
        self
    }

    pub fn action(mut self, action: impl Into<String>) -> Self {
        self.action = Some(action.into());
        self
    }
}

impl From<CoreError> for StructuredError {
    fn from(err: CoreError) -> Self {
        let code = match &err {
            CoreError::Schema(_) => "SCHEMA",
            CoreError::Generate(_) => "GENERATE",
            CoreError::Parse(_) => "PARSE",
            CoreError::Validation(_) => "VALIDATION",
            CoreError::Io(_) => "IO",
        };
        StructuredError::new(code, err.to_string())
    }
}
