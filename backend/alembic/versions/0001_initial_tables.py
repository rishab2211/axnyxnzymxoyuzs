"""initial tables

Revision ID: 0001_initial_tables
Revises: 
Create Date: 2026-11-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001_initial_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. actual_generation
    op.create_table(
        'actual_generation',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('publish_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('settlement_date', sa.Date(), nullable=False),
        sa.Column('settlement_period', sa.SmallInteger(), nullable=False),
        sa.Column('fuel_type', sa.String(length=20), nullable=False, server_default='WIND'),
        sa.Column('generation_mw', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('source_dataset', sa.String(length=20), nullable=False, server_default='FUELHH'),
        sa.Column('ingested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('raw_payload', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('start_time', 'fuel_type', name='uq_actual_start_fuel')
    )
    op.create_index('idx_ag_start_time', 'actual_generation', ['start_time'])
    op.create_index('idx_ag_publish_time', 'actual_generation', ['publish_time'])
    op.create_index('idx_ag_settlement_date', 'actual_generation', ['settlement_date'])
    op.create_index('idx_ag_start_publish', 'actual_generation', ['start_time', 'publish_time'])

    # 2. wind_forecasts
    op.create_table(
        'wind_forecasts',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('publish_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('generation_mw', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('source_dataset', sa.String(length=20), nullable=False, server_default='WINDFOR'),
        sa.Column('ingested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('raw_payload', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('start_time', 'publish_time', name='uq_forecast_start_publish')
    )
    op.create_index('idx_wf_start_time', 'wind_forecasts', ['start_time'])
    op.create_index('idx_wf_publish_time', 'wind_forecasts', ['publish_time'])
    op.create_index('idx_wf_start_publish', 'wind_forecasts', ['start_time', 'publish_time'])

    # 3. actual_generation_hourly
    op.create_table(
        'actual_generation_hourly',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('hour_start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('generation_mw', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('sp_count', sa.SmallInteger(), nullable=False, server_default='2'),
        sa.Column('ingested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hour_start_time', name='uq_actual_hourly_start')
    )
    op.create_index('idx_agh_hour_start', 'actual_generation_hourly', ['hour_start_time'])

    # 4. ingestion_runs
    op.create_table(
        'ingestion_runs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('dataset', sa.String(length=20), nullable=False),
        sa.Column('requested_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('requested_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='running'),
        sa.Column('records_received', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('records_inserted', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('records_updated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('records_rejected', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('ingestion_runs')
    op.drop_table('actual_generation_hourly')
    op.drop_table('wind_forecasts')
    op.drop_table('actual_generation')
