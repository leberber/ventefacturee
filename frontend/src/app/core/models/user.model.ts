export type UserRole = 'admin' | 'employe' | 'prevender';

export interface User {
  id: number;
  phone: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  employe_code?: string | null;
  created_at: string;
}

export interface UserCreate {
  phone: string;
  full_name: string;
  password: string;
  role: UserRole;
  employe_code?: string | null;
}

export interface UserUpdate {
  full_name?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  is_active?: boolean;
  employe_code?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
