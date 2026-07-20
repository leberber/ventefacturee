import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Livreur, LivreurCreate, LivreurUpdate } from '../models/livreur.model';

@Injectable({ providedIn: 'root' })
export class LivreursService {
  private http = inject(HttpClient);
  private base = '/api/v1/livreurs';

  list(search?: string): Observable<Livreur[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<Livreur[]>(this.base, { params });
  }

  create(body: LivreurCreate): Observable<Livreur> {
    return this.http.post<Livreur>(this.base, body);
  }

  update(id: number, body: LivreurUpdate): Observable<Livreur> {
    return this.http.patch<Livreur>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
