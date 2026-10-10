use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use serde_yaml::{Mapping, Value};
use specta::Type;

pub const DNS_OVERRIDES_KEY: &str = "dns-overrides";
pub use super::runtime_settings::SETTINGS_LOCK as DNS_SETTINGS_LOCK;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DnsSettings {
    /// User-owned DNS overrides. `null` means all DNS fields follow the active profile.
    pub overrides: JsonValue,
    /// DNS block from the committed generated runtime configuration.
    pub effective: JsonValue,
    pub core_running: bool,
}

/// Validate the editable subset of the Clash DNS schema before it is persisted.
pub fn validate_overrides(value: &JsonValue) -> Result<(), String> {
    let fields = value
        .as_object()
        .ok_or_else(|| "DNS overrides must be a JSON object".to_string())?;

    for (field, value) in fields {
        if value.is_null() {
            continue;
        }

        let valid = match field.as_str() {
            "enable"
            | "ipv6"
            | "prefer-h3"
            | "respect-rules"
            | "use-hosts"
            | "use-system-hosts"
            | "direct-nameserver-follow-policy" => value.is_boolean(),
            "listen" | "fake-ip-range" | "fake-ip-range6" | "client-subnet" | "cache-algorithm" => {
                value.is_string()
            }
            "enhanced-mode" => value
                .as_str()
                .is_some_and(|mode| matches!(mode, "fake-ip" | "redir-host")),
            "fake-ip-filter-mode" => value
                .as_str()
                .is_some_and(|mode| matches!(mode, "blacklist" | "whitelist")),
            "fake-ip-ttl" => value.as_u64().is_some(),
            "nameserver"
            | "fallback"
            | "default-nameserver"
            | "proxy-server-nameserver"
            | "direct-nameserver"
            | "fake-ip-filter" => is_string_array(value),
            "fallback-filter" => validate_fallback_filter(value)?,
            "nameserver-policy" | "hosts" => validate_string_map(value)?,
            // Advanced settings can carry fields introduced by newer cores. The
            // selected core's config checker is the authority for those fields.
            _ => true,
        };

        if !valid {
            return Err(format!("DNS field `{field}` has an invalid value type"));
        }
    }

    Ok(())
}

fn is_string_array(value: &JsonValue) -> bool {
    value
        .as_array()
        .is_some_and(|items| items.iter().all(JsonValue::is_string))
}

fn validate_string_map(value: &JsonValue) -> Result<bool, String> {
    let Some(map) = value.as_object() else {
        return Ok(false);
    };

    Ok(map.values().all(|item| {
        item.is_string()
            || item
                .as_array()
                .is_some_and(|items| items.iter().all(JsonValue::is_string))
    }))
}

fn validate_fallback_filter(value: &JsonValue) -> Result<bool, String> {
    let Some(fields) = value.as_object() else {
        return Ok(false);
    };

    for (field, item) in fields {
        let valid = match field.as_str() {
            "geoip" | "geoip6" => item.is_boolean(),
            "geoip-code" => item.is_string(),
            "ipcidr" | "domain" | "geosite" => is_string_array(item),
            _ => true,
        };
        if !valid {
            return Err(format!(
                "DNS fallback-filter field `{field}` has an invalid value type"
            ));
        }
    }

    Ok(true)
}

/// Recursively apply overrides. Null is an unset marker and leaves the profile value intact.
pub fn merge_overrides(target: &mut JsonValue, overrides: &JsonValue) {
    let (Some(target), Some(overrides)) = (target.as_object_mut(), overrides.as_object()) else {
        return;
    };

    for (key, value) in overrides {
        if value.is_null() {
            continue;
        }

        match (target.get_mut(key), value) {
            (Some(existing), JsonValue::Object(_)) if existing.is_object() => {
                merge_overrides(existing, value);
            }
            _ => {
                target.insert(key.clone(), value.clone());
            }
        }
    }
}

/// Remove null markers before storing a full override snapshot.
pub fn normalize_overrides(value: &mut JsonValue) {
    match value {
        JsonValue::Object(fields) => {
            fields.retain(|_, value| !value.is_null());
            for value in fields.values_mut() {
                normalize_overrides(value);
            }
        }
        JsonValue::Array(items) => {
            for item in items {
                normalize_overrides(item);
            }
        }
        _ => {}
    }
}

pub fn json_from_yaml_mapping(mapping: &Mapping) -> JsonValue {
    serde_json::to_value(Value::Mapping(mapping.clone())).unwrap_or(JsonValue::Null)
}

pub fn yaml_mapping_from_json(value: &JsonValue) -> Result<Mapping, String> {
    let yaml = serde_yaml::to_value(value).map_err(|error| error.to_string())?;
    yaml.as_mapping()
        .cloned()
        .ok_or_else(|| "DNS overrides must be a JSON object".to_string())
}

#[cfg(test)]
mod tests {
    use super::{merge_overrides, normalize_overrides, validate_overrides};
    use serde_json::json;

    #[test]
    fn merge_overrides_preserves_unknown_fields_and_ignores_null_fields() {
        let mut effective = json!({
            "enable": true,
            "nameserver": ["1.1.1.1"],
            "profile-extension": { "enabled": true, "keep": "yes" },
            "fallback-filter": { "geoip": true, "geoip-code": "CN" }
        });
        let overrides = json!({
            "nameserver": ["8.8.8.8"],
            "profile-extension": { "enabled": false, "added": "global" },
            "fallback-filter": { "geoip-code": null }
        });

        merge_overrides(&mut effective, &overrides);

        assert_eq!(
            effective,
            json!({
                "enable": true,
                "nameserver": ["8.8.8.8"],
                "profile-extension": { "enabled": false, "keep": "yes", "added": "global" },
                "fallback-filter": { "geoip": true, "geoip-code": "CN" }
            })
        );
    }

    #[test]
    fn validation_accepts_extensions_and_rejects_wrong_types() {
        assert!(validate_overrides(&json!({ "nameserver": ["1.1.1.1"] })).is_ok());
        assert!(validate_overrides(&json!({ "future-dns-option": { "enabled": true } })).is_ok());
        assert!(validate_overrides(&json!({ "enable": "yes" })).is_err());
        assert!(
            validate_overrides(&json!({ "fallback-filter": { "future-filter": true } })).is_ok()
        );
    }

    #[test]
    fn normalize_overrides_removes_nested_unset_markers() {
        let mut value = json!({
            "nameserver": ["8.8.8.8"],
            "fallback-filter": { "geoip": true, "geoip-code": null },
            "future-dns-option": null
        });

        normalize_overrides(&mut value);

        assert_eq!(
            value,
            json!({
                "nameserver": ["8.8.8.8"],
                "fallback-filter": { "geoip": true }
            })
        );
    }
}
