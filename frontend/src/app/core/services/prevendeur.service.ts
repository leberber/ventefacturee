import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface PrevClient {
  nom_client: string;
  code_client: string | null;
  nom_sodichn: string | null;
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

export interface PrevAdminStat {
  id: number;
  full_name: string;
  employe_code: string;
  total_clients: number;
  clients_with_sodichn: number;
  completion_pct: number;
  last_activity: string | null;
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

  updateNomSodichn(code_client: string, nom_sodichn: string, nom_client: string) {
    return this.http.patch(`/api/v1/prevendeur/clients/${encodeURIComponent(code_client)}`, { nom_sodichn, nom_client });
  }

  getAdminStats() {
    return this.http.get<PrevAdminStat[]>('/api/v1/prevendeur/admin/stats');
  }
}
