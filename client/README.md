# Client

React 19 + Vite frontend for the Computerized Transcript Digitization & Result Retrieval System.

See the [repository root README](../README.md) for setup, demo accounts, architecture, and testing
instructions — this app doesn't run standalone; it expects the API in `../server` to be running
(the dev server proxies `/api` to `http://localhost:5000`).

Quick reference:

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Vitest + React Testing Library
npm run build     # production build to dist/
npm run lint      # oxlint
```
