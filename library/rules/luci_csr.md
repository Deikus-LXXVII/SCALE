---
description: "Domain rules for modern Client-Side Rendering (CSR) apps in LuCI using ES6+ and OpenWrt JSON-RPC."
tags: [openwrt, luci, frontend, javascript, csr]
---

# LuCI CSR (Client-Side Rendering) Development Standards

1. **ES6+ Standards:** Use modern JavaScript (ES6+): `const`/`let`, arrow functions, template literals, and `async/await`. Avoid `var`. Ensure compatibility with standard LuCI JavaScript patterns.
2. **LuCI Class System:** Extend `LuCI.view` and `LuCI.form` appropriately for UI views. Utilize `L.bind()` or arrow functions to preserve lexical `this` within callbacks.
3. **DOM Manipulation:** Rely on LuCI's built-in DOM builder functions (`E()`, `DOM.create()`) rather than direct `document.createElement()` calls or using heavy external libraries (like jQuery or React).
4. **Data Fetching:** Use LuCI's `rpc.declare()` to interact with the `ubus` backend via JSON-RPC. Wrap RPC calls in Promises and properly handle network or authentication errors.
5. **State Management:** Load required initial state (e.g., UCI configurations, UBUS data) via the `load()` method of your view before `render()` is executed. This ensures data is ready before UI rendering.
6. **Form Handling:** When building settings pages, use LuCI's configuration mapping objects: `L.cbi.Map`, `L.cbi.Section`, and `L.cbi.Value` (or their modern CSR equivalents). Rely on the framework's built-in validation, dependency, and save mechanisms.
7. **Localization:** Wrap all user-visible strings in `_("Your Text")` to leverage LuCI's gettext-based localization system. Never hardcode strings in the UI.
8. **Asynchronous UI:** Handle long-running operations asynchronously. Provide user feedback during operations (like spinners or loading states) without freezing the main UI thread.
