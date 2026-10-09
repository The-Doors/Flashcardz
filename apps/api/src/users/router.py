from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.users.dependencies import get_authenticated_user_id
from src.users.models import User
from src.users.schemas import UserCreate, UserRead
from src.users.service import create_app_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserRead:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
        )
    return UserRead.model_validate(user)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserRead:
    try:
        user = await create_app_user(session, user_id, payload.username)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    return UserRead.model_validate(user)
