# AI-Usage-Dashboard

**AI usage analytics dashboard** | Stack: TypeScript

## Knowledge Graph (graphify)

This project has a pre-built structural knowledge graph at `graphify-out/`.

**Before reading multiple files, query the graph first** — saves 90%+ of tokens.

- `graphify-out/graph.json`      — machine-readable graph (160 nodes)
- `graphify-out/GRAPH_REPORT.md` — god nodes, communities, suggested questions
- `graphify-out/graph.html (open in browser)`
- Obsidian vault: `/Users/arunkumar/Documents/Application/obsidian-vault/AI-Usage-Dashboard/`
  - Open `graph.canvas` for visual community map
  - `_COMMUNITY_*.md` notes for feature cluster overviews

**God nodes** (most connected — always relevant):
  - Handler (12 edges)
  - writeJSON() (10 edges)
  - ConversationPanel() (9 edges)
  - Store (8 edges)
  - Adapter (6 edges)

**How to use:**
```python
import json
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx

G = json_graph.node_link_graph(
    json.loads(Path('graphify-out/graph.json').read_text()),
    edges='links'
)
term = 'auth'  # change to what you need
matches = [(n, d['label']) for n, d in G.nodes(data=True) if term in d.get('label','').lower()]
related = list(nx.bfs_tree(G, matches[0][0], depth_limit=2).nodes()) if matches else []
```

To update after code changes: `cd /Users/arunkumar/Documents/Application && python3 graphify_multi_project.py`
