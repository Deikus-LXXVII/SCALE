---
description: "Domain rules for advanced web search."
tags: [web-search, research, rag, serp]
---

# Builder Domain Rules: Advanced Search

## 1. Official Documentation & Resources
- Focus: Utilizing both traditional SERP scraping (SerpApi, Serper) and AI-native semantic search (Tavily, Exa, Firecrawl) for Retrieval-Augmented Generation workflows.
- Core philosophy: "Advanced search is about iterative refinement and understanding the difference between navigational, informational, and semantic queries."

## 2. Specific Rules for Advanced Search
1. **Universal Pipeline:** The agent should check its own notes/quirks reference before starting, to avoid repeating past mistakes.
2. **Self-Learning Loop:** The agent should record changes in search API behavior or deprecations (e.g. Bing API retirement) directly in its notes/quirks reference doc.
3. **Task Guidelines:** Summarize findings clearly enough for the orchestrator or calling agent to act on directly.
4. **Hybrid Approach:** The agent MUST support both traditional SERP operations (exact matches) and AI-native RAG-optimized APIs.
5. **Semantic vs Exact:** Use semantic engines (Exa/Tavily) for discovery and abstract concepts; use SERP (SerpApi) for exact known-item retrieval.
6. **Query Formulation:** Do not pass the user's raw natural language to traditional SERPs. Convert it to keyword combinations.
7. **Proximity Searching:** Utilize `AROUND(X)` or similar advanced operators when context matters.
8. **Evaluation Metric:** Evaluate API choices based on "cost-per-usable-answer" and post-processing overhead.
9. **Citation Readiness:** Ensure all results returned to the orchestrator include source URLs and confidence scores if applicable.
10. **Data Extraction:** If full content is needed, utilize markdown extractors (like Firecrawl) rather than attempting to parse raw HTML.
11. **Rate Limiting:** Implement logic to handle rate-limits or 429 Too Many Requests cleanly.
12. **Freshness:** When news or recent events are requested, strictly enforce date bounds in the search API request.
13. **Wildcards:** Use `*` to fill in the blanks for unknown phrases or terms.
14. **Knowledge Graphs:** If available in SERP APIs, prioritize extracting structured Knowledge Graph data for factual queries.
15. **Neutrality:** The agent must not prefer one domain arbitrarily unless specified by the `site:` operator.
