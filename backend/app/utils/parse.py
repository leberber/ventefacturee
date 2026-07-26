import csv
import io
import re

import pandas as pd

QTY_COLS = [
    'Qte Commandée', 'Qte Chargée', 'Qte Livrée', 'Qte  Facturée',
    'Total Commandée', 'Total  Facturée',
    'Qte Commandée | Kg', 'Qte Chargée | Kg', 'Qte Livrée | Kg', 'Qte Facturée | Kg',
    'Qte Commandée | Tonne', 'Qte Chargée |  Tonne', 'Qte Livrée | Tonne', 'Qte Facturée | Tonne',
    'Total Remise', 'Gratuité',
    'Qte Commandée | PalettePalette', 'Qte Commandée | CS', 'Qte Commandée | UN',
    'Qte Chargée |  CS', 'Qte Livrée | CS', 'Qte Facturée | CSQte Facturée | CS',
    'Cout Produit', 'Prix Unitaire', 'Prix unitaire UOM PR',
]

QTE_FACT   = 'Qte  Facturée'   # double space — as in source file
TOTAL_FACT = 'Total  Facturée' # double space


def clean_df(df: pd.DataFrame) -> pd.DataFrame:
    for col in QTY_COLS:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace(',', '.', regex=False)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    df['Date'] = pd.to_datetime(df['Date'], dayfirst=True, errors='coerce')
    return df


def parse_csv(decoded_bytes: bytes) -> pd.DataFrame:
    rows = []
    for line in io.StringIO(decoded_bytes.decode('latin-1')):
        line = line.strip()
        if not line:
            continue
        if line.startswith('"') and line.endswith('"'):
            line = line[1:-1]
        line = line.replace('""', '"')
        rows.append(next(csv.reader(io.StringIO(line))))

    first = rows[0]
    data_start = next(i for i, v in enumerate(first) if re.match(r'\d{2}/\d{2}/\d{4}', v.strip()))
    col_names = [v.strip() for v in first[1:data_start]]
    data = [row[data_start: data_start + len(col_names)] for row in rows]
    return pd.DataFrame(data, columns=col_names)


def parse_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Receives raw bytes from FastAPI UploadFile, returns cleaned DataFrame."""
    if filename.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        df = parse_csv(file_bytes)
    return clean_df(df)
