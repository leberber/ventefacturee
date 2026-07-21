import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Expedition, ExpeditionCreate, ExpeditionUpdate, ExpeditionVerify, DashboardStats,
  ExpeditionClient, LivraisonDetail, LivraisonDetailCreate,
  RetourCreate, RetourRead,
} from '../models/expedition.model';

@Injectable({ providedIn: 'root' })
export class ExpeditionsService {
  private http = inject(HttpClient);
  private base = '/api/v1/expeditions';

  list(clientId?: number, search?: string, dateFrom?: string, dateTo?: string, livreurId?: number): Observable<Expedition[]> {
    let params = new HttpParams().set('limit', '500');
    if (clientId)  params = params.set('client_id', clientId);
    if (search)    params = params.set('search', search);
    if (dateFrom)  params = params.set('date_from', dateFrom);
    if (dateTo)    params = params.set('date_to', dateTo);
    if (livreurId) params = params.set('livreur_id', livreurId);
    return this.http.get<Expedition[]>(this.base, { params });
  }

  create(body: ExpeditionCreate): Observable<Expedition> {
    return this.http.post<Expedition>(this.base, body);
  }

  update(id: number, body: ExpeditionUpdate): Observable<Expedition> {
    return this.http.patch<Expedition>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getById(id: number): Observable<Expedition> {
    return this.http.get<Expedition>(`${this.base}/${id}`);
  }

  getExpeditionClients(expeditionId: number): Observable<ExpeditionClient[]> {
    return this.http.get<ExpeditionClient[]>(`${this.base}/${expeditionId}/expedition-clients`);
  }

  setExpeditionClients(expeditionId: number, clientIds: number[]): Observable<any> {
    return this.http.put(`${this.base}/${expeditionId}/expedition-clients`, clientIds);
  }

  upsertDetail(expeditionId: number, body: LivraisonDetailCreate): Observable<LivraisonDetail> {
    return this.http.post<LivraisonDetail>(`${this.base}/${expeditionId}/details`, body);
  }

  createRetour(expeditionId: number, body: RetourCreate): Observable<RetourRead> {
    return this.http.post<RetourRead>(`${this.base}/${expeditionId}/retours`, body);
  }

  listRetours(expeditionId: number): Observable<RetourRead[]> {
    return this.http.get<RetourRead[]>(`${this.base}/${expeditionId}/retours`);
  }

  confirmLivraison(id: number): Observable<Expedition> {
    return this.http.post<Expedition>(`${this.base}/${id}/confirm-livraison`, {});
  }

  verify(id: number, body: ExpeditionVerify): Observable<Expedition> {
    return this.http.post<Expedition>(`${this.base}/${id}/verify`, body);
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/stats/dashboard`);
  }
}
