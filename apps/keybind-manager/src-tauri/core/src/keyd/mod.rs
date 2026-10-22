pub mod actions;
pub mod generate;
pub mod parse;
pub mod scan;

pub use generate::{generate_all, generate_profile, ManagedFile};
pub use parse::parse_profile;
pub use scan::{
    compute_conflicts, config_rank_for_device, conflicts_blocking_apply, describe_conflicts,
    is_managed_scan_name, parse_id_entry, parse_ids_section, simulate_managed_configs, ConfigMatch,
    IdEntry, IdPattern, KeyboardConflict, MatchRank, ScannedConfig,
};
