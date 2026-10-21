from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.instances import service as instance_service
from src.instances.schemas import InstanceCreate, InstanceRead, InstanceUpdate
from src.users.dependencies import get_authenticated_user_id

router = APIRouter(prefix="/decks/{deck_id}/instances", tags=["instances"])


@router.post("", response_model=InstanceRead, status_code=status.HTTP_201_CREATED)
async def create_instance(
    deck_id: int,
    payload: InstanceCreate,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> InstanceRead:
    try:
        instance = await instance_service.create_instance(
            session, deck_id, user_id, payload
        )
    except instance_service.DeckNotFoundError as error:
        raise HTTPException(status_code=404, detail="Deck not found") from error
    except instance_service.CardNotFoundError as error:
        raise HTTPException(status_code=404, detail="Card not found") from error
    except instance_service.InstanceConflictError as error:
        raise HTTPException(
            status_code=409, detail="Instance already exists"
        ) from error
    return InstanceRead.model_validate(instance)


@router.get("", response_model=list[InstanceRead])
async def list_instances(
    deck_id: int,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[InstanceRead]:
    instances = await instance_service.list_instances(session, deck_id, user_id)
    return [InstanceRead.model_validate(instance) for instance in instances]


@router.get("/{card_id}/{card_version}", response_model=InstanceRead)
async def read_instance(
    deck_id: int,
    card_id: int,
    card_version: int,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> InstanceRead:
    instance = await instance_service.read_instance(
        session, deck_id, card_id, card_version, user_id
    )
    if instance is None:
        raise HTTPException(status_code=404, detail="Instance not found")
    return InstanceRead.model_validate(instance)


@router.patch("/{card_id}/{card_version}", response_model=InstanceRead)
async def update_instance(
    deck_id: int,
    card_id: int,
    card_version: int,
    payload: InstanceUpdate,
    user_id: Annotated[UUID, Depends(get_authenticated_user_id)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> InstanceRead:
    try:
        instance = await instance_service.update_instance(
            session, deck_id, card_id, card_version, user_id, payload
        )
    except instance_service.InstanceNotFoundError as error:
        raise HTTPException(status_code=404, detail="Instance not found") from error
    except instance_service.CardNotFoundError as error:
        raise HTTPException(status_code=404, detail="Card not found") from error
    except instance_service.InstanceConflictError as error:
        raise HTTPException(
            status_code=409, detail="Instance already exists"
        ) from error
    return InstanceRead.model_validate(instance)
