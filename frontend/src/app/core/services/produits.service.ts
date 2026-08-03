import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface ProduitRead {
  code_produit: string;
  description_produit: string | null;
  famille: string | null;
  sous_famille: string | null;
  uom_vente: string | null;
  uom_principale: string | null;
  nom_produit: string | null;
  colisage: number | null;
  unite: string | null;
  volume: number | null;
  poids: number | null;
  prix: number | null;
  facturable: boolean;
  updated_at: string;
}

export interface ProduitPage {
  total: number;
  items: ProduitRead[];
}

@Injectable({ providedIn: 'root' })
export class ProduitsService {
  private http = inject(HttpClient);

  list(params: { page?: number; per_page?: number; famille?: string; search?: string } = {}) {
    let p = new HttpParams();
    if (params.page)      p = p.set('page', params.page);
    if (params.per_page)  p = p.set('per_page', params.per_page);
    if (params.famille)   p = p.set('famille', params.famille);
    if (params.search)    p = p.set('search', params.search);
    return this.http.get<ProduitPage>('/api/v1/produits', { params: p });
  }

  getFamilles() {
    return this.http.get<string[]>('/api/v1/produits/familles');
  }

  update(code: string, body: { nom_produit?: string | null; colisage?: number | null; unite?: string | null; volume?: number | null; poids?: number | null; prix?: number | null; facturable?: boolean }) {
    return this.http.patch<ProduitRead>(`/api/v1/produits/${encodeURIComponent(code)}`, body);
  }

  syncPreview() {
    return this.http.get<{ code_produit: string; description_produit: string | null; famille: string | null; sous_famille: string | null }[]>('/api/v1/produits/sync-preview');
  }

  sync() {
    return this.http.post<{ inserted: number; message: string }>('/api/v1/produits/sync', {});
  }
}
