import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bon, BonCreate, BonUpdate, DashboardStats, ExpeditionClient, LivraisonDetail, LivraisonDetailCreate } from '../models/bon.model';

@Injectable({ providedIn: 'root' })
export class BonsService {
  private http = inject(HttpClient);
  private base = '/api/v1/bls';

  list(clientId?: number, search?: string, dateFrom?: string, dateTo?: string): Observable<Bon[]> {
    let params = new HttpParams().set('limit', '500');
    if (clientId) params = params.set('client_id', clientId);
    if (search)   params = params.set('search', search);
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo)   params = params.set('date_to', dateTo);
    return this.http.get<Bon[]>(this.base, { params });
  }

  create(body: BonCreate): Observable<Bon> {
    return this.http.post<Bon>(this.base, body);
  }

  update(id: number, body: BonUpdate): Observable<Bon> {
    return this.http.patch<Bon>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getById(id: number): Observable<Bon> {
    return this.http.get<Bon>(`${this.base}/${id}`);
  }

  getExpeditionClients(blId: number): Observable<ExpeditionClient[]> {
    return this.http.get<ExpeditionClient[]>(`${this.base}/${blId}/expedition-clients`);
  }

  upsertDetail(blId: number, body: LivraisonDetailCreate): Observable<LivraisonDetail> {
    return this.http.post<LivraisonDetail>(`${this.base}/${blId}/details`, body);
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/stats/dashboard`);
  }
}
