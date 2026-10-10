/// This module is used to manage the proxies for the Tauri application.
/// It is used to provide the unite interface between tray and frontend.
/// TODO: add a diff algorithm to reduce the data transfer, and the rerendering of the tray menu.
use super::{CLASH_API_DEFAULT_BACKOFF_STRATEGY, api};
use adler::adler32;
use anyhow::Result;
use backon::Retryable;
use indexmap::IndexMap;
use log::warn;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::{Arc, OnceLock};
use tokio::{sync::broadcast, try_join};
use tracing_attributes::instrument;

#[derive(Debug, Clone, Deserialize, Serialize, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProxyGroupItem {
    pub name: String,
    pub r#type: String, // TODO: 考虑改成枚举
    pub udp: bool,
    pub history: Vec<api::ProxyItemHistory>,
    pub all: Vec<api::ProxyItem>,
    pub now: Option<String>, // 当前选中的代理
    pub provider: Option<String>,
    pub alive: Option<bool>, // Mihomo Or Premium Only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xudp: Option<bool>, // Mihomo Only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tfo: Option<bool>, // Mihomo Only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>, // Mihomo Only
    #[serde(default)]
    pub hidden: bool, // Mihomo Only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub test_url: Option<String>, // Mihomo Only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_status: Option<String>, // Mihomo Only
    /// Present (including as an empty string) when Mihomo supports pinning this group.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fixed: Option<String>, // Mihomo/Meow Only
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<serde_json::Value>, // Mihomo Only, per-URL delay history
                             // extra: {}, // Mihomo Only
}

impl From<api::ProxyItem> for ProxyGroupItem {
    fn from(item: api::ProxyItem) -> Self {
        let all = vec![];
        ProxyGroupItem {
            name: item.name,
            r#type: item.r#type,
            udp: item.udp,
            history: item.history,
            all,
            now: item.now,
            provider: item.provider,
            alive: item.alive,
            xudp: item.xudp,
            tfo: item.tfo,
            icon: item.icon,
            hidden: item.hidden,
            test_url: item.test_url,
            expected_status: item.expected_status,
            fixed: item.fixed,
            extra: item.extra,
        }
    }
}

