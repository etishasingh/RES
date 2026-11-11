"""
PayPilot AI – SQLAlchemy database models.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    event,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

raw_db_url = os.environ.get("DATABASE_URL")
if raw_db_url:
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL = raw_db_url
else:
    db_path = os.environ.get("SQLITE_DB_PATH", os.path.join(os.path.dirname(__file__), "paypilot.db"))
    DATABASE_URL = f"sqlite:///{db_path}"

is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)


if is_sqlite:
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(254), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(Enum("freelancer", "client", name="role_enum"), nullable=False)
    headline = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    client_projects = relationship("Project", foreign_keys="Project.client_id", back_populates="client")
    freelancer_projects = relationship("Project", foreign_keys="Project.freelancer_id", back_populates="freelancer")
    invitations_sent = relationship("Invitation", foreign_keys="Invitation.client_id", back_populates="client")
    invitations_received = relationship("Invitation", foreign_keys="Invitation.freelancer_id", back_populates="freelancer")
    submissions = relationship("Submission", back_populates="freelancer")
    reviews_written = relationship("Review", foreign_keys="Review.client_id", back_populates="client")
    reviews_received = relationship("Review", foreign_keys="Review.freelancer_id", back_populates="freelancer")
    project_requests_sent = relationship("ProjectRequest", foreign_keys="ProjectRequest.freelancer_id", back_populates="freelancer")
    project_requests_received = relationship("ProjectRequest", foreign_keys="ProjectRequest.client_id", back_populates="client")
    freelancer_profile = relationship("FreelancerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    client_profile = relationship("ClientProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    impact_contributions = relationship("ImpactContribution", back_populates="user", cascade="all, delete-orphan")
    impact_badges = relationship("ImpactBadge", back_populates="user", cascade="all, delete-orphan")
    spotlight_purchases = relationship("SpotlightPurchase", back_populates="user", cascade="all, delete-orphan")

    def is_administrator(self) -> bool:
        return bool(
            self.is_admin
            or (
                self.email
                and (
                    self.email.startswith("admin@")
                    or self.email in ("admin@paypilot.ai", "admin@demo.paypilot", "client@demo.paypilot")
                )
            )
        )


class FreelancerProfile(Base):
    __tablename__ = "freelancer_profiles"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    profile_json = Column(Text, nullable=False, default="{}")
    onboarding_completed = Column(String(5), nullable=False, default="false")

    user = relationship("User", back_populates="freelancer_profile")

    def get_profile(self) -> dict:
        try:
            return json.loads(self.profile_json)
        except Exception:
            return {}

    def set_profile(self, data: dict) -> None:
        self.profile_json = json.dumps(data)


class ClientProfile(Base):
    __tablename__ = "client_profiles"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    industry = Column(String(100), nullable=True)
    website = Column(String(2048), nullable=True)
    location = Column(String(100), nullable=True)
    about = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="client_profile")


def _new_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'open', 'invited', 'assigned', 'active', 'in_review', 'completed', 'cancelled')",
            name="ck_projects_status",
        ),
        CheckConstraint(
            "pricing_type IS NULL OR pricing_type IN ('fixed', 'hourly', 'negotiable')",
            name="ck_projects_pricing_type",
        ),
        CheckConstraint("budget_min IS NULL OR budget_min >= 0", name="ck_projects_budget_min_nonnegative"),
        CheckConstraint("budget_max IS NULL OR budget_max >= 0", name="ck_projects_budget_max_nonnegative"),
        CheckConstraint(
            "budget_min IS NULL OR budget_max IS NULL OR budget_max >= budget_min",
            name="ck_projects_budget_range",
        ),
        CheckConstraint("hourly_rate IS NULL OR hourly_rate >= 0", name="ck_projects_hourly_rate_nonnegative"),
        Index("ix_projects_client_status", "client_id", "status"),
        Index("ix_projects_freelancer_status", "freelancer_id", "status"),
    )

    id = Column(String(36), primary_key=True, default=_new_id)
    client_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    freelancer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    skills = Column(JSON, nullable=False, default=list)
    budget_min = Column(Numeric(12, 2), nullable=True)
    budget_max = Column(Numeric(12, 2), nullable=True)
    hourly_rate = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    pricing_type = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="draft", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    client = relationship("User", foreign_keys=[client_id], back_populates="client_projects")
    freelancer = relationship("User", foreign_keys=[freelancer_id], back_populates="freelancer_projects")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    invitations = relationship("Invitation", back_populates="project", cascade="all, delete-orphan")
    requests = relationship("ProjectRequest", back_populates="project", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="project", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="project", cascade="all, delete-orphan")


class Milestone(Base):
    __tablename__ = "milestones"
    __table_args__ = (
        CheckConstraint(
            "status IN ('not_started', 'in_progress', 'submitted', 'under_review', 'accepted', 'paid', 'rejected', 'cancelled')",
            name="ck_milestones_status",
        ),
        CheckConstraint("amount >= 0", name="ck_milestones_amount_nonnegative"),
        Index("ix_milestones_project_status", "project_id", "status"),
    )

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    acceptance_criteria = Column(JSON, nullable=False, default=list)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="not_started", index=True)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    project = relationship("Project", back_populates="milestones")
    submissions = relationship("Submission", back_populates="milestone", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="milestone")
    payments = relationship("Payment", back_populates="milestone", cascade="all, delete-orphan")


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = (
        UniqueConstraint("project_id", "freelancer_id", name="uq_invitations_project_freelancer"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')",
            name="ck_invitations_status",
        ),
        Index("ix_invitations_freelancer_status", "freelancer_id", "status"),
        Index("ix_invitations_client_status", "client_id", "status"),
    )

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    freelancer_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    project = relationship("Project", back_populates="invitations")
    client = relationship("User", foreign_keys=[client_id], back_populates="invitations_sent")
    freelancer = relationship("User", foreign_keys=[freelancer_id], back_populates="invitations_received")


class ProjectRequest(Base):
    __tablename__ = "project_requests"
    __table_args__ = (
        UniqueConstraint("project_id", "freelancer_id", name="uq_project_requests_project_freelancer"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'cancelled')",
            name="ck_project_requests_status",
        ),
        Index("ix_project_requests_freelancer_status", "freelancer_id", "status"),
        Index("ix_project_requests_client_status", "client_id", "status"),
        Index("ix_project_requests_project_status", "project_id", "status"),
    )

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    freelancer_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    client_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    project = relationship("Project", back_populates="requests")
    freelancer = relationship("User", foreign_keys=[freelancer_id], back_populates="project_requests_sent")
    client = relationship("User", foreign_keys=[client_id], back_populates="project_requests_received")


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted', 'under_review', 'accepted', 'changes_requested', 'rejected')",
            name="ck_submissions_status",
        ),
        Index("ix_submissions_milestone_status", "milestone_id", "status"),
        Index("ix_submissions_freelancer_created", "freelancer_id", "created_at"),
    )

    id = Column(String(36), primary_key=True, default=_new_id)
    milestone_id = Column(String(36), ForeignKey("milestones.id", ondelete="CASCADE"), nullable=False, index=True)
    freelancer_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    deliverable_url = Column(String(2048), nullable=True)
    deliverable_text = Column(Text, nullable=True)
    deliverable_metadata = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    evaluation_result = Column(JSON, nullable=True)
    status = Column(String(20), nullable=False, default="submitted", index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    milestone = relationship("Milestone", back_populates="submissions")
    freelancer = relationship("User", back_populates="submissions")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("client_score IS NULL OR (client_score >= 0 AND client_score <= 100)", name="ck_reviews_client_score"),
        CheckConstraint("model_score IS NULL OR (model_score >= 0 AND model_score <= 100)", name="ck_reviews_model_score"),
        CheckConstraint("final_score IS NULL OR (final_score >= 0 AND final_score <= 100)", name="ck_reviews_final_score"),
        Index("ix_reviews_project_freelancer", "project_id", "freelancer_id"),
        Index("ix_reviews_milestone", "milestone_id"),
    )

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    milestone_id = Column(String(36), ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True, index=True)
    client_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    freelancer_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    client_score = Column(Numeric(5, 2), nullable=True)
    model_score = Column(Numeric(5, 2), nullable=True)
    final_score = Column(Numeric(5, 2), nullable=True)
    feedback = Column(Text, nullable=True)
    evaluation_result = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    project = relationship("Project", back_populates="reviews")
    milestone = relationship("Milestone", back_populates="reviews")
    client = relationship("User", foreign_keys=[client_id], back_populates="reviews_written")
    freelancer = relationship("User", foreign_keys=[freelancer_id], back_populates="reviews_received")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_payments_amount_nonnegative"),
        CheckConstraint(
            "status IN ('created', 'paid_sandbox', 'failed', 'cancelled')",
            name="ck_payments_status",
        ),
        Index("ix_payments_client_status", "client_id", "status"),
        Index("ix_payments_milestone_status", "milestone_id", "status"),
    )

    id = Column(String(36), primary_key=True, default=_new_id)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    milestone_id = Column(String(36), ForeignKey("milestones.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    freelancer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    provider = Column(String(32), nullable=False, default="paypal_sandbox")
    paypal_order_id = Column(String(64), unique=True, nullable=False, index=True)
    paypal_capture_id = Column(String(64), unique=True, nullable=True, index=True)
    status = Column(String(20), nullable=False, default="created", index=True)
    raw_response = Column(JSON, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    project = relationship("Project", back_populates="payments")
    milestone = relationship("Milestone", back_populates="payments")
    client = relationship("User", foreign_keys=[client_id])
    freelancer = relationship("User", foreign_keys=[freelancer_id])


def _migrate_milestones_paid_status(bind_engine=engine) -> None:
    """Rebuild SQLite milestones table if its CHECK constraint lacks the 'paid' status."""
    if bind_engine.dialect.name != "sqlite":
        return
    raw_conn = bind_engine.raw_connection()
    try:
        dbapi_conn = raw_conn.driver_connection
        prev_isolation = dbapi_conn.isolation_level
        dbapi_conn.isolation_level = None
        cursor = dbapi_conn.cursor()
        try:
            row = cursor.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='milestones'"
            ).fetchone()
            if not row or not row[0] or "'paid'" in row[0]:
                return
            cursor.execute("PRAGMA foreign_keys=OFF")
            cursor.execute("BEGIN")
            try:
                cursor.execute(
                    """
                    CREATE TABLE milestones_new (
                        id VARCHAR(36) NOT NULL,
                        project_id VARCHAR(36) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        description TEXT,
                        acceptance_criteria JSON NOT NULL,
                        amount NUMERIC(12, 2) NOT NULL,
                        status VARCHAR(20) NOT NULL,
                        due_date DATE,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        PRIMARY KEY (id),
                        CONSTRAINT ck_milestones_status CHECK (status IN ('not_started', 'in_progress', 'submitted', 'under_review', 'accepted', 'paid', 'rejected', 'cancelled')),
                        CONSTRAINT ck_milestones_amount_nonnegative CHECK (amount >= 0),
                        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
                    )
                    """
                )
                cursor.execute(
                    """
                    INSERT INTO milestones_new (id, project_id, title, description, acceptance_criteria, amount, status, due_date, created_at, updated_at)
                    SELECT id, project_id, title, description, acceptance_criteria, amount, status, due_date, created_at, updated_at FROM milestones
                    """
                )
                cursor.execute("DROP TABLE milestones")
                cursor.execute("ALTER TABLE milestones_new RENAME TO milestones")
                cursor.execute("CREATE INDEX IF NOT EXISTS ix_milestones_project_id ON milestones (project_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS ix_milestones_status ON milestones (status)")
                cursor.execute("CREATE INDEX IF NOT EXISTS ix_milestones_project_status ON milestones (project_id, status)")
                cursor.execute("COMMIT")
            except Exception:
                cursor.execute("ROLLBACK")
                raise
            finally:
                cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()
            dbapi_conn.isolation_level = prev_isolation
    finally:
        raw_conn.close()


def _migrate_users_is_admin(bind_engine=engine) -> None:
    """Ensure existing SQLite users table includes the is_admin column."""
    if bind_engine.dialect.name != "sqlite":
        return
    with bind_engine.connect() as conn:
        cols = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
        if not cols:
            return
        if any(col[1] == "is_admin" for col in cols):
            return
        conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"))
        conn.commit()


# =============================================================================
# PAYPILOT IMPACT MODELS
# =============================================================================

class ImpactFundTransaction(Base):
    """Append-only audit ledger recording revenue allocations to the Impact fund."""
    __tablename__ = "impact_fund_transactions"

    id = Column(String(36), primary_key=True, default=_new_id)
    source_type = Column(String(32), nullable=False, index=True)
    source_transaction_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    gross_amount_cents = Column(Integer, nullable=False, default=0)
    platform_revenue_cents = Column(Integer, nullable=False, default=0)
    allocated_amount_cents = Column(Integer, nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="USD")
    allocation_percentage = Column(Float, nullable=False, default=30.0)
    status = Column(String(32), nullable=False, default="allocated", index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    __table_args__ = (
        UniqueConstraint("source_type", "source_transaction_id", name="uq_impact_tx_source"),
        Index("ix_impact_tx_source_status", "source_type", "status"),
        {"extend_existing": True},
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source_type": self.source_type,
            "source_transaction_id": self.source_transaction_id,
            "user_id": self.user_id,
            "gross_amount_cents": self.gross_amount_cents,
            "gross_amount": round(self.gross_amount_cents / 100.0, 2),
            "platform_revenue_cents": self.platform_revenue_cents,
            "platform_revenue": round(self.platform_revenue_cents / 100.0, 2),
            "allocated_amount_cents": self.allocated_amount_cents,
            "allocated_amount": round(self.allocated_amount_cents / 100.0, 2),
            "currency": self.currency,
            "allocation_percentage": self.allocation_percentage,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ImpactInitiative(Base):
    """Verified social impact causes and initiatives supported by the platform."""
    __tablename__ = "impact_initiatives"

    id = Column(String(36), primary_key=True, default=_new_id)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(64), nullable=False, index=True)
    target_amount_cents = Column(Integer, nullable=False, default=0)
    allocated_amount_cents = Column(Integer, nullable=False, default=0)
    disbursed_amount_cents = Column(Integer, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="active", index=True)
    organization_name = Column(String(255), nullable=False)
    verification_status = Column(String(32), nullable=False, default="verified")
    image_url = Column(String(2048), nullable=True)
    evidence_url = Column(String(2048), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    disbursements = relationship("ImpactDisbursement", back_populates="initiative", cascade="all, delete-orphan")

    __table_args__ = {"extend_existing": True}

    def to_dict(self) -> dict:
        target = self.target_amount_cents or 0
        allocated = self.allocated_amount_cents or 0
        progress_pct = round((allocated / target * 100.0), 1) if target > 0 else 0.0
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "target_amount_cents": self.target_amount_cents,
            "target_amount": round(self.target_amount_cents / 100.0, 2),
            "allocated_amount_cents": self.allocated_amount_cents,
            "allocated_amount": round(self.allocated_amount_cents / 100.0, 2),
            "disbursed_amount_cents": self.disbursed_amount_cents,
            "disbursed_amount": round(self.disbursed_amount_cents / 100.0, 2),
            "progress_percentage": min(progress_pct, 100.0),
            "status": self.status,
            "organization_name": self.organization_name,
            "verification_status": self.verification_status,
            "image_url": self.image_url,
            "evidence_url": self.evidence_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ImpactContribution(Base):
    """User contribution credits towards verified social impact initiatives."""
    __tablename__ = "impact_contributions"

    id = Column(String(36), primary_key=True, default=_new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String(32), nullable=False)
    source_transaction_id = Column(String(64), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="USD")
    status = Column(String(32), nullable=False, default="verified", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    user = relationship("User", back_populates="impact_contributions")

    __table_args__ = (
        UniqueConstraint("source_type", "source_transaction_id", name="uq_impact_contrib_source"),
        {"extend_existing": True},
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "source_type": self.source_type,
            "source_transaction_id": self.source_transaction_id,
            "amount_cents": self.amount_cents,
            "amount": round(self.amount_cents / 100.0, 2),
            "currency": self.currency,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ImpactDisbursement(Base):
    """Auditable disbursements released to verified organizations."""
    __tablename__ = "impact_disbursements"

    id = Column(String(36), primary_key=True, default=_new_id)
    initiative_id = Column(String(36), ForeignKey("impact_initiatives.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    recipient = Column(String(255), nullable=False)
    reference_id = Column(String(128), nullable=False, unique=True, index=True)
    verification_status = Column(String(32), nullable=False, default="verified")
    evidence_url = Column(String(2048), nullable=True)
    notes = Column(Text, nullable=True)
    disbursed_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    initiative = relationship("ImpactInitiative", back_populates="disbursements")

    __table_args__ = {"extend_existing": True}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "initiative_id": self.initiative_id,
            "initiative_title": self.initiative.title if self.initiative else None,
            "amount_cents": self.amount_cents,
            "amount": round(self.amount_cents / 100.0, 2),
            "recipient": self.recipient,
            "reference_id": self.reference_id,
            "verification_status": self.verification_status,
            "evidence_url": self.evidence_url,
            "notes": self.notes,
            "disbursed_at": self.disbursed_at.isoformat() if self.disbursed_at else None,
        }


class ImpactBadge(Base):
    """Reputation badges awarded strictly for verified contributions."""
    __tablename__ = "impact_badges"

    id = Column(String(36), primary_key=True, default=_new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_type = Column(String(32), nullable=False, index=True)
    verified_contribution_total_cents = Column(Integer, nullable=False, default=0)
    earned_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    visibility = Column(String(16), nullable=False, default="public")

    user = relationship("User", back_populates="impact_badges")

    __table_args__ = (
        UniqueConstraint("user_id", "badge_type", name="uq_user_badge_type"),
        {"extend_existing": True},
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "badge_type": self.badge_type,
            "verified_contribution_total_cents": self.verified_contribution_total_cents,
            "verified_contribution_total": round(self.verified_contribution_total_cents / 100.0, 2),
            "earned_at": self.earned_at.isoformat() if self.earned_at else None,
            "visibility": self.visibility,
        }


class ImpactSettings(Base):
    """Configurable prototype allocation percentages."""
    __tablename__ = "impact_settings"

    id = Column(String(36), primary_key=True, default="default")
    fee_allocation_pct = Column(Float, nullable=False, default=30.0)
    spotlight_allocation_pct = Column(Float, nullable=False, default=20.0)
    subscription_allocation_pct = Column(Float, nullable=False, default=15.0)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = {"extend_existing": True}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "fee_allocation_pct": self.fee_allocation_pct,
            "spotlight_allocation_pct": self.spotlight_allocation_pct,
            "subscription_allocation_pct": self.subscription_allocation_pct,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# =============================================================================
# PAYPILOT SPOTLIGHT MODELS
# =============================================================================

class SpotlightPackage(Base):
    """Configurable paid visibility packages (hours and pricing)."""
    __tablename__ = "spotlight_packages"

    id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    price_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    duration_hours = Column(Integer, nullable=False)
    target_type = Column(String(32), nullable=False, default="both")
    description = Column(Text, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    purchases = relationship("SpotlightPurchase", back_populates="package")

    __table_args__ = {"extend_existing": True}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "price_cents": self.price_cents,
            "price": round(self.price_cents / 100.0, 2),
            "currency": self.currency,
            "duration_hours": self.duration_hours,
            "target_type": self.target_type,
            "description": self.description,
            "active": self.active,
        }


class SpotlightPurchase(Base):
    """Active or historical paid visibility engagement for a project or proposal."""
    __tablename__ = "spotlight_purchases"

    id = Column(String(36), primary_key=True, default=_new_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(32), nullable=False, index=True)
    target_id = Column(String(64), nullable=False, index=True)
    package_id = Column(String(36), ForeignKey("spotlight_packages.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    payment_status = Column(String(32), nullable=False, default="COMPLETED", index=True)
    payment_reference = Column(String(128), nullable=True)
    purchased_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    user = relationship("User", back_populates="spotlight_purchases")
    package = relationship("SpotlightPackage", back_populates="purchases")

    __table_args__ = (
        Index("ix_spotlight_target_status", "target_type", "target_id", "payment_status"),
        {"extend_existing": True},
    )

    def is_active(self) -> bool:
        if self.payment_status != "COMPLETED":
            return False
        now = datetime.now(timezone.utc)
        exp = self.expires_at
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp > now if exp else False

    def to_dict(self) -> dict:
        now = datetime.now(timezone.utc)
        exp = self.expires_at
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        seconds_left = max(0, int((exp - now).total_seconds())) if exp else 0
        return {
            "id": self.id,
            "user_id": self.user_id,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "package_id": self.package_id,
            "package_name": self.package.name if self.package else None,
            "amount_cents": self.amount_cents,
            "amount": round(self.amount_cents / 100.0, 2),
            "currency": self.currency,
            "payment_status": self.payment_status,
            "payment_reference": self.payment_reference,
            "purchased_at": self.purchased_at.isoformat() if self.purchased_at else None,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active(),
            "remaining_seconds": seconds_left,
        }


class SpotlightSettings(Base):
    """Platform-level controls for Spotlight feature enablement."""
    __tablename__ = "spotlight_settings"

    id = Column(String(36), primary_key=True, default="default")
    enabled = Column(Boolean, nullable=False, default=True)
    default_visibility_duration = Column(Integer, nullable=False, default=6)
    allow_proposal_spotlight = Column(Boolean, nullable=False, default=True)
    allow_project_spotlight = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = {"extend_existing": True}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "enabled": self.enabled,
            "default_visibility_duration": self.default_visibility_duration,
            "allow_proposal_spotlight": self.allow_proposal_spotlight,
            "allow_project_spotlight": self.allow_project_spotlight,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


def init_default_records(session: Session) -> None:
    """Seeds default packages, settings, and initiatives if absent."""
    if not session.query(SpotlightSettings).filter_by(id="default").first():
        session.add(SpotlightSettings(id="default", enabled=True, default_visibility_duration=6))

    if not session.query(ImpactSettings).filter_by(id="default").first():
        session.add(
            ImpactSettings(
                id="default",
                fee_allocation_pct=30.0,
                spotlight_allocation_pct=20.0,
                subscription_allocation_pct=15.0,
            )
        )

    default_pkgs = [
        {"id": "pkg_quick", "name": "Quick Spotlight", "price_cents": 1900, "duration_hours": 2, "target_type": "both", "description": "High-impact visual highlight across project search and proposals for 2 hours."},
        {"id": "pkg_featured", "name": "Featured Spotlight", "price_cents": 4900, "duration_hours": 6, "target_type": "both", "description": "Prominent Featured badge and golden border for 6 hours of maximum client focus."},
        {"id": "pkg_priority", "name": "Priority Spotlight", "price_cents": 9900, "duration_hours": 12, "target_type": "both", "description": "Extended 12-hour top spotlight placement for priority project and proposal visibility."},
    ]
    for p in default_pkgs:
        if not session.query(SpotlightPackage).filter_by(id=p["id"]).first():
            session.add(SpotlightPackage(**p))

    default_initiatives = [
        {
            "id": "init_digital_literacy",
            "title": "Rural Digital Literacy Academy",
            "description": "Funding digital skill bootcamps, open-source laptops, and broadband connectivity for remote learning centers across rural communities.",
            "category": "digital_literacy",
            "target_amount_cents": 500000,
            "allocated_amount_cents": 185000,
            "disbursed_amount_cents": 80000,
            "status": "active",
            "organization_name": "Digital Frontier Foundation",
            "verification_status": "verified",
            "evidence_url": "https://paypilot.ai/evidence/rural-digital-audit-2026.pdf",
        },
        {
            "id": "init_women_tech",
            "title": "Women in Tech Skill Accelerator",
            "description": "Providing specialized mentorship, AI training grants, and verified portfolio certifications for women entering software engineering.",
            "category": "women_empowerment",
            "target_amount_cents": 1000000,
            "allocated_amount_cents": 420000,
            "disbursed_amount_cents": 200000,
            "status": "active",
            "organization_name": "Ada Lovelace Initiative",
            "verification_status": "verified",
            "evidence_url": "https://paypilot.ai/evidence/women-tech-grant-disbursements.pdf",
        },
        {
            "id": "init_clean_energy",
            "title": "Clean Energy Computing Initiative",
            "description": "Subsidizing solar-powered micro-data clusters and clean compute energy for regional freelance developer hubs.",
            "category": "environmental_sustainability",
            "target_amount_cents": 800000,
            "allocated_amount_cents": 250000,
            "disbursed_amount_cents": 100000,
            "status": "active",
            "organization_name": "Green Grid Collective",
            "verification_status": "verified",
            "evidence_url": "https://paypilot.ai/evidence/clean-energy-datacenter-report.pdf",
        },
    ]
    for init_data in default_initiatives:
        if not session.query(ImpactInitiative).filter_by(id=init_data["id"]).first():
            session.add(ImpactInitiative(**init_data))

    default_disbursements = [
        {
            "id": "disb_001",
            "initiative_id": "init_digital_literacy",
            "amount_cents": 80000,
            "recipient": "Digital Frontier Foundation - Hardware Procurement",
            "reference_id": "DISB-2026-DF-001",
            "verification_status": "verified",
            "evidence_url": "https://paypilot.ai/evidence/rural-digital-receipts.pdf",
            "notes": "First tranche: 25 refurbished developer laptops delivered to rural learning center.",
        },
        {
            "id": "disb_002",
            "initiative_id": "init_women_tech",
            "amount_cents": 200000,
            "recipient": "Ada Lovelace Initiative - Grant Pool A",
            "reference_id": "DISB-2026-ALI-002",
            "verification_status": "verified",
            "evidence_url": "https://paypilot.ai/evidence/ada-grants-payouts.pdf",
            "notes": "Direct stipend disbursements to 20 bootcamp graduates.",
        },
        {
            "id": "disb_003",
            "initiative_id": "init_clean_energy",
            "amount_cents": 100000,
            "recipient": "Green Grid Collective - Solar Micro-Inverters",
            "reference_id": "DISB-2026-GGC-003",
            "verification_status": "verified",
            "evidence_url": "https://paypilot.ai/evidence/green-grid-invoice.pdf",
            "notes": "Purchase of solar battery backup arrays for decentralized coding hubs.",
        },
    ]
    for d in default_disbursements:
        if not session.query(ImpactDisbursement).filter_by(id=d["id"]).first():
            session.add(ImpactDisbursement(**d))

    session.commit()


def create_tables() -> None:
    _migrate_milestones_paid_status(engine)
    _migrate_users_is_admin(engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        init_default_records(session)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
