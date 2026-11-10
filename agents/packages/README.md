# RuXt agent packages

Each humanized agent is one archive the dashboard extracts on import.

## Extensions

- **`.🔰`** — preferred when the OS supports emoji file extensions (macOS / most Linux)
- **`.ruxt`** — fallback when emoji extensions are unreliable (especially Windows)

Both files are the same ZIP content. The dashboard accepts either.

## Included now

- `maya-brooks.🔰` / `maya-brooks.ruxt`
- `noah-reed.🔰` / `noah-reed.ruxt`

Rebuild with:

```sh
npm run package-agents
```
