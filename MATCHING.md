# Matching

JD skills are normalized with lowercase/whitespace rules and a configurable alias map. Required skills default to weight 2; preferred skills to weight 1. Matching uses exact normalized comparison first and bounded lexical similarity for partial matches. The pgvector service supports semantic evidence retrieval; it does not let an LLM choose a percentage.

```text
readiness = skill_weight × coverage
          + semantic_weight × normalized similarity
          + evidence_weight × evidence coverage
```

Weights come from environment settings and total 1.0. Requirements are classified as Strong Match, Partial Match or Missing and include supporting repository records. This is an internal readiness metric, never a placement, hiring or employment probability.

