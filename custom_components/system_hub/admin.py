"""Actions for administrators only that also return a response."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from functools import wraps

from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse
from homeassistant.exceptions import Unauthorized, UnknownUser


def admin_only(
    hass: HomeAssistant, handler: Callable[[ServiceCall], Awaitable[ServiceResponse]]
) -> Callable[[ServiceCall], Awaitable[ServiceResponse]]:
    """Refuse calls from non-admin users, like async_register_admin_service (which takes no supports_response
    on the oldest versions supported). Calls without a user (automations, scripts) are allowed."""

    @wraps(handler)
    async def wrapper(call: ServiceCall) -> ServiceResponse:
        if call.context.user_id:
            user = await hass.auth.async_get_user(call.context.user_id)
            if user is None:
                raise UnknownUser(context=call.context)
            if not user.is_admin:
                raise Unauthorized(context=call.context)
        return await handler(call)

    return wrapper
