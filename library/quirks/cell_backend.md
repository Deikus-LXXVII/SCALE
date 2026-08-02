# cell_backend quirks

- **Problem**: Bundled Node.js entry points may resolve source-relative paths inconsistently when each call site recomputes `__dirname` traversal.
  **Environment**: A bundled MCP server where runtime `__dirname` is the compiled `dist/` directory.
  **Solution**: Define one canonical base-path helper and reuse it for all agent, rule, and backup paths.
