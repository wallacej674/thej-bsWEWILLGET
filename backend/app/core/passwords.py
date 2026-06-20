from pwdlib import PasswordHash

MINIMUM_PASSWORD_LENGTH = 12
MAXIMUM_PASSWORD_BYTES = 1024


class PasswordPolicyError(ValueError):
    """Raised when a submitted password does not meet the local policy."""


password_hasher = PasswordHash.recommended()


def validate_password(password: str) -> None:
    """Validate a password without altering its user-provided value."""
    if len(password) < MINIMUM_PASSWORD_LENGTH:
        raise PasswordPolicyError(
            f"Password must be at least {MINIMUM_PASSWORD_LENGTH} characters."
        )
    if len(password.encode("utf-8")) > MAXIMUM_PASSWORD_BYTES:
        raise PasswordPolicyError(
            f"Password must not exceed {MAXIMUM_PASSWORD_BYTES} UTF-8 bytes."
        )


def hash_password(password: str) -> str:
    validate_password(password)
    return password_hasher.hash(password)


def verify_and_upgrade(password: str, password_hash: str) -> tuple[bool, str | None]:
    """Verify a stored hash and return a replacement when pwdlib upgrades it."""
    try:
        return password_hasher.verify_and_update(password, password_hash)
    except Exception:
        # Stored password hashes are security-sensitive persisted input. A
        # malformed value is treated exactly like an invalid credential.
        return False, None


def dummy_verify(password: str) -> None:
    """Equalize unknown-user login timing without retaining an account secret."""
    # This constant is an Argon2 hash of a non-user, non-deployable value.
    dummy_hash = (
        "$argon2id$v=19$m=65536,t=3,p=4$O1fYuY/3/zekeAurIF4pHA$"
        "GSIXyALA8xTCuVV0x9N780L9KMCpcXk7RJS5GKdsxBo"
    )
    verify_and_upgrade(password, dummy_hash)
