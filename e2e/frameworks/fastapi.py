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

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/test/events")
async def get_events():
    return events[-1] if events else None

@app.get("/test/clear")
async def clear_events():
    global events
    events = []
    return {"cleared": True}

options = UnisightsOptions(
    path="/collect-fastapi/event",
    handler=handle_event,
    debug=True
)

router = unisights_fastapi(options)
app.include_router(router)