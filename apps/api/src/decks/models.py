from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base
from src.users.models import User

if TYPE_CHECKING:
    from src.instances.models import Instance


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    owner: Mapped[User] = relationship()
    instances: Mapped[list["Instance"]] = relationship(
        back_populates="deck", cascade="all, delete-orphan"
    )
