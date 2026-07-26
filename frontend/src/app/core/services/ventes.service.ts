import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface VenteRead {
  id: number;
  annee_mois: string;
  date_commande: string | null;
  num_commande: string | null;
  type_commande: string | null;
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

export interface UploadResponse {
  lignes: number;
  annee_mois: string;
  message: string;
}

export interface VenteListParams {
  page?: number;
  per_page?: number;
  annee_mois?: string;
  famille?: string;
  nom_fdv?: string;
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
    if (params.famille)     p = p.set('famille', params.famille);
    if (params.nom_fdv)     p = p.set('nom_fdv', params.nom_fdv);
    if (params.nom_client)  p = p.set('nom_client', params.nom_client);
    if (params.search)      p = p.set('search', params.search);
    return this.http.get<VentePage>('/api/v1/ventes', { params: p });
  }

  getPeriodes() {
    return this.http.get<string[]>('/api/v1/ventes/periodes');
  }

  getFamilles(annee_mois?: string) {
    let p = new HttpParams();
    if (annee_mois) p = p.set('annee_mois', annee_mois);
    return this.http.get<string[]>('/api/v1/ventes/familles', { params: p });
  }

  getFdvs(annee_mois?: string) {
    let p = new HttpParams();
    if (annee_mois) p = p.set('annee_mois', annee_mois);
    return this.http.get<string[]>('/api/v1/ventes/fdvs', { params: p });
  }

  getClients(annee_mois?: string, nom_fdv?: string) {
    let p = new HttpParams();
    if (annee_mois) p = p.set('annee_mois', annee_mois);
    if (nom_fdv) p = p.set('nom_fdv', nom_fdv);
    return this.http.get<string[]>('/api/v1/ventes/clients', { params: p });
  }

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UploadResponse>('/api/v1/ventes/upload', form);
  }
}
