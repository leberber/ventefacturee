import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Client, ClientCreate, ClientUpdate, ClientBalance } from '../models/client.model';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class ClientsService extends CrudService<Client, ClientCreate, ClientUpdate> {
  protected base = '/api/v1/clients';

  getBalance(id: number): Observable<ClientBalance> {
    return this.http.get<ClientBalance>(`${this.base}/${id}/balance`);
  }
}
