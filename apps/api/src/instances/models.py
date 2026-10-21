from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, ForeignKeyConstraint, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base

if TYPE_CHECKING:
    from src.decks.models import Deck


class Instance(Base):
    __tablename__ = "instances"
    __table_args__ = (
        ForeignKeyConstraint(
            ["card_id", "card_version"], ["cards.id", "cards.version"]
        ),
    )

    deck_id: Mapped[int] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), primary_key=True
    )
    card_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_version: Mapped[int] = mapped_column(Integer, primary_key=True)

    deck: Mapped["Deck"] = relationship(back_populates="instances")
