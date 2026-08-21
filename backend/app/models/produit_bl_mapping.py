from sqlmodel import SQLModel, Field


class ProduitBlMapping(SQLModel, table=True):
    __tablename__ = "produit_bl_mapping"

    bl_code: str = Field(primary_key=True, max_length=50)
    code_produit: str = Field(max_length=30)


class ProduitBlMappingCreate(SQLModel):
    bl_code: str
    code_produit: str


class ProduitBlMappingRead(SQLModel):
    bl_code: str
    code_produit: str
