from collections.abc import Generator
from sqlalchemy.orm import DeclarativeBase, Session
from app.services.collection_service import collection_service


class Base(DeclarativeBase):
    pass


class _EngineProxy:
    def __getattr__(self, name):
        if not collection_service._current_engine:
            collection_service.initialize()
        return getattr(collection_service._current_engine, name)

    def connect(self):
        if not collection_service._current_engine:
            collection_service.initialize()
        return collection_service._current_engine.connect()


engine = _EngineProxy()


def SessionLocal() -> Session:
    return collection_service.get_session()


def get_db() -> Generator[Session, None, None]:
    db = collection_service.get_session()
    try:
        yield db
    finally:
        db.close()
