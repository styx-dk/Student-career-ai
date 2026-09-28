from app.services.planning import CandidateAction, greedy_plan, simulate


REQS = [
    {"skill": "aws", "weight": 2},
    {"skill": "docker", "weight": 2},
    {"skill": "rest api", "weight": 1},
]


def test_simulation_does_not_mutate_real_state():
    skills = ["rest api"]
    evidence = {"rest api": [{"title": "API project"}]}
    action = CandidateAction("1", "Cloud project", ("aws", "docker"), 6, "Project", "")
    _, after = simulate(REQS, skills, evidence, [action])
    assert skills == ["rest api"]
    assert "aws" not in evidence
    assert after.score > 0


def test_greedy_plan_avoids_useless_actions():
    candidates = [
        CandidateAction("1", "Cloud project", ("aws", "docker"), 4, "Project", ""),
        CandidateAction("2", "Unrelated workshop", ("painting",), 1, "Workshop", ""),
    ]
    result = greedy_plan(REQS, ["rest api"], {"rest api": [{"title": "API"}]}, candidates, 80, 3)
    assert [item["id"] for item in result["actions"]] == ["1"]

