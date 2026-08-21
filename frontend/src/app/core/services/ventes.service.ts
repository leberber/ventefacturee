import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface VenteRead {
  id: number;
  annee_mois: string;
  date_commande: string | null;
  num_commande: string | null;
  type_commande: string | null;
  source: string | null;
  code_client: string | null;
  nom_client: string | null;
  categorie_client: string | null;
  adresse_client: string | null;
  route: string | null;
  commune: string | null;
  wilaya: string | null;
  zone: string | null;
  region: string | null;
  tel_client: string | null;
  type_client: string | null;
  code_fdv: string | null;
  nom_fdv: string | null;
  canal: string | null;
  buid: string | null;
  depot_livraison: string | null;
  statut_commande: string | null;
  date_creation: string | null;
  date_confirmation: string | null;
  date_facturation: string | null;
  code_livreur: string | null;
  nom_livreur: string | null;
  matricule_van: string | null;
  code_produit: string | null;
  description_produit: string | null;
  famille: string | null;
  sous_famille: string | null;
  uom_vente: string | null;
  cout_produit: number | null;
  prix_unitaire: number | null;
  uom_principale: string | null;
  prix_unitaire_uom_pr: number | null;
  qte_commandee: number | null;
  qte_chargee: number | null;
  qte_livree: number | null;
  qte_facturee: number | null;
  total_commande: number | null;
  total_facture: number | null;
  total_remise: number | null;
  gratuite: number | null;
}

export interface VentePage {
  total: number;
  items: VenteRead[];
}

export interface RapprochementLigne {
  code_produit: string;
  libelle: string;
  bl_qte_unites: number;
  bl_nb_colis: number | null;
  bl_prix_unitaire: number;
  bl_montant_ttc: number;
  ventes_qte_colis: number | null;
  colisage: number | null;
  ventes_qte_unites: number | null;
  difference_unites: number | null;
  match: boolean;
  prix_dd: number | null;
  prix_promotion: number | null;
  prix_club: number | null;
  ventes_qte_facturee: number | null;
  ventes_uom_vente: string | null;
  ventes_prix_unitaire: number | null;
  ventes_total_facture: number | null;
  mapped_code: string | null;
  is_duplicate: boolean;
  ref_price: number | null;
}

export interface BlMapping {
  bl_code: string;
  code_produit: string;
}

export interface RapprochementResult {
  nom_fdv: string;
  date: string;
  net_a_payer: number;
  lignes: RapprochementLigne[];
}

export interface SessionLigneCreate {
  code_produit: string;
  libelle: string;
  bl_qte_unites: number;
  bl_nb_colis: number | null;
  bl_prix_unitaire: number;
  bl_montant_ttc: number;
  net_ligne: number;
  ventes_qte_colis: number | null;
  match: boolean;
  is_duplicate: boolean;
  ref_price: number | null;
  prix_promotion: number | null;
  qty_promo: number;
  qty_gros: number;
  promo_prix_override: number | null;
}

export interface SessionCreate {
  nom_livreur: string;
  date_bl: string;
  source: string | null;
  net_a_payer: number;
  net_ajuste: number;
  total_discount: number;
  montant_recu: number | null;
  difference: number | null;
  lignes: SessionLigneCreate[];
}

export interface SessionRead {
  id: number;
  nom_livreur: string;
  date_bl: string;
  source: string | null;
  net_a_payer: number;
  net_ajuste: number;
  total_discount: number;
  montant_recu: number | null;
  difference: number | null;
  created_at: string;
}

export interface SessionLigneRead extends SessionLigneCreate {
  id: number;
}

export interface SessionReadDetail extends SessionRead {
  lignes: SessionLigneRead[];
}

export interface UploadResponse {
  lignes: number;
  annee_mois: string;
  message: string;
}

export interface DateRange {
  min_date: string | null;
  max_date: string | null;
}

