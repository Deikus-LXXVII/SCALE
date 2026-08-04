---
description: "Domain rules for cybersecurity analysis, including vulnerability scanning, secure dependency management, and secrets detection."
tags: [security, owasp, vulnerability-scanning, secrets-detection]
status: curated
provenance:
  source: "canonical SCALE Git history"
  evidence: "Baseline entry reviewed during SCALE governance migration; requires task-specific validation."
  compatibility: "SCALE >= 0.1.4"
  validated_on: "2026-08-04"
  review_after: "2026-11-02"
---

# Domain Rule: Cybersecurity

## Core Directives
1. Always prioritize identifying OWASP Top 10 vulnerabilities (e.g., Injection, Broken Authentication, Sensitive Data Exposure).
2. Ensure no hardcoded secrets, API keys, or credentials exist in the codebase.
3. Verify that dependencies are up to date and free from known CVEs.
4. If remediation steps are provided, they must be actionable and follow standard secure coding practices.
5. Emphasize principle of least privilege and zero trust where applicable.
