import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Client, ClientCreate, ClientUpdate, ClientBalance } from '../models/client.model';
import { CrudService } from './crud.service';

export interface ClientsPage { items: Client[]; total: number; }

@Injectable({ providedIn: 'root' })
export class ClientsService extends CrudService<Client, ClientCreate, ClientUpdate> {
  protected base = '/api/v1/clients';

  listPaged(opts: { search?: string; skip?: number; limit?: number } = {}): Observable<ClientsPage> {
    let params = new HttpParams();
    if (opts.search) params = params.set('search', opts.search);
    if (opts.skip  != null) params = params.set('skip',  opts.skip);
    if (opts.limit != null) params = params.set('limit', opts.limit);
    return this.http.get<ClientsPage>(`${this.base}/paged`, { params });
  }

  getBalance(id: number): Observable<ClientBalance> {
    return this.http.get<ClientBalance>(`${this.base}/${id}/balance`);
  }

  exportExcel() {
    return this.http.get(`${this.base}/export`, { responseType: 'blob' });
  }
}