impl ProxyGroupItem {
    /// `fixed` is exposed by Mihomo/Meow on URLTest and Fallback groups even
    /// while empty. Older cores omit it and reject manual selection.
    fn supports_select(&self) -> bool {
        self.r#type == "Selector"
            || (matches!(self.r#type.as_str(), "URLTest" | "Fallback") && self.fixed.is_some())
    }

    fn supports_clear_fixed(&self) -> bool {
        matches!(self.r#type.as_str(), "URLTest" | "Fallback")
            && self.fixed.as_deref().is_some_and(|fixed| !fixed.is_empty())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct Proxies {
    pub global: ProxyGroupItem,
    pub direct: api::ProxyItem,
    pub groups: Vec<ProxyGroupItem>,
    pub records: IndexMap<String, api::ProxyItem>,
    pub proxies: Vec<api::ProxyItem>,
}

async fn fetch_proxies() -> Result<(api::ProxiesRes, api::ProvidersProxiesRes)> {
    try_join!(api::get_proxies(), api::get_providers_proxies())
}

fn merge_provider_proxies(
    core_proxies: &IndexMap<String, api::ProxyItem>,
    providers: IndexMap<String, api::ProxyProviderItem>,
) -> (
    IndexMap<String, api::ProxyItem>,
    IndexMap<String, api::ProxyItem>,
) {
    let mut provider_groups = IndexMap::new();
    let mut provider_nodes = IndexMap::new();

    for (provider_name, provider) in providers.into_iter().filter(|(_, provider)| {
        matches!(
            provider.vehicle_type,
            api::VehicleType::Http | api::VehicleType::File
        )
    }) {
        let provider_group_name = provider.name.clone();
        let mut provider_group: api::ProxyItem = provider.clone().into();
        provider_group.provider = Some(provider_name.clone());
        provider_groups
            .entry(provider_group_name)
            .or_insert(provider_group);

        for mut proxy in provider.proxies {
            if core_proxies.contains_key(&proxy.name) {
                continue;
            }
            proxy.provider.get_or_insert_with(|| provider_name.clone());
            // Provider iteration order is stable; the first provider wins duplicate
            // names while the core /proxies entry always remains authoritative.
            provider_nodes.entry(proxy.name.clone()).or_insert(proxy);
        }
    }

    let mut records = core_proxies.clone();
    for (name, proxy) in &provider_nodes {
        records.entry(name.clone()).or_insert_with(|| proxy.clone());
    }

    (records, provider_groups)
}

impl Proxies {
    #[instrument]
    pub async fn fetch() -> Result<Self> {
        let (inner_proxies, providers_proxies) = fetch_proxies
            .retry(*CLASH_API_DEFAULT_BACKOFF_STRATEGY)
            .await?;
        let inner_proxies = inner_proxies.proxies;
        // Core entries are authoritative; provider records only supplement missing
        // proxy nodes and retain their health history for the proxy/group UI.
        let (records, provider_groups) =
            merge_provider_proxies(&inner_proxies, providers_proxies.providers);
        let generate_item = |name: &str| {
            if let Some(r) = inner_proxies.get(name) {
                r.clone()
            } else if let Some(r) = records.get(name) {
                r.clone()
            } else if let Some(r) = provider_groups.get(name) {
                r.clone()
            } else {
                api::ProxyItem {
                    name: name.to_string(),
                    r#type: "Unknown".to_string(),
                    udp: false,
                    history: vec![],
                    ..Default::default()
                }
            }
        };

        let global = inner_proxies.get("GLOBAL");
        let direct = inner_proxies
            .get("DIRECT")
            .ok_or(anyhow::anyhow!("DIRECT is missing in /proxies"))?
            .clone(); // It should be always exists
        let reject = inner_proxies
            .get("REJECT")
            .ok_or(anyhow::anyhow!("REJECT is missing in /proxies"))?
            .clone(); // It should be always exists

        // 3. generate the proxies groups
        let groups: Vec<ProxyGroupItem> = match global {
            Some(api::ProxyItem { all: Some(all), .. }) => {
                let all = all.clone();
                all.into_iter()
                    .filter(|name| {
                        matches!(
                            inner_proxies.get(name),
                            Some(api::ProxyItem { all: Some(_), .. })
                        )
                    })
                    .map(|name| {
                        let item = inner_proxies
                            .get(&name)
                            .unwrap_or(&api::ProxyItem::default())
                            .clone();
                        let item_all = item.all.clone().unwrap_or_default();
                        let mut item: ProxyGroupItem = item.into();
                        item.all = item_all
                            .into_iter()
                            .map(|name| generate_item(&name))
                            .collect();
                        item
                    })
                    .collect()
            }
            _ => {
                let mut groups: Vec<ProxyGroupItem> = inner_proxies
                    .clone()
                    .into_values()
                    .filter(|v| v.name == "GLOBAL" && v.all.is_some())
                    .map(|v| {
                        let all = v.all.clone().unwrap_or_default();
                        let mut item: ProxyGroupItem = v.clone().into();
                        item.all = all.into_iter().map(|name| generate_item(&name)).collect();
                        item
                    })
                    .collect();
                groups.sort_by(|a, b| b.name.to_lowercase().cmp(&a.name.to_lowercase()));
                groups
            }
        };

        // 4. generate the proxies
        let mut proxies: Vec<api::ProxyItem> = vec![direct.clone(), reject];
        proxies.extend(inner_proxies.clone().into_values().filter(|v| {
            matches!(v.name.as_str(), "DIRECT" | "REJECT")
                && (v.all.is_none() || v.all.as_ref().unwrap().is_empty())
        }));
        proxies.extend(
            records
                .iter()
                .filter(|(name, _)| !inner_proxies.contains_key(name.as_str()))
                .map(|(_, proxy)| proxy.clone()),
        );

        // 5. generate the global
        let global: Option<ProxyGroupItem> = global.map(|v| {
            let all = v.all.clone().unwrap_or_default();
            let mut item: ProxyGroupItem = v.clone().into();
            item.all = all.into_iter().map(|name| generate_item(&name)).collect();
            item
        });

        Ok(Proxies {
            global: global.unwrap_or_default(),
            direct,
            groups,
            records,
            proxies,
        })
    }
}

pub struct ProxiesGuard {
    inner: Proxies,
    checksum: Option<u32>,
    updated_at: u64,
    sender: broadcast::Sender<()>,
}

impl ProxiesGuard {
    pub fn global() -> &'static Arc<RwLock<ProxiesGuard>> {
        static PROXIES: OnceLock<Arc<RwLock<ProxiesGuard>>> = OnceLock::new();
        PROXIES.get_or_init(|| {
            let (tx, _) = broadcast::channel(5); // 默认提供 5 个消费位置，提供一定的缓冲
            Arc::new(RwLock::new(ProxiesGuard {
                checksum: None,
                sender: tx,
                inner: Proxies::default(),
                updated_at: 0,
            }))
        })
    }

    pub fn get_receiver(&self) -> broadcast::Receiver<()> {
        self.sender.subscribe()
    }

    pub fn replace(&mut self, proxies: Proxies, checksum: u32) {
        let now = chrono::Utc::now().timestamp() as u64;
        self.inner = proxies;
        self.checksum = Some(checksum);
        self.updated_at = now;

        if let Err(e) = self.sender.send(()) {
            warn!(
                target: "clash::proxies",
                "send update signal failed: {e:?}"
            );
        }
    }

    // pub async fn select_proxy(&mut self, group: &str, name: &str) -> Result<()> {
    //     api::update_proxy(group, name).await?;
    //     self.update().await?;
    //     Ok(())
    // }

    pub fn inner(&self) -> &Proxies {
        &self.inner
    }

    pub fn updated_at(&self) -> u64 {
        self.updated_at
    }

    pub fn is_updated(&self) -> bool {
        let now = chrono::Utc::now().timestamp() as u64;
        now - self.updated_at <= 3
    }
}

pub trait ProxiesGuardExt {
    async fn update(&self) -> Result<()>;
    async fn select_proxy(&self, group: &str, name: &str) -> Result<()>;
    async fn clear_fixed_proxy(&self, group: &str) -> Result<()>;
}

type ProxiesGuardSingleton = &'static Arc<RwLock<ProxiesGuard>>;
impl ProxiesGuardExt for ProxiesGuardSingleton {
    async fn update(&self) -> Result<()> {
        let proxies = Proxies::fetch().await?;
        let buf = serde_json::to_string(&proxies)?;
        let checksum = adler32(buf.as_bytes())?;
        {
            let reader = self.read();
            if reader.checksum == Some(checksum) {
                return Ok(());
            }
        }
        let mut writer = self.write();
        writer.replace(proxies, checksum);
        Ok(())
    }

    async fn select_proxy(&self, group: &str, name: &str) -> Result<()> {
        self.update().await?;
        let group_snapshot = {
            let guard = self.read();
            guard
                .inner()
                .groups
                .iter()
                .find(|candidate| candidate.name == group)
                .or_else(|| (guard.inner().global.name == group).then_some(&guard.inner().global))
                .cloned()
        };
        let group_snapshot = group_snapshot
            .ok_or_else(|| anyhow::anyhow!("proxy group {group:?} does not exist"))?;
        anyhow::ensure!(
            group_snapshot.supports_select(),
            "proxy group {group:?} does not support manual selection"
        );
        api::update_proxy(group, name).await?;
        self.update().await?;
        Ok(())
    }

    async fn clear_fixed_proxy(&self, group: &str) -> Result<()> {
        self.update().await?;
        let group_snapshot = {
            let guard = self.read();
            guard
                .inner()
                .groups
                .iter()
                .find(|candidate| candidate.name == group)
                .or_else(|| (guard.inner().global.name == group).then_some(&guard.inner().global))
                .cloned()
        };
        let group_snapshot = group_snapshot
            .ok_or_else(|| anyhow::anyhow!("proxy group {group:?} does not exist"))?;
        anyhow::ensure!(
            group_snapshot.supports_clear_fixed(),
            "proxy group {group:?} has no fixed member to clear"
        );
        api::clear_proxy_selection(group).await?;
        self.update().await?;
        Ok(())
    }
}

#[cfg(test)]
mod capability_tests {
    use super::{ProxyGroupItem, merge_provider_proxies};
    use crate::core::clash::api::{
        ProviderType, ProxyItem, ProxyItemHistory, ProxyProviderItem, VehicleType,
    };
    use indexmap::IndexMap;

    fn group(kind: &str, fixed: Option<&str>) -> ProxyGroupItem {
        ProxyGroupItem {
            r#type: kind.to_owned(),
            fixed: fixed.map(str::to_owned),
            ..Default::default()
        }
    }

    #[test]
    fn manual_selection_uses_core_reported_capability() {
        assert!(group("Selector", None).supports_select());
        assert!(!group("URLTest", None).supports_select());
        assert!(group("URLTest", Some("")).supports_select());
        assert!(group("Fallback", Some("node-a")).supports_select());
        assert!(!group("LoadBalance", Some("node-a")).supports_select());
    }

    #[test]
    fn automatic_selection_can_only_be_restored_for_a_real_pin() {
        assert!(!group("Selector", None).supports_clear_fixed());
        assert!(!group("Fallback", None).supports_clear_fixed());
        assert!(!group("URLTest", Some("")).supports_clear_fixed());
        assert!(group("Fallback", Some("node-a")).supports_clear_fixed());
    }

    fn proxy(name: &str, alive: Option<bool>, delay: i64) -> ProxyItem {
        ProxyItem {
            name: name.to_owned(),
            r#type: "Shadowsocks".to_owned(),
            alive,
            history: if delay >= 0 {
                vec![ProxyItemHistory {
                    time: "2026-10-11T00:00:00Z".to_owned(),
                    delay,
                }]
            } else {
                vec![]
            },
            ..Default::default()
        }
    }

    #[test]
    fn provider_health_supplements_missing_nodes_without_overriding_core() {
        let mut core = IndexMap::new();
        core.insert("duplicate".to_owned(), proxy("duplicate", Some(false), 0));

        let mut provider_a = ProxyProviderItem {
            name: "provider-a".to_owned(),
            r#type: ProviderType::Proxy,
            proxies: vec![
                proxy("duplicate", Some(true), 25),
                proxy("provider-only", Some(true), 41),
            ],
            vehicle_type: VehicleType::Http,
            test_url: Some("https://probe.example/health".to_owned()),
            expected_status: Some("200".to_owned()),
        };
        let provider_b = ProxyProviderItem {
            name: "provider-b".to_owned(),
            r#type: ProviderType::Proxy,
            proxies: vec![proxy("provider-only", Some(false), 0)],
            vehicle_type: VehicleType::File,
            test_url: None,
            expected_status: None,
        };
        // Keep construction mutable above to make it explicit that provider metadata
        // is carried through the synthetic provider-group entry too.
        provider_a.proxies[0].provider = Some("provider-a".to_owned());
        let providers = IndexMap::from([
            ("provider-a".to_owned(), provider_a),
            ("provider-b".to_owned(), provider_b),
        ]);

        let (records, provider_groups) = merge_provider_proxies(&core, providers);

        assert_eq!(records["duplicate"].alive, Some(false));
        assert_eq!(records["duplicate"].history[0].delay, 0);
        assert_eq!(records["provider-only"].alive, Some(true));
        assert_eq!(records["provider-only"].history[0].delay, 41);
        assert_eq!(
            records["provider-only"].provider.as_deref(),
            Some("provider-a")
        );
        assert_eq!(
            provider_groups["provider-a"].test_url.as_deref(),
            Some("https://probe.example/health")
        );
    }
}
