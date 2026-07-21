import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UserCreate, UserUpdate, UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private base = '/api/v1/users';

  list(): Observable<User[]> {
    return this.http.get<User[]>(this.base);
  }

  listByRole(role: UserRole): Observable<User[]> {
    const params = new HttpParams().set('role', role);
    return this.http.get<User[]>(this.base, { params });
  }

  create(body: UserCreate): Observable<User> {
    return this.http.post<User>(this.base, body);
  }

  update(id: number, body: UserUpdate): Observable<User> {
    return this.http.patch<User>(`${this.base}/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
