import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bon, BonCreate, BonUpdate, DashboardStats } from '../models/bon.model';

@Injectable({ providedIn: 'root' })
export class BonsService {
  private http = inject(HttpClient);
  private base = '/api/v1/bls';

  list(clientId?: number, search?: string): Observable<Bon[]> {
    let params = new HttpParams().set('limit', '500');
    if (clientId) params = params.set('client_id', clientId);
    if (search)   params = params.set('search', search);
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

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/stats/dashboard`);
  }
}
