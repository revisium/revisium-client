# AGENTS.md

## Project

`@revisium/client` is the TypeScript client for the Revisium System REST API,
with a small hand-written layer for higher-level scopes and GraphQL-only
operations such as API key management.

## Local Workflow

- Install dependencies with `npm ci`.
- Run focused unit tests with `npm test -- --runTestsByPath <file>`.
- Run the normal prepublish check with `npm run build && npm run tsc`.
- Integration tests expect a Revisium server and use `REVISIUM_URL`,
  `REVISIUM_USERNAME`, and `REVISIUM_PASSWORD`.

## Code Notes

- `src/generated/**` is generated from `specs/openapi.json`; do not edit it by
  hand.
- High-level scope APIs live in `src/*-scope.ts`.
- Shared REST wrappers live in `src/data-operations.ts`.
- API key auth and types live in `src/api-keys.ts`; keep validation aligned with
  core's `rev_` plus 22 base64url-character format.
- API key management methods in `RevisiumClient` call the System GraphQL API
  because those operations are not in the REST OpenAPI spec.

## Release Hygiene

- Keep `package-lock.json` tool-generated.
- Do not edit built `dist/**` unless the user explicitly asks for generated
  release artifacts.
