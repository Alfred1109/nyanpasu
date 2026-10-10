use serde::{Deserialize, Serialize};
use serde_yaml::Mapping;
use specta::Type;

pub const MANAGED_FIELDS_KEY: &str = "managed-runtime-fields";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum ManagedBool {
    #[default]
    Unmanaged,
    Managed(bool),
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(deny_unknown_fields)]
pub struct ManagedRuntimeFields {
    #[serde(default)]
    pub unified_delay: ManagedBool,
    #[serde(default)]
    pub tcp_concurrent: ManagedBool,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct ManagedRuntimeSettings {
    pub fields: ManagedRuntimeFields,
    pub effective_unified_delay: Option<bool>,
    pub effective_tcp_concurrent: Option<bool>,
    pub core_running: bool,
}

impl ManagedRuntimeFields {
    pub fn from_config(config: &Mapping) -> anyhow::Result<Self> {
        match config.get(MANAGED_FIELDS_KEY) {
            Some(value) => Ok(serde_yaml::from_value(value.clone())?),
            None => Ok(Self::default()),
        }
    }

    pub fn apply(&self, config: &mut Mapping) {
        for (key, field) in [
            ("unified-delay", self.unified_delay),
            ("tcp-concurrent", self.tcp_concurrent),
        ] {
            if let ManagedBool::Managed(value) = field {
                config.insert(key.into(), value.into());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_config_keeps_profile_control() {
        let mut profile =
            serde_yaml::from_str::<Mapping>("unified-delay: false\ntcp-concurrent: true").unwrap();
        ManagedRuntimeFields::from_config(&Mapping::new())
            .unwrap()
            .apply(&mut profile);
        assert_eq!(profile.get("unified-delay").unwrap().as_bool(), Some(false));
        assert_eq!(profile.get("tcp-concurrent").unwrap().as_bool(), Some(true));
    }

    #[test]
    fn explicit_false_is_not_treated_as_inheritance() {
        let fields = ManagedRuntimeFields {
            unified_delay: ManagedBool::Managed(false),
            tcp_concurrent: ManagedBool::Unmanaged,
        };
        let mut profile =
            serde_yaml::from_str::<Mapping>("unified-delay: true\ntcp-concurrent: true").unwrap();
        fields.apply(&mut profile);
        assert_eq!(profile.get("unified-delay").unwrap().as_bool(), Some(false));
        assert_eq!(profile.get("tcp-concurrent").unwrap().as_bool(), Some(true));
        assert_eq!(
            serde_yaml::from_value::<ManagedRuntimeFields>(serde_yaml::to_value(&fields).unwrap())
                .unwrap(),
            fields
        );
    }

    #[test]
    fn malformed_ownership_is_rejected() {
        let config = serde_yaml::from_str::<Mapping>(
            "managed-runtime-fields:\n  unified_delay:\n    kind: managed\n    value: yes-please",
        )
        .unwrap();
        assert!(ManagedRuntimeFields::from_config(&config).is_err());
    }
}
