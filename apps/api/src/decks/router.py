from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.decks import service as deck_service
from src.decks.schemas import DeckCreate, DeckRead, DeckUpdate
from src.users.dependencies import get_authenticated_user_id

router = APIRouter(prefix="/decks", tags=["decks"])


@router.post("", response_model=DeckRead, status_code=status.HTTP_201_CREATED)
async def create_deck(
    payload: DeckCreate,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DeckRead:
    try:
        deck = await deck_service.create_deck(session, user_id, payload)
    except deck_service.DeckOwnerNotFoundError as error:
        raise HTTPException(status_code=404, detail="User profile not found") from error
    return DeckRead.model_validate(deck)


@router.get("", response_model=list[DeckRead])
async def list_decks(
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[DeckRead]:
    decks = await deck_service.list_decks(session, user_id)
    return [DeckRead.model_validate(deck) for deck in decks]


@router.get("/{deck_id}", response_model=DeckRead)
async def read_deck(
    deck_id: int,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DeckRead:
    deck = await deck_service.read_deck(session, deck_id, user_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    return DeckRead.model_validate(deck)


@router.patch("/{deck_id}", response_model=DeckRead)
async def update_deck(
    deck_id: int,
    payload: DeckUpdate,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> DeckRead:
    try:
        deck = await deck_service.update_deck(session, deck_id, user_id, payload)
    except deck_service.DeckNotFoundError as error:
        raise HTTPException(status_code=404, detail="Deck not found") from error
    return DeckRead.model_validate(deck)
