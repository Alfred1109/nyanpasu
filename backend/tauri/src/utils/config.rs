use crate::config::Config;

pub fn get_current_clash_mode() -> String {
    Config::clash()
        .latest()
        .0
        .get("mode")
        .map(|val| val.as_str().unwrap_or("rule"))
        .unwrap_or("rule")
        .to_owned()
}

// Minimal trait to fix compilation - simplified in extreme cleanup
pub trait NyanpasuReqwestProxyExt {
    fn swift_set_proxy(self, _url: &str) -> Self;
}

impl NyanpasuReqwestProxyExt for reqwest::ClientBuilder {
    fn swift_set_proxy(self, _url: &str) -> Self {
        self // No proxy configuration in extreme cleanup version
    }
}
