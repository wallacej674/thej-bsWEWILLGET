import pytest

from app.core.passwords import PasswordPolicyError, hash_password, verify_and_upgrade


def test_argon2_hash_verifies_the_original_unicode_password() -> None:
    password = "  correct horse 🐎 battery staple  "

    password_hash = hash_password(password)
    verified, upgraded_hash = verify_and_upgrade(password, password_hash)

    assert password_hash.startswith("$argon2")
    assert verified is True
    assert upgraded_hash is None


def test_password_policy_preserves_spaces_and_rejects_short_passwords() -> None:
    with pytest.raises(PasswordPolicyError):
        hash_password(" short ")
