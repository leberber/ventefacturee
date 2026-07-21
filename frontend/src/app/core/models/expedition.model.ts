export interface Expedition {
  id: number;
  bl_number: string;
  date: string;
  destination_type: string;  // gros | detail | horeca
  chauffeur_id?: number | null;
  chauffeur_name?: string | null;
  client_id?: number;
  client_name?: string;
  client_code?: string;
  livreur_id?: number;
  livreur_name?: string;
  nc_plastique: number;
  nc_bois: number;
  retour_plastique: number;
  consigne_paid_plastique: number;
  palette_dette_plastique: number;
  retour_bois: number;
  consigne_paid_bois: number;
  palette_dette_bois: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  retour_livreur_plastique: number;
  retour_livreur_bois: number;
  is_verified: boolean;
  verified_at?: string;
  verified_by_name?: string;
  livreur_confirmed: boolean;
  livreur_confirmed_at?: string;
  created_by_name?: string;
}

export interface ExpeditionCreate {
  bl_number: string;
  date: string;
  destination_type: string;
  chauffeur_id?: number | null;
  client_id?: number | null;
  livreur_id?: number | null;
  client_ids?: number[];
  nc_plastique: number;
  nc_bois: number;
  notes?: string | null;
  created_by_id?: number | null;
}

export interface ExpeditionUpdate {
  chauffeur_id?: number;
  client_id?: number | null;
  livreur_id?: number | null;
  nc_plastique?: number;
  nc_bois?: number;
  notes?: string | null;
}

export interface RetourCreate {
  date: string;
  retour_plastique: number;
  consigne_paid_plastique: number;
  retour_bois: number;
  consigne_paid_bois: number;
  notes?: string | null;
}

export interface RetourRead {
  id: number;
  expedition_id: number;
  date: string;
  retour_plastique: number;
  consigne_paid_plastique: number;
  palette_dette_plastique: number;
  retour_bois: number;
  consigne_paid_bois: number;
  palette_dette_bois: number;
  notes?: string;
  created_at: string;
}

export interface LivraisonDetail {
  id: number;
  expedition_id: number;
  client_id: number;
  client_name: string;
  client_code?: string;
  plastique: number;
  bois: number;
  retour_plastique: number;
  retour_bois: number;
  notes?: string;
  recorded_at: string;
  updated_at?: string;
}

export interface LivraisonDetailCreate {
  client_id: number;
  plastique: number;
  bois: number;
  retour_plastique?: number;
  retour_bois?: number;
  notes?: string;
}

export interface ExpeditionClient {
  id: number;
  expedition_id: number;
  client_id: number;
  client_name: string;
  client_code?: string;
  client_first_name?: string;
  client_last_name?: string;
  has_location: boolean;
  detail?: LivraisonDetail;
}

export interface ExpeditionVerify {
  retour_livreur_plastique: number;
  retour_livreur_bois: number;
  verified_by_id: number;
}

export interface DashboardStats {
  total_clients: number;
  total_bls: number;
  today_bls: number;
  total_plastic_balance: number;
  total_wood_balance: number;
}
