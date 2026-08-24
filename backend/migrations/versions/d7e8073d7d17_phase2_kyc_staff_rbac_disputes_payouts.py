"""phase2 kyc staff rbac disputes payouts

Revision ID: d7e8073d7d17
Revises: 73d48561e5d4
Create Date: 2026-08-22 09:59:57.989912

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd7e8073d7d17'
down_revision: Union[str, None] = '73d48561e5d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == 'postgresql'

    # ── complaint_messages table (no enum columns, fine on all dialects) ──
    op.create_table('complaint_messages',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('complaint_id', sa.String(), nullable=False),
    sa.Column('sender_user_id', sa.String(), nullable=False),
    sa.Column('sender_role', sa.String(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['complaint_id'], ['complaints.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sender_user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_complaintmsg_complaint_created', 'complaint_messages', ['complaint_id', 'created_at'], unique=False)

    if is_postgres:
        # ── Postgres path ─────────────────────────────────────────────────

        # 1. staffrole: new enum type — must be created before any column
        #    references it. op.add_column with sa.Enum() on Postgres would
        #    try to reference a type that doesn't exist yet.
        staffrole_enum = postgresql.ENUM(
            'SUPER_ADMIN', 'OPERATIONS', 'VERIFICATION', 'SUPPORT', 'FINANCE',
            name='staffrole',
        )
        staffrole_enum.create(bind, checkfirst=True)
        op.add_column('admin_profiles', sa.Column(
            'staff_role', staffrole_enum, nullable=False, server_default='OPERATIONS',
        ))

        # 2. complainttype: new enum type — same pattern as staffrole
        complainttype_enum = postgresql.ENUM(
            'COMPLAINT', 'DISPUTE',
            name='complainttype',
        )
        complainttype_enum.create(bind, checkfirst=True)
        op.add_column('complaints', sa.Column(
            'type', complainttype_enum, nullable=False, server_default='COMPLAINT',
        ))

        # 3. complaintstatus: EXISTING type (created in the init migration
        #    with 4 values: OPEN, IN_REVIEW, RESOLVED, DISMISSED).
        #    We need to ADD 'AWAITING_INFO' and 'CLOSED' to it.
        #    Postgres requires ALTER TYPE ADD VALUE to run outside a
        #    transaction (autocommit_block). We use IF NOT EXISTS so this is
        #    idempotent if partially applied.
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE complaintstatus ADD VALUE IF NOT EXISTS 'AWAITING_INFO'")
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE complaintstatus ADD VALUE IF NOT EXISTS 'CLOSED'")

        # Foreign key for assigned_staff_id is a plain ALTER TABLE — fine on Postgres
        op.add_column('complaints', sa.Column('assigned_staff_id', sa.String(), nullable=True))
        op.create_foreign_key(
            'fk_complaints_assigned_staff_id_users',
            'complaints', 'users',
            ['assigned_staff_id'], ['id'],
        )

    else:
        # ── SQLite path (local dev/test) ───────────────────────────────────
        # SQLite has no native ENUM — SQLAlchemy represents them as VARCHAR
        # + CHECK constraint. batch_alter_table is the only way to alter
        # columns on SQLite (it recreates the table). The complaintstatus
        # alter_column widens the VARCHAR check — a safe no-op on SQLite
        # since CHECK constraints aren't enforced.

        op.add_column('admin_profiles', sa.Column(
            'staff_role',
            sa.Enum('SUPER_ADMIN', 'OPERATIONS', 'VERIFICATION', 'SUPPORT', 'FINANCE', name='staffrole'),
            nullable=False, server_default='OPERATIONS',
        ))

        op.add_column('complaints', sa.Column(
            'type',
            sa.Enum('COMPLAINT', 'DISPUTE', name='complainttype'),
            nullable=False, server_default='COMPLAINT',
        ))

        op.add_column('complaints', sa.Column('assigned_staff_id', sa.String(), nullable=True))

        with op.batch_alter_table('complaints', schema=None) as batch_op:
            batch_op.alter_column('status',
                       existing_type=sa.VARCHAR(length=9),
                       type_=sa.Enum('OPEN', 'IN_REVIEW', 'AWAITING_INFO', 'RESOLVED', 'CLOSED', 'DISMISSED', name='complaintstatus'),
                       existing_nullable=False)
            batch_op.create_foreign_key('fk_complaints_assigned_staff_id_users', 'users', ['assigned_staff_id'], ['id'])

    # ── Indexes shared between dialects ────────────────────────────────────
    op.add_column('admin_profiles', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_admin_profiles_staff_role'), 'admin_profiles', ['staff_role'], unique=False)

    # ── worker_profiles KYC columns (no enum, fine on all dialects) ────────
    # NOTE: same otp_codes.user_phone FK artifact noted in the previous
    # migration (never reflected in the ORM model); left untouched here too.
    op.add_column('worker_profiles', sa.Column('guardian_name', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('date_of_birth', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('gender', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('address_line', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('kyc_city', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('kyc_state', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('kyc_pincode', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('qualification', sa.String(), nullable=True))
    op.add_column('worker_profiles', sa.Column('previous_experience', sa.Text(), nullable=True))
    op.add_column('worker_profiles', sa.Column('kyc_submitted_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == 'postgresql'

    # ── worker_profiles KYC columns ─────────────────────────────────────
    op.drop_column('worker_profiles', 'kyc_submitted_at')
    op.drop_column('worker_profiles', 'previous_experience')
    op.drop_column('worker_profiles', 'qualification')
    op.drop_column('worker_profiles', 'kyc_pincode')
    op.drop_column('worker_profiles', 'kyc_state')
    op.drop_column('worker_profiles', 'kyc_city')
    op.drop_column('worker_profiles', 'address_line')
    op.drop_column('worker_profiles', 'gender')
    op.drop_column('worker_profiles', 'date_of_birth')
    op.drop_column('worker_profiles', 'guardian_name')

    if is_postgres:
        # Drop FK constraint before dropping the column
        op.drop_constraint('fk_complaints_assigned_staff_id_users', 'complaints', type_='foreignkey')
        op.drop_column('complaints', 'assigned_staff_id')
        op.drop_column('complaints', 'type')

        # Drop the complainttype enum type now that no column references it
        postgresql.ENUM(name='complainttype').drop(bind, checkfirst=True)

        # NOTE: 'complaintstatus' is NOT dropped here — Postgres has no
        # DROP VALUE for enum types. After downgrade the enum will retain
        # 'AWAITING_INFO' and 'CLOSED' in the type definition, but the
        # application code (also reverted) will not write those values, so
        # this is safe. The extra values in the type definition are harmless.

        op.drop_index(op.f('ix_admin_profiles_staff_role'), table_name='admin_profiles')
        op.drop_column('admin_profiles', 'last_login_at')
        op.drop_column('admin_profiles', 'staff_role')

        # Drop the staffrole enum type now that no column references it
        postgresql.ENUM(name='staffrole').drop(bind, checkfirst=True)

    else:
        # SQLite path
        with op.batch_alter_table('complaints', schema=None) as batch_op:
            batch_op.drop_constraint('fk_complaints_assigned_staff_id_users', type_='foreignkey')
            batch_op.alter_column('status',
                       existing_type=sa.Enum('OPEN', 'IN_REVIEW', 'AWAITING_INFO', 'RESOLVED', 'CLOSED', 'DISMISSED', name='complaintstatus'),
                       type_=sa.VARCHAR(length=9),
                       existing_nullable=False)
        op.drop_column('complaints', 'assigned_staff_id')
        op.drop_column('complaints', 'type')

        op.drop_index(op.f('ix_admin_profiles_staff_role'), table_name='admin_profiles')
        op.drop_column('admin_profiles', 'last_login_at')
        op.drop_column('admin_profiles', 'staff_role')

    # ── complaint_messages (no enum, same on all dialects) ─────────────
    op.drop_index('ix_complaintmsg_complaint_created', table_name='complaint_messages')
    op.drop_table('complaint_messages')
