import { Injectable } from '@angular/core';
import { Livreur, LivreurCreate, LivreurUpdate } from '../models/livreur.model';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class LivreursService extends CrudService<Livreur, LivreurCreate, LivreurUpdate> {
  protected base = '/api/v1/livreurs';
}
