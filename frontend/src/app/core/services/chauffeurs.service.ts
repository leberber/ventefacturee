import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Chauffeur, ChauffeurCreate, ChauffeurUpdate } from '../models/chauffeur.model';

@Injectable({ providedIn: 'root' })
export class ChauffeursService {
  private http = inject(HttpClient);
  private base = '/api/v1/chauffeurs';

  list(search?: string): Observable<Chauffeur[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<Chauffeur[]>(this.base, { params });
  }

  create(body: ChauffeurCreate): Observable<Chauffeur> {
    return this.http.post<Chauffeur>(this.base, body);
  }

  update(id: number, body: ChauffeurUpdate): Observable<Chauffeur> {
    return this.http.patch<Chauffeur>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
