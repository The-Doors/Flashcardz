from pydantic import BaseModel, Field, model_validator


class CardCreate(BaseModel):
    front: str = Field(min_length=1)
    back: str = Field(min_length=1)
    public: bool = False


class CardUpdate(BaseModel):
    front: str | None = Field(default=None, min_length=1)
    back: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def require_card_content(self) -> "CardUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one of front or back must be provided")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Card content fields cannot be null")
        return self


class CardRead(BaseModel):
    id: int
    front: str
    back: str
    version: int
    public: bool

    model_config = {"from_attributes": True}
