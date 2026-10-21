from pydantic import BaseModel, Field, model_validator


class InstanceCreate(BaseModel):
    card_id: int = Field(gt=0)
    card_version: int = Field(gt=0)


class InstanceUpdate(BaseModel):
    card_id: int | None = Field(default=None, gt=0)
    card_version: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def require_card_reference(self) -> "InstanceUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one card reference field must be provided")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Card reference fields cannot be null")
        return self


class InstanceRead(BaseModel):
    deck_id: int
    card_id: int
    card_version: int

    model_config = {"from_attributes": True}
