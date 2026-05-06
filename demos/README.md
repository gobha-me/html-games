# Demos / archive

Historical artifacts from earlier rounds of the LLM-vs-LLM build-off held
in this repo. Not linked from the main launcher (`/index.html`) and not
deployed as games — they're kept here so the competition history isn't
lost.

| File | What it is |
|------|------------|
| `Kimi-Demo.html` | Standalone demo from a Kimi model (pre-`kimi/` game dir) |
| `KimiOS.html` | "OS" UI demo from a Kimi model |
| `MiniMaxOS.html` | "OS" UI demo from a MiniMax model |
| `MiniMaxOS-SPEC.md` | The design spec that paired with `MiniMaxOS.html` |
| `MistralOS.html` | "OS" UI demo from a Mistral model |
| `Qwen-Demo.html` | Standalone demo from a Qwen model (pre-`reclamation-wars/`) |

If you want to view one of these in the browser, the simplest path is:

```bash
cd /path/to/HTML-Games
python3 -m http.server 8000
# then open http://localhost:8000/demos/MiniMaxOS.html
```

These are intentionally **not** linked from the launcher — see the root
[`AGENTS.md`](../AGENTS.md) for repo conventions.
