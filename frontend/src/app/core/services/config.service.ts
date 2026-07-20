import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private base = '/api/v1/config';

  get<T = Record<string, any>>(key: string): Observable<T> {
    return this.http.get<T>(`${this.base}/${key}`);
  }

  put<T = Record<string, any>>(key: string, value: T): Observable<T> {
    return this.http.put<T>(`${this.base}/${key}`, { value });
  }
}
