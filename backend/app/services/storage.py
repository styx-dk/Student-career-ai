from functools import lru_cache
from urllib.parse import quote
import httpx

from supabase import Client, create_client

from app.core.config import settings


@lru_cache
def get_supabase_admin() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase server credentials are not configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def upload_bytes(bucket: str, path: str, data: bytes, mime_type: str) -> None:
    _request("POST", f"/object/{quote(bucket)}/{quote(path, safe='/')}", content=data,
             headers={"Content-Type": mime_type, "x-upsert": "false"})


def remove_object(bucket: str, path: str) -> None:
    _request("DELETE", f"/object/{quote(bucket)}", json={"prefixes": [path]})


def signed_url(bucket: str, path: str, expires_in: int = 300) -> str:
    result = _request("POST", f"/object/sign/{quote(bucket)}/{quote(path, safe='/')}", json={"expiresIn": expires_in}).json()
    url = result["signedURL"]
    return url if url.startswith("https://") else settings.supabase_url.rstrip('/') + "/storage/v1" + url


def _request(method, path, **kwargs):
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Supabase storage is not configured")
    headers = {"apikey": settings.supabase_service_role_key}
    # New sb_secret keys belong in apikey; legacy service-role JWTs also use Bearer.
    if not settings.supabase_service_role_key.startswith("sb_secret_"):
        headers["Authorization"] = "Bearer " + settings.supabase_service_role_key
    headers.update(kwargs.pop("headers", {}))
    with httpx.Client(timeout=30) as client:
        response = client.request(method, settings.supabase_url.rstrip('/') + "/storage/v1" + path, headers=headers, **kwargs)
    if not response.is_success:
        raise RuntimeError(f"Storage request failed (HTTP {response.status_code})")
    return response


def download_bytes(bucket, path):
    return _request("GET", f"/object/{quote(bucket)}/{quote(path, safe='/')}").content


def list_buckets():
    return _request("GET", "/bucket").json()
