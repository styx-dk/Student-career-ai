import re
from difflib import SequenceMatcher


DEFAULT_ALIASES = {
    "js": "javascript",
    "nodejs": "node.js",
    "node js": "node.js",
    "reactjs": "react",
    "postgres": "postgresql",
    "postgres sql": "postgresql",
    "restful api": "rest api",
    "restful apis": "rest api",
    "ml": "machine learning",
    "nlp": "natural language processing",
    "ai": "artificial intelligence",
    "aws cloud": "aws",
    "amazon web services": "aws",
    "powerbi": "power bi",
    "scikit learn": "scikit-learn",
}


def normalize_skill(value: str, aliases: dict[str, str] | None = None) -> str:
    text = re.sub(r"\s+", " ", value.strip().lower())
    text = text.replace("_", " ")
    return (aliases or DEFAULT_ALIASES).get(text, text)


def skill_similarity(left: str, right: str) -> float:
    a, b = normalize_skill(left), normalize_skill(right)
    if a == b:
        return 1.0
    a_tokens, b_tokens = set(a.split()), set(b.split())
    token_score = len(a_tokens & b_tokens) / max(len(a_tokens | b_tokens), 1)
    sequence_score = SequenceMatcher(None, a, b).ratio()
    return round(max(token_score, sequence_score * 0.85), 4)

