from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.cards import service as card_service
from src.cards.schemas import CardCreate, CardRead, CardUpdate
from src.database import get_db
from src.users.dependencies import get_authenticated_user_id

router = APIRouter(prefix="/cards", tags=["cards"])


@router.post("", response_model=CardRead, status_code=status.HTTP_201_CREATED)
async def create_card(
    payload: CardCreate,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CardRead:
    try:
        card = await card_service.create_card(session, user_id, payload)
    except card_service.CardCreatorNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        ) from error
    return CardRead.model_validate(card)


@router.get("/{card_id}/{version}", response_model=CardRead)
async def read_card(
    card_id: int,
    version: int,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CardRead:
    card = await card_service.read_card(session, card_id, version, user_id)
    if card is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not found"
        )
    return CardRead.model_validate(card)


@router.patch("/{card_id}/{version}", response_model=CardRead)
async def update_card(
    card_id: int,
    version: int,
    payload: CardUpdate,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CardRead:
    try:
        card = await card_service.update_card(
            session, card_id, version, user_id, payload
        )
    except card_service.CardNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not found"
        ) from error
    except card_service.CardVersionConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Card has a newer version; read the latest version before updating",
        ) from error
    return CardRead.model_validate(card)
