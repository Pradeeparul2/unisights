import inspect
import asyncio

class Unisights:
    def __init__(self, handler=None):
        self.handler = handler

    async def process(self, payload, request=None):
        if not self.handler:
            return

        if inspect.iscoroutinefunction(self.handler):
            await self.handler(payload, request)
        else:
            self.handler(payload, request)