export type UserRole = 'admin' | 'clerk' | 'livreur';

export interface User {
  id: number;
  phone: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  phone: string;
  full_name: string;
  password: string;
  role: UserRole;
}

export interface UserUpdate {
  full_name?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
