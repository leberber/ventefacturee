import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface UploadResponse {
  lignes: number;
  annee_mois: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class VentesService {
  private http = inject(HttpClient);

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UploadResponse>('/api/v1/ventes/upload', form);
  }

  getPeriodes() {
    return this.http.get<string[]>('/api/v1/ventes/periodes');
  }
}
