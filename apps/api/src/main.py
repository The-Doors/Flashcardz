from fastapi import FastAPI

from src.cards.router import router as cards_router
from src.decks.router import router as decks_router
from src.instances.router import router as instances_router
from src.users.router import router as users_router

app = FastAPI()
app.include_router(users_router)
app.include_router(cards_router)
app.include_router(decks_router)
app.include_router(instances_router)


@app.get("/")
async def root():
    return {"message": "Hello World"}
