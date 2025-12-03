from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/activities", tags=["Activities"])


class TypingActivityParams(BaseModel):
    characters: List[str]
    total_bubbles: int
    speed: float  # pixels per frame


@router.get("/typing/params", response_model=TypingActivityParams)
async def get_typing_params():
    """
    Returns parameters for the typing activity.
    By default, returns letters from the top row of the keyboard
    (q,w,e,r,t,y,u,i,o,p), 15 bubbles and slow speed
    (1.5 pixels per frame).
    """
    return TypingActivityParams(
        characters=["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        total_bubbles=15,
        speed=1.5  # Slow speed
    )
