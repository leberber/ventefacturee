import io

import pandas as pd


def parse_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Receives raw bytes from FastAPI UploadFile, returns cleaned DataFrame."""
    df = pd.read_excel(io.BytesIO(file_bytes), header=1)
    df.columns = df.columns.str.strip().str.replace('\n', '', regex=False)
    df['Date'] = pd.to_datetime(df['Date'], dayfirst=True, errors='coerce')
    return df
