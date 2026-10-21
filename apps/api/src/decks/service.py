from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.decks.models import Deck
from src.decks.schemas import DeckCreate, DeckUpdate
from src.users.models import User


class DeckOwnerNotFoundError(Exception):
    pass


class DeckNotFoundError(Exception):
    pass


async def create_deck(
    session: AsyncSession, owner_id: UUID, payload: DeckCreate
) -> Deck:
    if await session.get(User, owner_id) is None:
        raise DeckOwnerNotFoundError
    deck = Deck(name=payload.name, owner_id=owner_id)
    session.add(deck)
    await session.commit()
    await session.refresh(deck)
    return deck


async def read_deck(session: AsyncSession, deck_id: int, owner_id: UUID) -> Deck | None:
    return await session.scalar(
        select(Deck).where(Deck.id == deck_id, Deck.owner_id == owner_id)
    )


async def list_decks(session: AsyncSession, owner_id: UUID) -> list[Deck]:
    return list(
        (
            await session.scalars(
                select(Deck).where(Deck.owner_id == owner_id).order_by(Deck.id)
            )
        ).all()
    )


async def update_deck(
    session: AsyncSession, deck_id: int, owner_id: UUID, payload: DeckUpdate
) -> Deck:
    deck = await session.scalar(
        select(Deck).where(Deck.id == deck_id, Deck.owner_id == owner_id)
    )
    if deck is None:
        raise DeckNotFoundError
    deck.name = payload.name
    await session.commit()
    await session.refresh(deck)
    return deck
