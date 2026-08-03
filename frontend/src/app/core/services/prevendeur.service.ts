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

export interface DrilldownProduit {
  nom: string;
  total: number;
  weeks: number[];
  top_fdv: TopFdv[];
}

export interface DrilldownSousFamille {
  nom: string;
  total: number;
  weeks: number[];
  produits: DrilldownProduit[];
}

export interface TopFdv {
  code: string;
  nom: string;
  total: number;
}

export interface FdvItem {
  code: string;
  nom: string;
  total: number;
}

export interface DrilldownFamille {
  nom: string;
  total: number;
  total_prev: number;
  delta_pct: number | null;
  weeks: number[];
  sous_familles: DrilldownSousFamille[];
  top_fdv: TopFdv[];
}

export interface DrilldownData {
  periode: string;
  periodes: string[];
  prevendeurs: FdvItem[];
  trend_6m: number[];
  trend_6m_labels: string[];
  top_fdv: TopFdv[];
  familles: DrilldownFamille[];
}

export interface PrevAdminClientRow {
  code_client: string;
  nom_client: string;
  nom_sodichn: string | null;
}

export interface PrevAdminStat {
  id: number;
  full_name: string;
  employe_code: string;
  total_clients: number;
  clients_with_sodichn: number;
  completion_pct: number;
  last_activity: string | null;
  clients: PrevAdminClientRow[];
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

  getDrilldown(annee_mois: string, code_fdv?: string | null, canal?: string | null) {
    let p = new HttpParams().set('annee_mois', annee_mois);
    if (code_fdv) p = p.set('code_fdv', code_fdv);
    if (canal) p = p.set('canal', canal);
    return this.http.get<DrilldownData>('/api/v1/prevendeur/admin/drilldown', { params: p });
  }
}
