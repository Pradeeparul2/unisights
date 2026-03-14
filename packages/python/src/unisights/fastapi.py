from fastapi import APIRouter, Request
from .collector import Unisights

def unisights_fastapi(path="/collect/event", handler=None):

    router = APIRouter()
    collector = Unisights(handler)

    @router.post(path)
    async def collect(request: Request):
        payload = await request.json()

        await collector.process(payload, request)

        return {"status": "ok"}

    return router