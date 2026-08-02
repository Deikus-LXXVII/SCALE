---
description: "Domain rules for Swift 5.10+, SwiftUI, and Foundation on macOS."
tags: [swift, macos, swiftui, concurrency]
---

# Swift & macOS Development Standards

1. **Modern Concurrency:** Use `async/await`, `Task`, `actor`, and `MainActor` for concurrency. Avoid raw GCD (`DispatchQueue`) or completion handlers in new code.
2. **SwiftUI Architecture:** Use the `@Observable` macro for state management instead of `ObservableObject` and `@Published` when targeting macOS 14+. For macOS 13 and below, properly structure `ObservableObject` and `@StateObject`.
3. **Immutability and Types:** Default to `let` for constants and `struct` for data models over `class`. Rely on Swift's strong type system and avoid force-unwrapping (`!`).
4. **Foundation:** Prefer modern Swift Foundation APIs (e.g., `URLSession.shared.data(from:)` with async/await, modern `Date`, `Duration`, and `Calendar` methods).
5. **Memory Management:** Ensure closures that capture `self` use `[weak self]` when appropriate to prevent retain cycles. Note that isolated tasks and actors handle state safely but require attention to capturing semantics.
6. **Error Handling:** Use standard Swift `Error` protocols, `throws`, `try`, `try?`, and `do-catch` blocks. Provide meaningful, user-facing error descriptions where necessary.
7. **App Lifecycle:** Use the modern `@main` App structure and `WindowGroup` or `MenuBarExtra` for native macOS application lifecycles.
8. **macOS Specifics:** Consider macOS-specific paradigms such as multi-window support, menu bar items, keyboard shortcuts, and pointer interactions.
