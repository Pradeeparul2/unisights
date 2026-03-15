import logging
import inspect
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class Unisights:
    def __init__(self, handler=None, on_error=None):
        self.handler = handler
        self.on_error = on_error  # Error callback

    async def process(self, payload: Dict[str, Any], request=None) -> bool:
        """Process event with error handling.
        
        Returns:
            bool: True if successful, False if error
        """
        if not self.handler:
            return True
            
        try:
            if inspect.iscoroutinefunction(self.handler):
                await self.handler(payload, request)
            else:
                self.handler(payload, request)
            logger.debug(f"Event processed: {payload.get('type', 'unknown')}")
            return True
        except Exception as e:
            logger.error(f"Handler error: {e}", exc_info=True)
            if self.on_error:
                try:
                    await self.on_error(payload, e)
                except Exception as e2:
                    logger.error(f"Error callback failed: {e2}")
            raise