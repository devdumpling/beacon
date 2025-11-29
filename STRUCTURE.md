# Beacon Monorepo Structure

```
beacon/
├── apps/
│   ├── api/                    # Gleam backend
│   │   ├── gleam.toml
│   │   ├── manifest.toml
│   │   └── src/
│   │       └── beacon.gleam
│   │
│   └── dashboard/              # SvelteKit
│       ├── package.json
│       ├── svelte.config.js
│       ├── vite.config.ts
│       └── src/
│
├── packages/
│   ├── sdk/                    # Client SDK (published to npm)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts      # Bundle config
│   │   └── src/
│   │       ├── index.ts
│   │       ├── beacon.ts
│   │       └── flags.ts
│   │
│   └── types/                  # Shared TypeScript types
│       ├── package.json
│       └── src/
│           └── index.ts
│
├── infra/
│   ├── docker-compose.yml      # Local Postgres
│   ├── migrations/             # SQL migrations (dbmate)
│   │   └── 001_initial.sql
│   └── Dockerfile.api          # Gleam production build
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── justfile                    # Task orchestration
├── pnpm-workspace.yaml
├── package.json                # Root package.json
├── .tool-versions              # asdf version pinning
├── .envrc                      # direnv for local dev
└── README.md
```
