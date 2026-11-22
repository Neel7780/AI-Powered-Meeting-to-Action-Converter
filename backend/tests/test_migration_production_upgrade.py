"""Production-style migration upgrade verification test.

Verifies:
1. Supabase migration history consistency: all migration versions are unique and monotonic.
2. The chat migration has a fresh, unique timestamp version (20261121000000) that does not
   collide with meeting speaker mapping (20261118000000) or any other migration on main.
3. The migration file has no explicit BEGIN/COMMIT statements, letting the Supabase runner
   manage the transaction and record the migration version atomically.
4. Simulates the Supabase CLI runner upgrade flow against the complete migration sequence.
"""

from pathlib import Path
import re
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"


def extract_migration_version(filename: str) -> str:
    match = re.match(r"^(\d+)_", filename)
    if not match:
        raise ValueError(f"Invalid migration filename format: {filename}")
    return match.group(1)


def test_migration_versions_unique_and_no_collision():
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)
    assert len(migration_files) >= 10

    seen_versions: dict[str, str] = {}
    for mf in migration_files:
        version = extract_migration_version(mf.name)
        if version in seen_versions:
            pytest.fail(
                f"Duplicate migration version {version} detected in {mf.name} "
                f"and {seen_versions[version]}. Supabase schema_migrations will fail!"
            )
        seen_versions[version] = mf.name

    # Check chat migration specifically
    assert "20261121000000" in seen_versions, "20261121000000_slack_chat_system.sql must exist"
    assert seen_versions["20261121000000"] == "20261121000000_slack_chat_system.sql"

    # Verify 20261118000000 is uniquely assigned to meeting_speaker_mapping
    assert seen_versions["20261118000000"] == "20261118000000_meeting_speaker_mapping.sql"


def test_chat_migration_runner_manages_transaction():
    chat_mig = MIGRATIONS_DIR / "20261121000000_slack_chat_system.sql"
    assert chat_mig.exists(), f"Chat migration missing at {chat_mig}"

    content = chat_mig.read_text(encoding="utf-8")
    content_lower = content.lower()

    # The runner must manage the transaction; standalone begin/commit must NOT be in the script
    assert "begin;" not in content_lower, "Explicit 'begin;' found. Runner must manage transaction."
    assert "commit;" not in content_lower, "Explicit 'commit;' found. Runner must manage transaction."


def test_simulate_production_migration_runner_upgrade():
    """Simulates Supabase CLI `supabase db push --include-all` migration runner."""
    schema_migrations_table: set[str] = set()

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)

    # 1. Existing baseline migrations already recorded on production main
    baseline_versions = [
        "0001", "0002", "0003", "0004", "0005", "0006", "0007",
        "20261104170746", "20261114000000", "20261114000001",
        "20261117094527", "20261118000000", "20261118151500",
        "20261119000000"
    ]
    for bv in baseline_versions:
        schema_migrations_table.add(bv)

    # 2. Simulate upgrade push
    pending_to_apply = []
    for mf in migration_files:
        ver = extract_migration_version(mf.name)
        if ver not in schema_migrations_table:
            pending_to_apply.append(mf)

    # The chat migration must be in the pending list and successfully recordable
    chat_file = MIGRATIONS_DIR / "20261121000000_slack_chat_system.sql"
    assert chat_file in pending_to_apply

    for mf in pending_to_apply:
        ver = extract_migration_version(mf.name)
        # Runner executes migration inside a managed transaction:
        # BEGIN -> execute SQL -> INSERT INTO schema_migrations -> COMMIT
        sql = mf.read_text(encoding="utf-8")
        assert len(sql.strip()) > 0

        # Verify no duplicate key error on insert
        assert ver not in schema_migrations_table, f"Version {ver} collision during upgrade!"
        schema_migrations_table.add(ver)

    # Verify chat migration version was recorded successfully
    assert "20261121000000" in schema_migrations_table
