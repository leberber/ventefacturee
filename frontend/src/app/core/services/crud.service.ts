import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export abstract class CrudService<T, Create, Update = Partial<Create>> {
  protected http = inject(HttpClient);
  protected abstract base: string;

  list(search?: string): Observable<T[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<T[]>(this.base, { params });
  }

  create(body: Create): Observable<T> {
    return this.http.post<T>(this.base, body);
  }

  update(id: number, body: Update): Observable<T> {
    return this.http.patch<T>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
