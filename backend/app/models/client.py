from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class ClientCategory(str, Enum):
    GROS = "gros"
    DETAIL = "detail"
    HORECA = "horeca"


class Client(SQLModel, table=True):
    __tablename__ = "clients"

    id: Optional[int] = Field(default=None, primary_key=True)
    # BDD identifiers
    customer_no: Optional[str] = Field(default=None, max_length=50)
    code_sodichn: Optional[str] = Field(default=None, max_length=50)
    nom_sodichn: Optional[str] = Field(default=None, max_length=200)
    # Identity
    name: str = Field(max_length=150, index=True)
    first_name: Optional[str] = Field(default=None, max_length=60)
    last_name: Optional[str] = Field(default=None, max_length=60)
    store_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    # Classification
    category: ClientCategory = Field(default=ClientCategory.GROS)
    type_client: Optional[str] = Field(default=None, max_length=50)
    categorie_bdd: Optional[str] = Field(default=None, max_length=10)
    tarification: Optional[str] = Field(default=None, max_length=50)
    vendeur: Optional[str] = Field(default=None, max_length=100)
    route_id: Optional[str] = Field(default=None, max_length=50)
    buid: Optional[str] = Field(default=None, max_length=50)
    status_bdd: Optional[int] = Field(default=None)
    # Location
    wilaya: Optional[str] = Field(default=None, max_length=100)
    region: Optional[str] = Field(default=None, max_length=100)
    daira: Optional[str] = Field(default=None, max_length=60)
    commune: Optional[str] = Field(default=None, max_length=60)
    address: Optional[str] = Field(default=None, max_length=200)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    # Fiscal
    rc: Optional[str] = Field(default=None, max_length=100)
    nif: Optional[str] = Field(default=None, max_length=100)
    ai: Optional[str] = Field(default=None, max_length=100)
    activite_sodichn: Optional[str] = Field(default=None, max_length=200)
    # Meta
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)


class ClientCreate(SQLModel):
    customer_no: Optional[str] = None
    code_sodichn: Optional[str] = None
    nom_sodichn: Optional[str] = None
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    store_name: Optional[str] = None
    phone: Optional[str] = None
    category: ClientCategory = ClientCategory.GROS
    type_client: Optional[str] = None
    categorie_bdd: Optional[str] = None
    tarification: Optional[str] = None
    vendeur: Optional[str] = None
    route_id: Optional[str] = None
    buid: Optional[str] = None
    status_bdd: Optional[int] = None
    wilaya: Optional[str] = None
    region: Optional[str] = None
    daira: Optional[str] = None
    commune: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rc: Optional[str] = None
    nif: Optional[str] = None
    ai: Optional[str] = None
    activite_sodichn: Optional[str] = None


class ClientUpdate(SQLModel):
    customer_no: Optional[str] = None
    code_sodichn: Optional[str] = None
    nom_sodichn: Optional[str] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    store_name: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[ClientCategory] = None
    type_client: Optional[str] = None
    categorie_bdd: Optional[str] = None
    tarification: Optional[str] = None
    vendeur: Optional[str] = None
    route_id: Optional[str] = None
    buid: Optional[str] = None
    status_bdd: Optional[int] = None
    wilaya: Optional[str] = None
    region: Optional[str] = None
    daira: Optional[str] = None
    commune: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rc: Optional[str] = None
    nif: Optional[str] = None
    ai: Optional[str] = None
    activite_sodichn: Optional[str] = None
    is_active: Optional[bool] = None


class ClientRead(SQLModel):
    model_config = {"from_attributes": True}

    id: int
    customer_no: Optional[str] = None
    code_sodichn: Optional[str] = None
    nom_sodichn: Optional[str] = None
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    store_name: Optional[str] = None
    phone: Optional[str] = None
    category: ClientCategory
    type_client: Optional[str] = None
    categorie_bdd: Optional[str] = None
    tarification: Optional[str] = None
    vendeur: Optional[str] = None
    route_id: Optional[str] = None
    buid: Optional[str] = None
    status_bdd: Optional[int] = None
    wilaya: Optional[str] = None
    region: Optional[str] = None
    daira: Optional[str] = None
    commune: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rc: Optional[str] = None
    nif: Optional[str] = None
    ai: Optional[str] = None
    activite_sodichn: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
