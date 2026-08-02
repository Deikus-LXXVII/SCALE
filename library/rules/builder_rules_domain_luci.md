---
description: "Architectural rules for OpenWrt LuCI web interface (ES6+, CSR)."
tags: [openwrt, luci, frontend, javascript, csr]
---

# Builder Domain Rules: OpenWrt LuCI

## 1. Documentation & Philosophy
OpenWrt LuCI has transitioned to a modern Client-Side Rendering (CSR) architecture using pure ES6+ JavaScript. Lua templates (CBI) are deprecated to reduce router load.

## 2. Specific Rules
1. **No Lua Templates**: Never use Lua for rendering HTML. Use pure JavaScript.
2. **ES6 Standard**: Use ES6 modules, Promises, and classes.
3. **LuCI.view**: Views are defined as JavaScript classes extending `LuCI.view` (`L.view`).
4. **DOM Construction**: Use the `E(tagName, attributes, children)` function to generate DOM nodes programmatically. No raw HTML strings.
5. **LuCI Forms**: Use `LuCI.form` (`form.Map`, `form.TypedSection`) for UI elements bound to UCI configuration.
6. **JSON-RPC via Ubus**: Use `LuCI.rpc.declare()` to wrap ubus calls into Promise-based functions.
7. **ACL Requirements**: Any frontend ubus or uci access MUST be authorized in a JSON file under `/usr/share/rpcd/acl.d/`. If this is missing, the RPC call will fail with Access Denied.
8. **RPCD Reload**: Changing ACLs requires `service rpcd reload`.
