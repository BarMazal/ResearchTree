from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ItemEdge
from app.schemas.item_edge import ItemEdgeCreate, ItemEdgeRead
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/item-edges", tags=["item-edges"])


@router.get("", response_model=list[ItemEdgeRead])
def list_item_edges(db: Session = Depends(get_db)):
    return db.query(ItemEdge).all()


@router.post("", response_model=ItemEdgeRead, status_code=201)
def create_item_edge(body: ItemEdgeCreate, db: Session = Depends(get_db)):
    edge = ItemEdge(**body.model_dump())
    db.add(edge)
    db.commit()
    db.refresh(edge)
    return edge


@router.delete("/{edge_id}", status_code=204)
def delete_item_edge(edge_id: str, db: Session = Depends(get_db)):
    edge = get_or_404(db, ItemEdge, edge_id)
    db.delete(edge)
    db.commit()