export interface VenteListParams {
  page?: number;
  per_page?: number;
  annee_mois?: string;
  date_from?: string;
  date_to?: string;
  famille?: string;
  sous_famille?: string;
  type_commande?: string;
  categorie_client?: string;
  statut_commande?: string;
  wilaya?: string;
  zone?: string;
  region?: string;
  source?: string;
  canal?: string;
  route?: string;
  nom_fdv?: string;
  nom_livreur?: string;
  nom_client?: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class VentesService {
  private http = inject(HttpClient);

  list(params: VenteListParams = {}) {
    let p = new HttpParams();
    if (params.page)        p = p.set('page', params.page);
    if (params.per_page)    p = p.set('per_page', params.per_page);
    if (params.annee_mois)  p = p.set('annee_mois', params.annee_mois);
    if (params.date_from)   p = p.set('date_from', params.date_from);
    if (params.date_to)     p = p.set('date_to', params.date_to);
    if (params.famille)          p = p.set('famille', params.famille);
    if (params.sous_famille)     p = p.set('sous_famille', params.sous_famille);
    if (params.type_commande)    p = p.set('type_commande', params.type_commande);
    if (params.categorie_client) p = p.set('categorie_client', params.categorie_client);
    if (params.statut_commande)  p = p.set('statut_commande', params.statut_commande);
    if (params.wilaya)           p = p.set('wilaya', params.wilaya);
    if (params.zone)             p = p.set('zone', params.zone);
    if (params.region)           p = p.set('region', params.region);
    if (params.source)           p = p.set('source', params.source);
    if (params.canal)            p = p.set('canal', params.canal);
    if (params.route)            p = p.set('route', params.route);
    if (params.nom_fdv)          p = p.set('nom_fdv', params.nom_fdv);
    if (params.nom_livreur)      p = p.set('nom_livreur', params.nom_livreur);
    if (params.nom_client)       p = p.set('nom_client', params.nom_client);
    if (params.search)           p = p.set('search', params.search);
    return this.http.get<VentePage>('/api/v1/ventes', { params: p });
  }

  getDateRange() {
    return this.http.get<DateRange>('/api/v1/ventes/date-range');
  }

  getPeriodes() {
    return this.http.get<string[]>('/api/v1/ventes/periodes');
  }

  getFamilles(date_from?: string, date_to?: string) {
    let p = new HttpParams();
    if (date_from) p = p.set('date_from', date_from);
    if (date_to)   p = p.set('date_to', date_to);
    return this.http.get<string[]>('/api/v1/ventes/familles', { params: p });
  }

  getFdvs(date_from?: string, date_to?: string) {
    let p = new HttpParams();
    if (date_from) p = p.set('date_from', date_from);
    if (date_to)   p = p.set('date_to', date_to);
    return this.http.get<string[]>('/api/v1/ventes/fdvs', { params: p });
  }

  getClients(date_from?: string, date_to?: string, nom_fdv?: string) {
    let p = new HttpParams();
    if (date_from) p = p.set('date_from', date_from);
    if (date_to)   p = p.set('date_to', date_to);
    if (nom_fdv)   p = p.set('nom_fdv', nom_fdv);
    return this.http.get<string[]>('/api/v1/ventes/clients', { params: p });
  }

  getDistinct(field: string, date_from?: string, date_to?: string) {
    let p = new HttpParams();
    if (date_from) p = p.set('date_from', date_from);
    if (date_to)   p = p.set('date_to', date_to);
    return this.http.get<string[]>(`/api/v1/ventes/distinct/${field}`, { params: p });
  }

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UploadResponse>('/api/v1/ventes/upload', form);
  }

  rapprochementBL(file: File, nom_livreur: string, source?: string) {
    const form = new FormData();
    form.append('file', file);
    let p = new HttpParams().set('nom_livreur', nom_livreur);
    if (source) p = p.set('source', source);
    return this.http.post<RapprochementResult>('/api/v1/ventes/rapprochement-bl', form, { params: p });
  }

  getMappings() {
    return this.http.get<BlMapping[]>('/api/v1/mappings');
  }

  createMapping(bl_code: string, code_produit: string) {
    return this.http.post<BlMapping>('/api/v1/mappings', { bl_code, code_produit });
  }

  deleteMapping(bl_code: string) {
    return this.http.delete(`/api/v1/mappings/${encodeURIComponent(bl_code)}`);
  }

  checkSession(nom_livreur: string, date_bl: string) {
    return this.http.get<{ exists: boolean; session: SessionRead | null }>(
      `/api/v1/rapprochement-sessions/check`,
      { params: { nom_livreur, date_bl } }
    );
  }

  saveSession(payload: SessionCreate) {
    return this.http.post<SessionRead>('/api/v1/rapprochement-sessions', payload);
  }

  updateSession(id: number, payload: SessionCreate) {
    return this.http.put<SessionRead>(`/api/v1/rapprochement-sessions/${id}`, payload);
  }

  listSessions() {
    return this.http.get<SessionRead[]>('/api/v1/rapprochement-sessions');
  }

  getSessionDetail(id: number) {
    return this.http.get<SessionReadDetail>(`/api/v1/rapprochement-sessions/${id}`);
  }

  deleteSession(id: number) {
    return this.http.delete(`/api/v1/rapprochement-sessions/${id}`);
  }
}
