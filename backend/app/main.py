from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, engine
from app.routes import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    for col in ["graph_x", "graph_y"]:
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE items ADD COLUMN {col} FLOAT"))
                conn.commit()
        except Exception:
            pass
    yield


app = FastAPI(title="Research Tree API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
