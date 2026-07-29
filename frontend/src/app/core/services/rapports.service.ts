import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface RapportClient {
  nom_client: string;
  weeks: string[];
  semaines: Record<string, Record<string, number | null>>;
  totaux: Record<string, number | null>;
}

export interface ProductMeta {
  uom_vente: string | null;
  colisage: number | null;
  famille: string | null;
}

export interface RapportFacturation {
  fdv: string;
  periode: string;
  weeks: string[];
  products: string[];
  products_meta: Record<string, ProductMeta>;
  clients: RapportClient[];
}

@Injectable({ providedIn: 'root' })
export class RapportsService {
  private http = inject(HttpClient);

  getSourceStats(date_from: string, date_to: string, nom_fdv: string) {
    const p = new HttpParams()
      .set('date_from', date_from)
      .set('date_to', date_to)
      .set('nom_fdv', nom_fdv);
    return this.http.get<Record<string, { lignes: number }>>('/api/v1/rapports/source-stats', { params: p });
  }

  getClients(date_from: string, date_to: string, nom_fdv: string, source: string) {
    const p = new HttpParams()
      .set('date_from', date_from)
      .set('date_to', date_to)
      .set('nom_fdv', nom_fdv)
      .set('source', source);
    return this.http.get<string[]>('/api/v1/rapports/facturation-clients', { params: p });
  }

  getFacturation(date_from: string, date_to: string, nom_fdv: string, clients: string[], source: string) {
    let p = new HttpParams()
      .set('date_from', date_from)
      .set('date_to', date_to)
      .set('nom_fdv', nom_fdv)
      .set('source', source);
    clients.forEach(c => (p = p.append('clients', c)));
    return this.http.get<RapportFacturation>('/api/v1/rapports/facturation', { params: p });
  }

  exportClientsZip(date_from: string, date_to: string, nom_fdv: string, clients: string[], displayMode: string, source: string) {
    let p = new HttpParams()
      .set('date_from', date_from)
      .set('date_to', date_to)
      .set('nom_fdv', nom_fdv)
      .set('display_mode', displayMode)
      .set('source', source);
    clients.forEach(c => (p = p.append('clients', c)));
    return this.http.get('/api/v1/rapports/export-clients-zip', { params: p, responseType: 'blob' });
  }
}
