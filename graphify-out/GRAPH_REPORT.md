# Graph Report - /Users/arunkumar/Documents/Application/AI-Usage-Dashboard  (2026-04-13)

## Corpus Check
- 33 files · ~33 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 160 nodes · 177 edges · 31 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]

## God Nodes (most connected - your core abstractions)
1. `Handler` - 12 edges
2. `writeJSON()` - 10 edges
3. `ConversationPanel()` - 9 edges
4. `Store` - 8 edges
5. `Adapter` - 6 edges
6. `truncate()` - 5 edges
7. `SessionDetail()` - 4 edges
8. `Watcher` - 3 edges
9. `extractToolSample()` - 3 edges
10. `truncateMaybe()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.19
Nodes (7): Handler, clampScore(), isSpecificPrompt(), isSystemInjection(), pluralS(), promptLenToScore(), writeJSON()

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (17): ConversationPair, DailyStats, HistoryEntry, Insight, InsightDimension, InsightsResponse, ModelStats, RawContent (+9 more)

### Community 2 - "Community 2"
Cohesion: 0.26
Nodes (9): cleanText(), ConversationPanel(), ctxColor(), extractImages(), fmtMs(), fmtTok(), relTime(), shortModel() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.33
Nodes (5): decodeProjectDir(), extractToolSample(), truncate(), truncateMaybe(), Adapter

### Community 4 - "Community 4"
Cohesion: 0.27
Nodes (2): Store, tokenCost()

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (2): SessionTable(), shortProject()

### Community 6 - "Community 6"
Cohesion: 0.53
Nodes (4): analyzeSession(), fmtMs(), fmtTokens(), SessionDetail()

### Community 7 - "Community 7"
Cohesion: 0.47
Nodes (4): Dashboard(), DateFilterBar(), fmt(), todayStr()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (2): contextFillPct(), ContextHealth()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (1): Watcher

### Community 11 - "Community 11"
Cohesion: 0.4
Nodes (1): Hub

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (2): PromptScore(), scoreColor()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (2): getColor(), ToolSamplePanel()

### Community 14 - "Community 14"
Cohesion: 0.5
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 0.83
Nodes (3): newTestHandler(), TestGetSessions(), TestGetStats()

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (2): ActivityChart(), buildHourly()

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (1): Adapter

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **18 isolated node(s):** `InsightDimension`, `Insight`, `InsightsResponse`, `RawEntry`, `RawMessage` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 19`** (2 nodes): `main()`, `main.go`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `App()`, `App.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `LiveBanner()`, `LiveBanner.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `Icon()`, `Icon.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `CostChart()`, `CostChart.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `StatCard()`, `StatCard.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `useWebSocket.js`, `useWebSocket()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `Sessions()`, `Sessions.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `Settings()`, `Settings.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `Adapter`, `adapter.go`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `InsightDimension`, `Insight`, `InsightsResponse` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._