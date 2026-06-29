from fastapi import HTTPException
from sqlalchemy.orm import Session


def get_or_404(db: Session, model, ident: str):
    obj = db.get(model, ident)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return obj
