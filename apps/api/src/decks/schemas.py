from pydantic import BaseModel, Field, model_validator


class DeckCreate(BaseModel):
    name: str = Field(min_length=1)


class DeckUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def require_name(self) -> "DeckUpdate":
        if "name" not in self.model_fields_set:
            raise ValueError("The name field must be provided")
        if self.name is None:
            raise ValueError("The name field cannot be null")
        return self


class DeckRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
