from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.cards.models import Card
from src.cards.schemas import CardCreate, CardUpdate
from src.users.models import User
from .exceptions import (
    CardCreatorNotFoundError,
    CardNotFoundError,
    CardVersionConflictError,
)


async def create_card(
    session: AsyncSession, creator_id: UUID, payload: CardCreate
) -> Card:
    if await session.get(User, creator_id) is None:
        raise CardCreatorNotFoundError

    card = Card(
        front=payload.front,
        back=payload.back,
        creator_id=creator_id,
        public=payload.public,
    )
    session.add(card)
    await session.commit()
    await session.refresh(card)
    return card


async def read_card(
    session: AsyncSession, card_id: int, version: int, user_id: UUID
) -> Card | None:
    return await session.scalar(
        select(Card).where(
            Card.id == card_id,
            Card.version == version,
            or_(Card.creator_id == user_id, Card.public.is_(True)),
        )
    )


async def list_cards(session: AsyncSession, user_id: UUID) -> list[Card]:
    latest_versions = (
        select(Card.id, func.max(Card.version).label("version"))
        .where(Card.creator_id == user_id)
        .group_by(Card.id)
        .subquery()
    )
    return list(
        (
            await session.scalars(
                select(Card)
                .join(
                    latest_versions,
                    and_(
                        Card.id == latest_versions.c.id,
                        Card.version == latest_versions.c.version,
                    ),
                )
                .order_by(Card.id)
            )
        ).all()
    )


async def update_card(
    session: AsyncSession,
    card_id: int,
    version: int,
    user_id: UUID,
    payload: CardUpdate,
) -> Card:
    current = await session.scalar(
        select(Card)
        .where(Card.id == card_id, Card.version == version)
        .with_for_update()
    )
    if current is None or current.creator_id != user_id:
        raise CardNotFoundError

    latest_version = await session.scalar(
        select(func.max(Card.version)).where(Card.id == card_id)
    )
    if latest_version != version:
        raise CardVersionConflictError

    new_front = payload.front if payload.front is not None else current.front
    new_back = payload.back if payload.back is not None else current.back
    if new_front == current.front and new_back == current.back:
        return current

    new_card = Card(
        id=current.id,
        version=current.version + 1,
        front=new_front,
        back=new_back,
        creator_id=current.creator_id,
        public=current.public,
    )
    session.add(new_card)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise CardVersionConflictError from error

    await session.refresh(new_card)
    return new_card
