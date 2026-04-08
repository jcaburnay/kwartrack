# Kwartrack

A personal finance tracker for managing accounts, partitions (sub-buckets), transactions, recurring transactions, budgets, and debt splits.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Routing:** React Router v7
- **Auth:** Clerk
- **Backend/DB:** SpacetimeDB 2.x
- **Styling:** Tailwind CSS v4 + DaisyUI v5

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [pnpm](https://pnpm.io/)
- A [Clerk](https://clerk.com/) account
- A [SpacetimeDB](https://spacetimedb.com/) account

### Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone <repo-url>
   cd kwartrack
   pnpm install
   ```

2. Copy the example env file and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

3. Start the dev server:

   ```bash
   pnpm dev
   ```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm test` | Run tests |
| `pnpm check` | Biome format + lint (auto-fix) |
| `pnpm generate` | Regenerate SpacetimeDB bindings after schema changes |
| `pnpm server:publish` | Publish SpacetimeDB module |

## Environment Variables

See `.env.example` for required variables.
