from typing import Any, Dict, Optional
from datetime import datetime, timezone

from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field


class AppConfig(SQLModel, table=True):
    __tablename__ = "app_config"

    key: str = Field(primary_key=True, max_length=100)
    value: Dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    updated_at: Optional[datetime] = Field(default=None)


class AppConfigUpdate(SQLModel):
    value: Dict[str, Any]
