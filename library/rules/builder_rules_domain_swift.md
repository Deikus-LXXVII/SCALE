---
description: "Architectural rules for Swift 5.10+ development on macOS."
tags: [swift, macos, concurrency, cryptokit, xpc]
---

# Builder Domain Rules: macOS Swift 5.10+

## 1. Documentation & Philosophy
Swift 5.10+ emphasizes Strict Concurrency (`Sendable`), Protocol-Oriented Programming, and deep integration with macOS frameworks (Foundation, CryptoKit, SMAppService). Documentation: [Swift.org](https://swift.org/documentation/), [Apple Developer](https://developer.apple.com/).

## 2. Specific Rules
1. **Strict Concurrency**: Enable `-strict-concurrency=complete`. All cross-actor data must be `Sendable`.
2. **Foundation.Process**: Use Actor isolation (`@globalActor` or specific `actor`) to track Process state and avoid data races.
3. **Async Process execution**: Wrap `Process.terminationHandler` in `CheckedContinuation` or `AsyncStream` to expose an `async/await` interface.
4. **Async Pipes**: Use `Pipe` asynchronously to prevent deadlocks when reading `standardOutput` and `standardError`.
5. **CryptoKit over CommonCrypto**: Always use CryptoKit for cryptography. Never hardcode keys.
6. **Secure Enclave & Keychain**: Store high-security keys in Secure Enclave and general keys in macOS Keychain.
7. **Authenticated Encryption**: Use AES-GCM or ChaChaPoly with strictly unique nonces.
8. **Daemons (SMAppService)**: Use `SMAppService` for registering Launch Agents and Daemons (macOS 13+) instead of deprecated `SMJobBless`.
9. **XPC Security**: Use `NSXPCConnection` for IPC. Always validate client identity via `auditToken` (Team ID, Bundle ID) rather than PID.
10. **Error Handling**: Use `remoteObjectProxyWithErrorHandler` to handle XPC connection drops safely.
