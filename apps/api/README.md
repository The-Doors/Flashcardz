# Api

## Setup

Install `uv`, copy `.env.example` to `.env`, and configure all the env vars you need, then run

```sh
uv run fastapi dev src/main.py --app app
```

## Database

Copy `.env.example` to `.env` and set `DATABASE_URL` to the PostgreSQL URL. For local Supabase, use the `DB_URL` printed by `supabase status` and change the scheme from `postgresql://` to `postgresql+asyncpg://`. Run the commands below from `apps/api` so `uv` uses this project and loads its `.env`.

Use `get_db` from `src.database` as a FastAPI dependency to get an async
SQLAlchemy session. For example:

```python
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.users.models import User

async def get_user(user_id, session: Annotated[AsyncSession, Depends(get_db)]):
    return await session.get(User, user_id)
```

## Migrations

Alembic migrations live in `migrations/`. 

```sh
uv run alembic revision --autogenerate -m "describe schema change"
```

Apply pending migrations to the database configured by `DATABASE_URL`:

```sh
uv run alembic upgrade head
```

Check the current revision with `uv run alembic current`; roll back one revision with `uv run alembic downgrade -1`.

## Project Structure

I want to follow a structure like this that I saw online

```
src/
├── {domain}/           # e.g., auth/, posts/, aws/
│   ├── router.py       # API endpoints
│   ├── schemas.py      # Pydantic models
│   ├── models.py       # SQLAlchemy ORM models
│   ├── service.py      # Business logic
│   ├── dependencies.py # Route dependencies
│   ├── config.py       # Domain-scoped BaseSettings
│   ├── constants.py    # Constants and error codes
│   ├── exceptions.py   # Domain-specific exceptions
│   └── utils.py        # Helper functions
├── config.py           # Global BaseSettings
├── models.py           # Shared Pydantic / ORM bases
├── exceptions.py       # Global exceptions
├── database.py         # Async engine + session factory
└── main.py             # FastAPI app + lifespan
```
