from __future__ import annotations

import argparse
import getpass
import logging

from sqlalchemy import func, select

from app.db.session import get_session_factory
from app.models.user import User
from app.services.auth_service import AuthenticationService, normalize_email


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Set a local password for an existing ApplyTogether user."
    )
    parser.add_argument("--email", required=True, help="Existing user email address")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    password = getpass.getpass("New password: ")
    confirmation = getpass.getpass("Confirm new password: ")
    if password != confirmation:
        raise SystemExit("Passwords did not match; no change was made.")

    session = get_session_factory()()
    try:
        user = session.scalar(
            select(User).where(func.lower(User.email) == normalize_email(args.email))
        )
        if user is None:
            raise SystemExit("No existing user matches that email address.")
        AuthenticationService().reset_password(session, user=user, password=password)
        session.commit()
        logging.info("authentication.password_reset", extra={"user_id": str(user.id)})
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
