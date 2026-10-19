from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base
from src.users.models import User


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    front: Mapped[str] = mapped_column(String, nullable=False)
    back: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[int] = mapped_column(
        Integer, primary_key=True, nullable=False, default=1
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    creator_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )  # used for permissions, card instances will be in actual decks later
    public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    creator: Mapped[User] = relationship()
