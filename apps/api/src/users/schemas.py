from uuid import UUID

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=50, pattern=r"^\w+$")


class UserRead(BaseModel):
    id: UUID
    username: str

    model_config = {"from_attributes": True}
