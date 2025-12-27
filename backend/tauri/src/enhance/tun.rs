use serde_yaml::{Mapping, Value};

use crate::config::{
    Config,
    nyanpasu::{ClashCore, TunStack},
};

macro_rules! revise {
    ($map: expr, $key: expr, $val: expr) => {
        let ret_key = Value::String($key.into());
        $map.insert(ret_key, Value::from($val));
    };
}

// if key not exists then append value
macro_rules! append {
    ($map: expr, $key: expr, $val: expr) => {
        let ret_key = Value::String($key.into());
        if !$map.contains_key(&ret_key) {
            $map.insert(ret_key, Value::from($val));
        }
    };
}

#[tracing_attributes::instrument(skip(config))]
pub fn use_tun(mut config: Mapping, enable: bool) -> Mapping {
    let tun_key = Value::from("tun");
    let tun_val = config.get(&tun_key);
    tracing::debug!("tun_val: {:?}, enable: {}", tun_val, enable);

    // Fix: Always ensure tun section exists and has enable field to prevent clash-rs SIGSEGV
    // Even if enable is false, we need a proper tun section with enable: false
    // to avoid clash-rs crash when parsing empty/malformed tun config
    let mut tun_val = tun_val.map_or(Mapping::new(), |val| {
        val.as_mapping().cloned().unwrap_or(Mapping::new())
    });

    // Always set enable field to prevent parsing errors
    revise!(tun_val, "enable", enable);

    if !enable {
        // For disabled TUN, still provide minimal valid config to prevent clash-rs crash
        revise!(config, "tun", tun_val);
        return config;
    }

    // TUN is enabled, configure based on core type
    let core = {
        *Config::verge()
            .latest()
            .clash_core
            .as_ref()
            .unwrap_or(&ClashCore::default())
    };
    if core == ClashCore::ClashRs || core == ClashCore::ClashRsAlpha {
        #[cfg(target_os = "macos")]
        append!(tun_val, "device-id", "dev://utun1989");
        #[cfg(not(target_os = "macos"))]
        {
            let key = Value::String("device-id".into());
            tun_val.remove(&key);
        }
        revise!(tun_val, "auto-route", true);
    } else {
        let mut tun_stack = {
            *Config::verge()
                .latest()
                .tun_stack
                .as_ref()
                .unwrap_or(&TunStack::default())
        };
        if core == ClashCore::ClashPremium && tun_stack == TunStack::Mixed {
            tun_stack = TunStack::Gvisor;
        }
        append!(tun_val, "stack", AsRef::<str>::as_ref(&tun_stack));
        append!(tun_val, "dns-hijack", vec!["any:53"]);
        revise!(tun_val, "auto-route", true);
        append!(tun_val, "auto-detect-interface", true);
    }

    revise!(config, "tun", tun_val);
    use_dns_for_tun(config)
}

fn use_dns_for_tun(mut config: Mapping) -> Mapping {
    let dns_key = Value::from("dns");
    let dns_val = config.get(&dns_key);

    let mut dns_val = dns_val.map_or(Mapping::new(), |val| {
        val.as_mapping().cloned().unwrap_or(Mapping::new())
    });

    // 开启tun将同时开启dns
    revise!(dns_val, "enable", true);

    append!(dns_val, "enhanced-mode", "fake-ip");
    append!(dns_val, "fake-ip-range", "198.18.0.1/16");
    append!(
        dns_val,
        "nameserver",
        vec!["114.114.114.114", "223.5.5.5", "8.8.8.8"]
    );
    append!(dns_val, "fallback", vec![] as Vec<&str>);

    #[cfg(target_os = "windows")]
    append!(
        dns_val,
        "fake-ip-filter",
        vec![
            "dns.msftncsi.com",
            "www.msftncsi.com",
            "www.msftconnecttest.com"
        ]
    );
    revise!(config, "dns", dns_val);
    config
}
