"""composite performance indices for high scale

Revision ID: e7a8b9c0d1e2
Revises: 4c264450bdb1
Create Date: 2026-08-28 18:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e7a8b9c0d1e2'
down_revision: str | Sequence[str] | None = '4c264450bdb1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # High performance composite indices for temporal conflict checks and status filtering
    op.create_index(
        'idx_reservations_env_dates_status',
        'reservations',
        ['environment_id', 'start_time', 'end_time', 'status'],
        unique=False
    )
    op.create_index(
        'idx_reservations_requester_status',
        'reservations',
        ['requester_id', 'status'],
        unique=False
    )
    op.create_index(
        'idx_calendar_blocks_env_dates',
        'calendar_blocks',
        ['environment_id', 'start_time', 'end_time'],
        unique=False
    )
    op.create_index(
        'idx_audit_records_entity_target_performed',
        'audit_records',
        ['entity_type', 'target_id', 'performed_at'],
        unique=False
    )
    op.create_index(
        'idx_notifications_user_read',
        'notifications',
        ['user_id', 'read', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('idx_notifications_user_read', table_name='notifications')
    op.drop_index('idx_audit_records_entity_target_performed', table_name='audit_records')
    op.drop_index('idx_calendar_blocks_env_dates', table_name='calendar_blocks')
    op.drop_index('idx_reservations_requester_status', table_name='reservations')
    op.drop_index('idx_reservations_env_dates_status', table_name='reservations')
