# workpapr

The provider-neutral AI audit platform. We don't use AI to audit — we make AI auditable.

Workpapr scans your codebase for AI/LLM usage, catalogs it into an auditable inventory, enforces governance policies, and generates compliance-ready reports. Works with any provider — OpenAI, Anthropic, Google, Azure, AWS Bedrock, open-source models, and more.

## Install

```bash
npm install -g workpapr
```

Requires Node.js >= 18.

## Quickstart

```bash
# Initialize a workpapr.yaml config in your project
workpapr init

# Scan your codebase for AI/LLM usage
workpapr scan

# Review findings interactively
workpapr review

# Generate an audit report
workpapr report
```

## Commands

| Command | Description |
|---------|-------------|
| `workpapr init` | Initialize a `workpapr.yaml` configuration in the current directory |
| `workpapr scan` | Discover AI/LLM usage and risks in your codebase |
| `workpapr review` | Show unreviewed findings for auditor review |
| `workpapr report` | Generate audit report from persisted findings |
| `workpapr policy check` | Check scan results against governance policies |
| `workpapr policy list` | List available governance policies |
| `workpapr inventory` | Generate an AI system inventory with risk profiles |
| `workpapr monitor` | Runtime AI usage monitoring and cost tracking |
| `workpapr providers` | List supported LLM providers |

## Example

The [`examples/acme-finance/`](./examples/acme-finance) directory contains a sample fintech project with annotated AI usage patterns — agents, RAG pipelines, batch scoring, streaming chat, and more. Use it to see what workpapr detects:

```bash
cd examples/acme-finance
workpapr scan
```

Example output:

```
  Scanning src/ ...

  Found 12 AI integration points across 10 files

  FINDINGS:
  HIGH   src/agents/fraud-detector.ts        Autonomous agent with tool-calling — no human-in-the-loop
  HIGH   src/services/reconciliation.py       Financial calculation using LLM output without validation
  MEDIUM src/pipelines/rag-search.ts          RAG pipeline — retrieval context not logged
  MEDIUM src/services/streaming-chat.ts       Streaming response — no content filtering
  LOW    src/services/embeddings.ts           Embedding model usage — provider lock-in risk
  ...

  Run `workpapr review` to triage findings.
```

## Configuration

Workpapr is configured via `workpapr.yaml` in your project root. See the [acme-finance example config](./examples/acme-finance/workpapr.yaml) for a complete reference.

## License

MIT
