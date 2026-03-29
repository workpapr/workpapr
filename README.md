# @workpapr/core

The provider-neutral audit platform. We don't use AI to audit — we make AI auditable.

## What it does

- **Scan** codebases for AI/LLM usage patterns, risks, and compliance gaps
- **Analyze** findings with risk scoring, data flow tracing, and compliance mapping
- **Review** with AI-assisted workpaper generation styled to your firm's standards
- **Report** audit-ready output with evidence trails
- **Policy** engine for defining and enforcing compliance rules (SOX, EU AI Act, NIST)
- **Inventory** cataloging of AI systems across your organization
- **Monitor** cost, token usage, and operational metrics

## Install

```bash
npm install -g @workpapr/core
```

## Usage

```bash
workpapr scan ./your-project        # Scan for AI usage and risks
workpapr review ./your-project      # AI-assisted audit review
workpapr report ./your-project      # Generate audit report
workpapr policy check ./your-project # Check compliance policies
workpapr inventory build             # Build AI system inventory
```

## Related packages

| Package | Description |
|---------|-------------|
| [@workpapr/train](https://github.com/workpapr/workpapr-train) | Training framework — trace recording, MLX fine-tuning, SFT/DPO |
| [@workpapr/demo](https://github.com/workpapr/workpapr-demo) | Interactive flywheel demo |

## License

MIT
