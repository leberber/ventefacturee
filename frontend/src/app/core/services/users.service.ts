import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UserCreate, UserUpdate } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private base = '/api/v1/users';

  list(): Observable<User[]> {
    return this.http.get<User[]>(this.base);
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
