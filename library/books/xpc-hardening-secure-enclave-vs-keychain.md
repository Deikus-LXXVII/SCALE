---
description: "2025-2026 best practices for hardening macOS XPC services against unauthorized clients (audit-token validation, Team ID/Bundle ID checks, common mistakes), plus concrete guidance on choosing Secure Enclave vs. Keychain for cryptographic keys used by an XPC-connected daemon on Apple Silicon."
tags: [xpc, security, swift, macos, cryptokit, apple-silicon]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---

# macOS XPC Hardening & Secure Enclave vs. Keychain (2025-2026)

## 1. Audit token validation: the core of XPC hardening

The single most important, most-repeated principle across every current source: **never trust `NSXPCConnection.processIdentifier` (PID) for client identity.** PIDs are reused by the kernel; an attacker can spawn a legitimate, trusted process, wait for it to die, and get its PID reassigned to their own malicious process before your service re-checks it (a classic TOCTOU/race). The audit token (`audit_token_t`, exposed on the connection but historically via a private `auditToken` property on `NSXPCConnection`) is immune to this because it's populated atomically by the kernel per-message and encodes PID, UID, GID, and — critically — enough information to derive the code-signing identity of the actual connecting process. (HackTricks; almightysec CVE-2025-55076 writeup)

**Concrete validation pattern**, synthesized from the sources:
1. In `listener:shouldAcceptNewConnection:`, immediately pull the incoming connection's audit token.
2. Turn the audit token into a `SecCode`/`SecTask` reference (`SecCodeCopyGuestWithAttributes` with the audit token as the guest attribute, or `SecTaskCreateWithAuditToken`).
3. Build a `SecRequirement` (via `SecRequirementCreateWithString`) that pins:
   - The signer is Apple or your organization's Developer ID/Team ID (`anchor apple` or `certificate leaf[subject.OU] = "<TEAMID>"`).
   - The specific bundle identifier you expect (`info[CFBundleIdentifier] = "com.yourorg.yourapp"`).
4. Call `SecCodeCheckValidityWithErrors` (or the audit-token-based equivalent) against that requirement — reject the connection (return `NO`) on any failure, before any privileged method is exposed.
5. Do this validation on **every** version of the client you ship, not just the current one — theevilbit's blog post found a real-world case where an old, vulnerable client version was left unchecked, so an attacker could downgrade-then-inject into that old binary and still pass the Team ID/Bundle ID check.

### Common mistakes (repeatedly documented in 2025 writeups)

- **No validation at all**: `shouldAcceptNewConnection:` just returns `YES` unconditionally. This is the root cause behind both CVE-2025-55076 (Plugin Alliance InstallationHelper) and CVE-2025-65842 (Acustica Audio Aquarius Desktop) — both are XPC helper tools that accepted any local client and performed privileged actions (plugin install/update) without checking who was asking. (almightysec.com writeups)
- **PID-based checks** instead of audit-token-based checks — vulnerable to the reuse race described above.
- **Missing Apple-signed-certificate check** — without confirming the signer chains to an Apple root, an attacker can self-sign an ad-hoc/fake cert that satisfies a naively-written requirement string.
- **Missing Team ID check** — without pinning your own Team ID, any developer with any valid Apple Developer ID certificate could pass a check that only verifies "is code-signed."
- **Not checking the library-validation code-signing flag** — if a legitimate client's process can have arbitrary dylibs injected into it (no hardened runtime / no library validation), an attacker can ride along inside an otherwise-trusted, correctly-signed process. theevilbit's writeup on the Viscosity XPC service specifically calls out testing the `CS_REQUIRE_LV` / library-validation bit as an effective mitigation.
- **Broken authorization plumbing**: in the Plugin Alliance CVE, the helper's `checkAuthorization:` method existed but passed `NULL` into `AuthorizationCopyRights`, silently defeating the check it appeared to implement — a reminder to actually exercise these code paths (fuzz/test with a hostile client), not just review that a function named "check" exists.
- **No Hardened Runtime / `com.apple.security.get-task-allow` left enabled** — either lets a debugger or injected code attach to your own privileged process, bypassing all of the above.
- **No connection lifecycle handling** — omitting `invalidationHandler`/`interruptionHandler` isn't a direct vulnerability but leads to resource leaks and undefined behavior on unexpected disconnects, which is called out as a hygiene best practice.
- **Treating XPC payloads as trusted once the connection is validated** — every message should still be treated as attacker-controlled input (strict argument validation/sanitization), since a validated *process* identity says nothing about whether the specific request is well-formed or safe to execute at the privilege level of a root helper.

A cited reference implementation for "what good looks like" is the open-source **BlockBlock** project's XPC listener validation, called out explicitly in the CVE-2025-55076 writeup as a robust pattern developers should emulate.

## 2. Secure Enclave vs. Keychain for an XPC-connected daemon on Apple Silicon

### What each actually is

- **Secure Enclave (SEP)**: a physically separate hardware coprocessor on the Apple SoC, isolated from the main Application Processor, with its own boot ROM, RNG, AES engine, and (on some hardware) dedicated storage. Its defining property: private keys generated inside it **never leave it in usable form** — software (including your own app and daemon) only ever gets a public key or an opaque key *reference*, never the private key material. It is designed to keep secrets safe "even when the Application Processor kernel becomes compromised." (Apple Platform Security guide)
- **Keychain**: Apple's encrypted database for secrets (passwords, tokens, keys, arbitrary small blobs), backed by AES-256 with per-item and per-device protection classes, with well-understood ACL, access-group, and (optionally) iCloud-sync semantics. A Keychain item's `kSecAttrTokenID = kSecAttrTokenIDSecureEnclave` attribute is literally how you tell the Keychain APIs "the private key half of this item lives in the SEP, not in the Keychain's own storage" — i.e., in practice these aren't mutually exclusive tiers, SEP-backed keys are normally *addressed through* the Keychain API surface.

