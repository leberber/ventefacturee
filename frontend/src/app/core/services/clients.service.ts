import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Client, ClientCreate, ClientUpdate, ClientBalance } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private http = inject(HttpClient);
  private base = '/api/v1/clients';

  list(search?: string): Observable<Client[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<Client[]>(this.base, { params });
  }

  create(body: ClientCreate): Observable<Client> {
    return this.http.post<Client>(this.base, body);
  }

  update(id: number, body: ClientUpdate): Observable<Client> {
    return this.http.patch<Client>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getBalance(id: number): Observable<ClientBalance> {
    return this.http.get<ClientBalance>(`${this.base}/${id}/balance`);
  }
}
