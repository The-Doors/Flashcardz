from typing import Annotated
from uuid import UUID

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException, status
import httpx

from src.config import get_settings


bearer_scheme = HTTPBearer(auto_error=False)


async def get_authenticated_user_id(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> UUID:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid bearer token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    authorization = f"{credentials.scheme} {credentials.credentials}"

    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid bearer token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": authorization,
                },
            )
        except httpx.HTTPError as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not verify Supabase identity",
            ) from error

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return UUID(response.json()["id"])
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase returned an invalid identity",
        ) from error
