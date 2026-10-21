from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.cards.models import Card
from src.decks.models import Deck
from src.instances.models import Instance
from src.instances.schemas import InstanceCreate, InstanceUpdate


class DeckNotFoundError(Exception):
    pass


class CardNotFoundError(Exception):
    pass


class InstanceNotFoundError(Exception):
    pass


class InstanceConflictError(Exception):
    pass


async def _readable_card(
    session: AsyncSession, card_id: int, card_version: int, user_id: UUID
) -> Card | None:
    return await session.scalar(
        select(Card).where(
            Card.id == card_id,
            Card.version == card_version,
            or_(Card.creator_id == user_id, Card.public.is_(True)),
        )
    )


async def create_instance(
    session: AsyncSession,
    deck_id: int,
    owner_id: UUID,
    payload: InstanceCreate,
) -> Instance:
    deck = await session.scalar(
        select(Deck).where(Deck.id == deck_id, Deck.owner_id == owner_id)
    )
    if deck is None:
        raise DeckNotFoundError
    if (
        await _readable_card(session, payload.card_id, payload.card_version, owner_id)
        is None
    ):
        raise CardNotFoundError
    instance = Instance(
        deck_id=deck_id,
        card_id=payload.card_id,
        card_version=payload.card_version,
    )
    session.add(instance)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise InstanceConflictError from error
    await session.refresh(instance)
    return instance


async def read_instance(
    session: AsyncSession,
    deck_id: int,
    card_id: int,
    card_version: int,
    owner_id: UUID,
) -> Instance | None:
    return await session.scalar(
        select(Instance)
        .join(Deck)
        .where(
            Deck.id == deck_id,
            Deck.owner_id == owner_id,
            Instance.card_id == card_id,
            Instance.card_version == card_version,
        )
    )


async def list_instances(
    session: AsyncSession, deck_id: int, user_id: UUID
) -> list[Instance]:
    return list(
        (
            await session.scalars(
                select(Instance)
                .join(Deck, Deck.id == Instance.deck_id)
                .join(
                    Card,
                    and_(
                        Card.id == Instance.card_id,
                        Card.version == Instance.card_version,
                    ),
                )
                .where(
                    Deck.id == deck_id,
                    or_(
                        Deck.owner_id == user_id,
                        Card.creator_id == user_id,
                        Card.public.is_(True),
                    ),
                )
                .order_by(Instance.card_id, Instance.card_version)
            )
        ).all()
    )


async def update_instance(
    session: AsyncSession,
    deck_id: int,
    card_id: int,
    card_version: int,
    owner_id: UUID,
    payload: InstanceUpdate,
) -> Instance:
    instance = await session.scalar(
        select(Instance)
        .join(Deck)
        .where(
            Deck.id == deck_id,
            Deck.owner_id == owner_id,
            Instance.card_id == card_id,
            Instance.card_version == card_version,
        )
    )
    if instance is None:
        raise InstanceNotFoundError
    new_card_id = payload.card_id if payload.card_id is not None else card_id
    new_card_version = (
        payload.card_version if payload.card_version is not None else card_version
    )
    if await _readable_card(session, new_card_id, new_card_version, owner_id) is None:
        raise CardNotFoundError
    instance.card_id = new_card_id
    instance.card_version = new_card_version
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise InstanceConflictError from error
    await session.refresh(instance)
    return instance
