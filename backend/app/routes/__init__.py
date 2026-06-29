from fastapi import APIRouter

from app.routes.items import router as items_router
from app.routes.item_edges import router as item_edges_router
from app.routes.bookmarks import router as bookmarks_router
from app.routes.tags import router as tags_router
from app.routes.search import router as search_router
from app.routes.upload import router as upload_router

api_router = APIRouter(prefix="/api")
api_router.include_router(items_router)
api_router.include_router(item_edges_router)
api_router.include_router(bookmarks_router)
api_router.include_router(tags_router)
api_router.include_router(search_router)
api_router.include_router(upload_router)
