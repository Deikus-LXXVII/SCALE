# DeepSeek V4 Flash coding benchmark — 2026-08-02

## Medium-reasoning verification

| Model | Provider | Reasoning | Run | Public | Hidden | Adversarial |
| --- | --- | --- | --- | --- | --- | --- |
| `deepseek-v4-flash` | `deepseek` | `medium` | `medium-verified` | pass | pass | pass |

The model received only a disposable fixture containing `TASK.md`, the stub, and
the public test. The hidden and adversarial suites remained local to S.C.A.L.E.
and were run only after the resulting implementation was copied into this run
directory.

This is one implementation sample, not a general capability claim. The task
covers an asynchronous LRU cache with TTL, concurrent-load coalescing,
invalidation, and stale-completion protection.

## Earlier runs

The original directory names predate the provider-routing fix and are not
reasoning labels: `runs/medium` was executed with `high` and failed hidden and
adversarial tests; `runs/high` was executed with `max` and passed all suites.
Use `medium-verified` for the actual medium-reasoning result.
