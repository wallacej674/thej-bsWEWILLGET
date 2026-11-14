from collections.abc import Callable

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.core.settings import get_settings
from app.services.rate_limit import enforce


def limit_per_user(rule: str, setting: str) -> Callable[..., None]:
    """A dependency counting each request against the signed-in user.

    `setting` names the Settings field holding the rate, e.g.
    "rate_limit_autofill_per_user", so it can be tuned per deploy.
    """

    def dependency(current_user: CurrentUser, session: DatabaseSession) -> None:
        enforce(session, rule, str(current_user.id), getattr(get_settings(), setting))

    return dependency
