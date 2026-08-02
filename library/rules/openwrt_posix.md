---
description: "Domain rules for OpenWrt 21.02+, POSIX Shell (ash), procd, ubus, and UCI."
tags: [openwrt, posix, embedded-linux, uci, procd, ubus]
---

# OpenWrt System & Shell Development Standards

1. **Shell Compatibility:** Write strict POSIX-compliant shell scripts targeted for BusyBox `ash`. Avoid bashisms (e.g., `[[ ]]`, arrays, `function` keyword). Always verify scripts using `shellcheck` when available.
2. **Configuration (UCI):** Use the Unified Configuration Interface (`uci`) for managing system and service settings. Always use `uci commit` after modifications and restart affected services to apply changes. Do not manually edit configuration files in `/etc/config/` through scripts.
3. **Service Management (procd):** Write initialization scripts using `procd` (e.g., `USE_PROCD=1`). Rely on `procd_add_reload_trigger` and `procd_set_param command` instead of classic sysvinit daemon management.
4. **RPC/IPC (ubus):** Use `ubus` for inter-process communication. Call existing `ubus` methods for system states (e.g., `network.interface`, `system`) instead of parsing raw files, log outputs, or command line utilities.
5. **Filesystem Considerations:** Respect OpenWrt's overlay filesystem structure (`/overlay` vs `/rom`). Store temporary or variable runtime data in `/tmp` or `/var` (tmpfs) to prevent premature flash memory wear.
6. **Network Management:** Rely on `netifd` for network interface handling. Avoid directly invoking `ifconfig` or `ip` commands to permanently alter managed interfaces; instead use `uci` and `ubus` tools.
7. **Error Handling & Logging:** Redirect errors gracefully and use `logger` to output critical information to the system log (`syslog`), making debugging in OpenWrt's constrained environment easier.
