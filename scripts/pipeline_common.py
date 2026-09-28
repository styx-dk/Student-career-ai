import re


ALIASES = {
    "js": "javascript", "nodejs": "node.js", "postgres": "postgresql",
    "restful api": "rest api", "ml": "machine learning", "nlp": "natural language processing",
    "amazon web services": "aws", "powerbi": "power bi",
}
SKILLS = {
    "python", "java", "javascript", "typescript", "react", "angular", "vue", "node.js",
    "spring boot", "django", "fastapi", "flask", "sql", "postgresql", "mysql", "mongodb",
    "rest api", "docker", "kubernetes", "aws", "azure", "gcp", "git", "linux",
    "machine learning", "deep learning", "natural language processing", "pandas", "numpy",
    "scikit-learn", "tensorflow", "pytorch", "power bi", "tableau", "excel", "spark",
}


def normalize(value: str) -> str:
    value = re.sub(r"\s+", " ", value.strip().lower())
    return ALIASES.get(value, value)


def extract_known_skills(text: str) -> list[str]:
    lowered = f" {text.lower()} "
    found = {skill for skill in SKILLS if re.search(rf"(?<![\w]){re.escape(skill)}(?![\w])", lowered)}
    for alias, canonical in ALIASES.items():
        if re.search(rf"(?<![\w]){re.escape(alias)}(?![\w])", lowered):
            found.add(canonical)
    return sorted(found)

