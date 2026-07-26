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

  getClients(annee_mois: string, nom_fdv: string) {
    const p = new HttpParams().set('annee_mois', annee_mois).set('nom_fdv', nom_fdv);
    return this.http.get<string[]>('/api/v1/rapports/facturation-clients', { params: p });
  }

  getFacturation(annee_mois: string, nom_fdv: string, clients: string[]) {
    let p = new HttpParams().set('annee_mois', annee_mois).set('nom_fdv', nom_fdv);
    clients.forEach(c => (p = p.append('clients', c)));
    return this.http.get<RapportFacturation>('/api/v1/rapports/facturation', { params: p });
  }
}
