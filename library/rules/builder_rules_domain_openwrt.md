---
description: "Architectural rules for OpenWrt development (POSIX, UCI, procd, ubus)."
tags: [openwrt, posix, embedded-linux, uci, procd, ubus]
---

# Builder Domain Rules: OpenWrt

## 1. Documentation & Philosophy
OpenWrt strictly relies on POSIX standards (ash), central configuration (UCI), init/process supervision (procd), and JSON RPC IPC (ubus). Flash wear must be minimized. Documentation: [OpenWrt Wiki](https://openwrt.org/docs/start).

## 2. Specific Rules
1. **POSIX Strictness**: Use `#!/bin/sh` (ash). NO bashisms (no arrays, no `[[ ]]`). Validate with ShellCheck.
2. **Quote Variables**: Always quote variables to prevent globbing/splitting.
3. **OpenWrt Libs**: Source `/lib/functions.sh` and use `config_load`, `config_get` for parsing UCI. Use `jshn` for JSON.
4. **UCI First**: Manage config via `/etc/config/` (UCI) and dynamically generate native app configs in init scripts. Never edit app configs directly.
5. **Flash Wear**: Write runtime state/volatile data to `/tmp` or `/var/run` (RAM). Never write logs or frequent states to flash.
6. **Procd Daemons**: Use `#!/bin/sh /etc/rc.common` with `USE_PROCD=1`. Daemons MUST run in the foreground (do not fork).
7. **Procd Features**: Use `procd_open_instance`, `respawn`, `stdout 1`, `stderr 1` (logging to logd).
8. **Procd Triggers**: Use `procd_add_reload_trigger` to restart automatically on UCI changes.
9. **Ubus IPC**: Use `ubus` for IPC and exposing daemon APIs. Output standard JSON.
