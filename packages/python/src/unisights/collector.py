"""
Core event collector for Unisights.

Handles async/sync handler execution with proper error handling and logging.
"""

import inspect
import logging
from typing import Callable, Optional, Any, Awaitable, Union

from .types import UnisightsPayload

logger = logging.getLogger(__name__)


class Unisights:
    """Core event collector for Unisights.
    
    Manages event processing with optional custom handlers.
    Supports both async and sync handler functions.
    
    Example:
        >>> async def handler(payload, request):
        ...     await db.save(payload.data)
        >>> 
        >>> collector = Unisights(handler=handler)
        >>> await collector.process(payload, request)
    """
    
    def __init__(
        self,
        handler: Optional[Callable[[UnisightsPayload, Any], Union[None, Awaitable[None]]]] = None,
        on_error: Optional[Callable[[UnisightsPayload, Exception], Awaitable[None]]] = None,
    ) -> None:
        """Initialize Unisights collector.
        
        Args:
            handler: Optional async or sync function to process events
            on_error: Optional async error handler callback
        """
        self.handler = handler
        self.on_error = on_error

    async def process(
        self,
        payload: UnisightsPayload,
        request: Optional[Any] = None
    ) -> bool:
        """Process an event payload.

        Args:
            payload: Validated UnisightsPayload
            request: Request object from framework

        Returns:
            True if successful, False otherwise

        Raises:
            Exception: If handler raises (with logging)
        """
        if not self.handler:
            return True

        try:
            if inspect.iscoroutinefunction(self.handler):
                await self.handler(payload, request)
            else:
                self.handler(payload, request)
            
            logger.debug(
                f"Event processed: {payload.data.asset_id} / {payload.data.session_id}"
            )
            return True
            
        except Exception as e:
            logger.error(
                f"Handler error: {e}",
                exc_info=True,
                extra={
                    "asset_id": payload.data.asset_id,
                    "session_id": payload.data.session_id,
                }
            )
            await self._handle_error(payload, e)
            raise

    async def _handle_error(
        self,
        payload: UnisightsPayload,
        error: Exception
    ) -> None:
        """Call error handler if configured.

        Args:
            payload: Original event payload
            error: The exception that occurred
        """
        if not self.on_error:
            return

        try:
            if inspect.iscoroutinefunction(self.on_error):
                await self.on_error(payload, error)
            else:
                self.on_error(payload, error)
        except Exception as e:
            logger.error(f"Error handler failed: {e}", exc_info=True)