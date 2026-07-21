export type ClientCategory = 'gros' | 'detail' | 'horeca';

export interface Client {
  id: number;
  code?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  store_name?: string;
  phone?: string;
  category: ClientCategory;
  daira?: string;
  commune?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  plastic_balance?: number;
  wood_balance?: number;
}

export interface ClientCreate {
  code?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  store_name?: string;
  phone?: string;
  category: ClientCategory;
  daira?: string;
  commune?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface ClientUpdate extends Partial<ClientCreate> {
  is_active?: boolean;
}

export interface ClientBalance {
  plastic_balance: number;
  plastic_consigne: number;
  plastic_nc: number;
  plastic_back: number;
  wood_balance: number;
  wood_consigne: number;
  wood_nc: number;
  wood_back: number;
}