### Hard constraints that decide the question for you

- SEP-backed keys support **only elliptic-curve key types** (in practice P-256 for `SecKeyCreateRandomKey` with `kSecAttrTokenIDSecureEnclave`) — if your protocol needs RSA, or a symmetric key you must be able to export/back up/escrow, **SEP is not an option regardless of preference**; use Keychain (or Keychain + your own key-wrapping scheme).
- SEP private keys **cannot be exported, synced across devices, or backed up** — including to iCloud Keychain. If your XPC daemon's key material must survive a device migration, or be shared with a second Mac, or be recoverable if Secure Enclave state is reset, it cannot live solely in the SEP.
- SEP has finite dedicated storage; it's meant for a bounded number of long-lived identity/signing keys, not for storing many or frequently-rotated secrets.

### Decision guidance for an XPC-connected daemon

**Use Secure Enclave when:**
- The key's job is to *sign or prove possession* (e.g., an asymmetric identity/attestation key the daemon uses to prove its authenticity to a remote server, or to authorize privileged local operations), and the private half genuinely never needs to leave the device or be exported.
- You want protection that holds even if the Application Processor / kernel is compromised — since the daemon and its XPC clients run at the AP level, a SEP-backed key resists exfiltration even by an attacker who has gained root on the host, which a pure-Keychain item (encrypted, but ultimately unwrapped in AP-side memory for use) does not as strongly guarantee.
- Apple Silicon is a hard requirement anyway (SEP is present on every Apple Silicon Mac; on Intel Macs with the T2 chip it's also present, but not on Intel Macs without T2) — so for a modern Apple-Silicon-only daemon this is normally available and cheap to use for its supported key types.

**Keychain (optionally SEP-backed via `kSecAttrTokenID`) is sufficient — and often required — when:**
- You need to store arbitrary secret *data* (tokens, passwords, symmetric session keys, shared secrets) rather than only an asymmetric signing keypair — SEP has no concept of storing arbitrary payloads.
- The secret needs to be exportable, backed up, escrowed, or synced (e.g., via iCloud Keychain) across the user's devices.
- You need symmetric or RSA cryptography.
- Ordinary Keychain access-control (access groups shared between your app and its XPC daemon, ACLs, `kSecAttrAccessible*` policies) already gives you the isolation guarantee you actually need, and the extra hardware-isolation guarantee of SEP isn't part of your threat model.

**Common real-world pattern** (noted across sources): generate the long-lived identity/signing key *in* the Secure Enclave, but store its associated public key, metadata, and any auxiliary secrets the daemon needs in the Keychain — using the Keychain as the addressing/ACL layer for a key whose private half physically lives in the SEP. This gets you SEP's exfiltration resistance for the one key that matters most, without giving up Keychain's flexibility (access groups shared between your host app and its XPC daemon, standard `SecItem` APIs) for everything else.

## Conflicts / gaps noted

- No source directly documents an official capacity limit for Secure Enclave key storage in numeric terms for current (2025-2026) Apple Silicon generations; guidance here is inferred from Apple's general architecture description plus community write-ups, not a single authoritative capacity figure — treat "bounded number of long-lived keys" as directionally correct rather than a hard spec number.
- Search results were strong on the XPC-hardening side (multiple 2025 CVEs with detailed root-cause writeups) but comparatively thinner on Secure-Enclave-specific 2025/2026-dated material; the SEP guidance here is largely stable, long-standing Apple platform-security doctrine rather than something that changed recently — flagged in case newer hardware (e.g. capacity/algorithm support changes in future SEP revisions) supersedes it.

## Sources

- [macOS XPC Connecting Process Check — HackTricks](https://angelica.gitbook.io/hacktricks/macos-hardening/macos-security-and-privilege-escalation/macos-proces-abuse/macos-ipc-inter-process-communication/macos-xpc/macos-xpc-connecting-process-check)
- [Secure coding XPC Services - Part 2 (Checking CS flags) — theevilbit blog](https://theevilbit.github.io/posts/secure_coding_xpc_part2/)
- [CVE-2025-55076 — Plugin Alliance InstallationHelper XPC Service Local Privilege Escalation — Simon Bertrand](https://almightysec.com/plugin-alliance-helpertool-xpc-service-local-privilege-escalation/)
- [CVE-2025-65842 — Acustica Audio HelperTool XPC Service Local Privilege Escalation — Simon Bertrand](https://almightysec.com/helpertool-xpc-service-local-privilege-escalation/)
- [XPC Services (T1559.003) — MITRE ATT&CK](https://www.startupdefense.io/mitre-attack-techniques/t1559-003-xpc-services)
- [Protecting keys with the Secure Enclave — Apple Developer Documentation](https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave)
- [The Secure Enclave — Apple Platform Security guide](https://support.apple.com/guide/security/the-secure-enclave-sec59b0b31ff/web)
- [Keychain vs Secure Enclave — A Complete, Practical Guide for iOS Developers — Amit Aswal (Medium)](https://medium.com/@amitaswal87/keychain-vs-secure-enclave-a-complete-practical-guide-for-ios-developers-9b2c04ba7a6a)