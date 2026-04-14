# AI Usage Dashboard Wiki

Welcome to the comprehensive guide for the **AI Usage Dashboard** — a local-first analytics tool for understanding your Claude Code sessions.

## What is This?

The dashboard analyzes your Claude Code sessions, scores your prompts using the CARE framework, tracks token consumption, and provides actionable insights to help you write better prompts and understand your productivity patterns.

## Getting Started

**Choose your path:**

- **👤 [I'm a User](#user-path)** — I want to understand the dashboard, interpret metrics, and improve my prompts
- **👨‍💻 [I'm a Developer](#developer-path)** — I want to extend the dashboard, add adapters, or contribute

---

## User Path

New to the dashboard? Start here.

- **[Quick Start (5 min)](User-Getting-Started-Quick-Start)** — Install and run in under 5 minutes
- **[Installation Guide](User-Installation)** — Detailed setup for macOS, Linux, Windows
- **[First Run & Data Discovery](User-First-Run-Data-Discovery)** — Why aren't my sessions showing up?

### Learn the Features

- **[Dashboard Overview](User-Dashboard-Overview)** — Tour of every widget and what it means
- **[CARE Scoring Explained](User-CARE-Scoring-Explained)** — What does your 1-10 score mean? How to improve.
- **[Using Prompt Examples](User-Prompt-Examples)** — Learn from your own real prompts
- **[Token Metrics & Cache](User-Token-Metrics)** — What are tokens? How does cache efficiency work?
- **[Interpreting Insights](User-Interpreting-Insights)** — Tier system, peer benchmarks, and your path to mastery

### Troubleshooting & Learning

- **[Troubleshooting & FAQs](User-Troubleshooting-FAQs)** — Common problems and how to solve them
- **[Tips & Best Practices](User-Tips-Best-Practices)** — Write better prompts, organize your sessions

---

## Developer Path

Ready to extend the dashboard or contribute?

- **[Quick Start (5 min)](Dev-Getting-Started-Quick-Start)** — Clone, build, and run
- **[Local Development Setup](Dev-Local-Development-Setup)** — Frontend dev server + backend server

### Understand the Architecture

- **[System Design Overview](Dev-System-Design-Overview)** — Why this architecture? Key layers and trade-offs
- **[Component Breakdown](Dev-Component-Breakdown)** — What each component does and how they interact
- **[Data Flow & State Management](Dev-Data-Flow)** — How sessions flow from disk → store → UI

### Extend & Contribute

- **[Adapter Development Guide](Dev-Adapter-Development-Guide)** — Add support for Cursor, Copilot, Windsurf
- **[Adding New Metrics](Dev-Adding-New-Metrics)** — Compute and expose custom metrics
- **[API Extensions](Dev-API-Extensions)** — Add new REST endpoints
- **[Code Style & Standards](Dev-Code-Style)** — Go and React conventions
- **[Testing Requirements](Dev-Testing-Requirements)** — What and how to test
- **[PR Process](Dev-PR-Process)** — How to submit contributions
- **[Building & Deployment](Dev-Building-Deployment)** — Create releases, Docker, cloud hosting

---

## Reference

- **[Glossary](Glossary)** — Terms, definitions, concepts
- **[README](../README.md)** — Quick reference, API docs, installation, quick start
- **[GitHub Repository](https://github.com/arunenoah/AI-Usage-Dashboard)** — Source code, releases, and project home

---

## Quick Links

- 🔗 **View on GitHub:** [arunenoah/AI-Usage-Dashboard](https://github.com/arunenoah/AI-Usage-Dashboard)
- 🐛 **Report a Bug:** [GitHub Issues](https://github.com/arunenoah/AI-Usage-Dashboard/issues/new)
- 📝 **Contribute:** See contributing guide from the Developer Path

---

## Documentation Structure

**This wiki serves two audiences:**

| Path | For | Starts With |
|------|-----|-------------|
| **User Path** | End users, learners, power users | [Quick Start (5 min)](User-Getting-Started-Quick-Start) |
| **Developer Path** | Contributors, maintainers, extenders | [Quick Start (5 min)](Dev-Getting-Started-Quick-Start) |

**All paths share:**
- [Glossary](Glossary) — Terms and concepts
- This home page navigation

---

## Page Navigation Hints

- **Got stuck installing?** → [Installation Guide](User-Installation)
- **Don't understand CARE scores?** → [CARE Scoring Explained](User-CARE-Scoring-Explained)
- **Want to add an adapter?** → [Adapter Development Guide](Dev-Adapter-Development-Guide)
- **Need to see how it all fits together?** → [System Design Overview](Dev-System-Design-Overview)
- **Not sure what a term means?** → [Glossary](Glossary)
