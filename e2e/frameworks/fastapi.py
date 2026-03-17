from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from unisights import UnisightsOptions
from unisights.fastapi import unisights_fastapi

app = FastAPI()
events = []

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def handle_event(payload: dict, request: Request):
    events.append(payload)

options = UnisightsOptions(
    path="/collect-fastapi/event",
    handler=handle_event,
    debug=True
)

@app.get("/test/events")
async def get_events():
    return events[-1] if events else None

router = unisights_fastapi(options)
app.include_router(router)