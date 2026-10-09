from fastapi import APIRouter

from app.routes.items import router as items_router
from app.routes.item_edges import router as item_edges_router
from app.routes.bookmarks import router as bookmarks_router
from app.routes.tags import router as tags_router
from app.routes.search import router as search_router
from app.routes.upload import router as upload_router
from app.routes.llm import router as llm_router
from app.routes.settings import router as settings_router
from app.routes.collections import router as collections_router
from app.routes.profiles import router as profiles_router
from app.routes.events import router as events_router

api_router = APIRouter(prefix="/api")
api_router.include_router(items_router)
api_router.include_router(item_edges_router)
api_router.include_router(bookmarks_router)
api_router.include_router(tags_router)
api_router.include_router(search_router)
api_router.include_router(upload_router)
api_router.include_router(llm_router)
api_router.include_router(settings_router)
api_router.include_router(collections_router)
api_router.include_router(profiles_router)
api_router.include_router(events_router)
