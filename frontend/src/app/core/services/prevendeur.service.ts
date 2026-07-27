import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface PrevClient {
  nom_client: string;
  code_client: string | null;
  derniere_visite: string | null;
  weeks: string[];
  semaines: Record<string, Record<string, number | null>>;
  totaux: Record<string, number | null>;
}

export interface PrevRoute {
  route: string;
  clients: PrevClient[];
}

export interface PrevProductMeta {
  uom_vente: string | null;
  colisage: number | null;
  famille: string | null;
}

export interface PrevFacturation {
  fdv_nom: string;
  periode: string;
  products: string[];
  products_meta: Record<string, PrevProductMeta>;
  total_clients: number;
  routes: PrevRoute[];
}

@Injectable({ providedIn: 'root' })
export class PrevendeurService {
  private http = inject(HttpClient);

  getPeriodes() {
    return this.http.get<string[]>('/api/v1/prevendeur/periodes');
  }

  getFacturation(annee_mois: string) {
    const p = new HttpParams().set('annee_mois', annee_mois);
    return this.http.get<PrevFacturation>('/api/v1/prevendeur/facturation', { params: p });
  }
}
