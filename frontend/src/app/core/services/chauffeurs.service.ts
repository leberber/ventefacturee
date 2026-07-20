import { Injectable } from '@angular/core';
import { Chauffeur, ChauffeurCreate, ChauffeurUpdate } from '../models/chauffeur.model';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class ChauffeursService extends CrudService<Chauffeur, ChauffeurCreate, ChauffeurUpdate> {
  protected base = '/api/v1/chauffeurs';
}
