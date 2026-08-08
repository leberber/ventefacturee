export type ClientCategory = 'gros' | 'detail' | 'horeca';

export interface Client {
  id: number;
  // BDD identifiers
  customer_no?: string;
  code_sodichn?: string;
  nom_sodichn?: string;
  // Identity
  name: string;
  first_name?: string;
  last_name?: string;
  store_name?: string;
  phone?: string;
  // Classification
  category: ClientCategory;
  type_client?: string;
  categorie_bdd?: string;
  tarification?: string;
  vendeur?: string;
  route_id?: string;
  buid?: string;
  status_bdd?: number;
  // Location
  wilaya?: string;
  region?: string;
  daira?: string;
  commune?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  // Fiscal
  rc?: string;
  nif?: string;
  ai?: string;
  activite_sodichn?: string;
  // Meta
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  plastic_sent?: number;
  plastic_retour?: number;
  plastic_consigne?: number;
  plastic_out?: number;
  plastic_balance?: number;
  wood_sent?: number;
  wood_retour?: number;
  wood_consigne?: number;
  wood_out?: number;
  wood_balance?: number;
}

export interface ClientCreate {
  customer_no?: string;
  code_sodichn?: string;
  nom_sodichn?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  store_name?: string;
  phone?: string;
  category: ClientCategory;
  type_client?: string;
  categorie_bdd?: string;
  tarification?: string;
  vendeur?: string;
  route_id?: string;
  buid?: string;
  status_bdd?: number;
  wilaya?: string;
  region?: string;
  daira?: string;
  commune?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rc?: string;
  nif?: string;
  ai?: string;
  activite_sodichn?: string;
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
