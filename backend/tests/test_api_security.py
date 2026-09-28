from conftest import USER_A, USER_B


def test_cross_user_record_is_not_visible(client, as_user):
    created = client.post(
        "/api/v1/records",
        json={"record_type": "project", "title": "Private project", "skills": ["Python"]},
    )
    assert created.status_code == 201
    record_id = created.json()["id"]
    as_user(USER_B)
    assert client.get("/api/v1/records").json() == []
    response = client.put(
        f"/api/v1/records/items/{record_id}",
        json={"record_type": "project", "title": "Attempted edit", "skills": []},
    )
    assert response.status_code == 404


def test_profile_identity_comes_from_authentication(client, as_user):
    profile_a = client.get("/api/v1/profile").json()
    assert profile_a["student_id"] == str(USER_A)
    as_user(USER_B)
    profile_b = client.get("/api/v1/profile").json()
    assert profile_b["student_id"] == str(USER_B)
    assert profile_a["id"] != profile_b["id"]

