import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { User, UserRole, TokenResponse } from '../models/user.model';

const TOKEN_KEY = 'pallette_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  currentUser = signal<User | null>(this.loadFromToken());

  get token(): string | null { return localStorage.getItem(TOKEN_KEY); }
  get isLoggedIn(): boolean  { return !!this.currentUser(); }
  get isAdminOrEmploye(): boolean {
    const r = this.currentUser()?.role;
    return r === 'admin' || r === 'employe';
  }
  get isAdmin(): boolean    { return this.currentUser()?.role === 'admin'; }
  get isLivreur(): boolean  { return this.currentUser()?.role === 'livreur'; }

  login(username: string, password: string) {
    const body = new URLSearchParams({ username, password });
    return this.http.post<TokenResponse>('/api/v1/auth/login', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.access_token);
        this.currentUser.set(this.decodeToken(res.access_token));
      }),
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private loadFromToken(): User | null {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? this.decodeToken(token) : null;
  }

  private decodeToken(token: string): User | null {
    try {
      const base64url = token.split('.')[1];
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
      const payload = JSON.parse(atob(base64));
      if ((payload.exp as number) * 1000 < Date.now()) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return {
        id:         +payload.sub,
        phone:      payload.phone,
        full_name:  payload.full_name,
        role:       payload.role as UserRole,
        is_active:  true,
        created_at: '',
      };
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  }
}
