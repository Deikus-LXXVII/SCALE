"""Hermes lifecycle bridge for the global S.C.A.L.E. library."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path


_PLUGIN_ROOT = Path(__file__).resolve()
_SYNC_SCRIPT = _PLUGIN_ROOT.parents[2] / "scripts" / "scale-hermes-project-sync.sh"


def _session_cwd() -> str:
    """Resolve the current session's logical workspace, not process cwd."""
    try:
        from agent.runtime_cwd import resolve_agent_cwd
        return str(resolve_agent_cwd())
    except Exception:
        # Keep lifecycle work best-effort if a future/minimal Hermes runtime
        # omits the resolver.
        return os.getcwd()


def _sync_project(**_kwargs):
    if not _SYNC_SCRIPT.is_file():
        return
    try:
        result = subprocess.run(
            ["bash", str(_SYNC_SCRIPT)],
            cwd=_session_cwd(),
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return
    message = (result.stdout or result.stderr or "").strip()
    if message:
        print(message[:500])


def register(ctx):
    # These hooks are zero-token filesystem operations. They do not inject
    # context or start a model call, preserving prompt caching and budget.
    ctx.register_hook("on_session_start", _sync_project)
    ctx.register_hook("on_session_reset", _sync_project)
