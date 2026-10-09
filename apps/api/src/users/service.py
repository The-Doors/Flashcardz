from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.users.models import User


async def create_app_user(
    session: AsyncSession, user_id: UUID, username: str
) -> User:
    existing = await session.get(User, user_id)
    if existing is not None:
        return existing

    username_owner = await session.scalar(
        select(User).where(User.username == username)
    )
    if username_owner is not None:
        raise ValueError("Username is already taken")

    user = User(id=user_id, username=username)
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.get(User, user_id)
        if existing is not None:
            return existing
        username_owner = await session.scalar(
            select(User).where(User.username == username)
        )
        if username_owner is not None:
            raise ValueError("Username is already taken") from None
        raise

    await session.refresh(user)
    return user
