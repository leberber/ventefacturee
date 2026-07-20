export interface Bon {
  id: number;
  bl_number: string;
  date: string;
  destination_type: string;  // gros | detail | horeca
  chauffeur_id: number;
  chauffeur_name: string;
  client_id?: number;
  client_name?: string;
  client_code?: string;
  livreur_id?: number;
  livreur_name?: string;
  consigne_plastique: number;
  nc_plastique: number;
  retour_plastique: number;
  consigne_bois: number;
  nc_bois: number;
  retour_bois: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface BonCreate {
  bl_number: string;
  date: string;
  destination_type: string;
  chauffeur_id: number;
  client_id?: number | null;
  livreur_id?: number | null;
  client_ids?: number[];
  consigne_plastique: number;
  nc_plastique: number;
  retour_plastique: number;
  consigne_bois: number;
  nc_bois: number;
  retour_bois: number;
  notes?: string | null;
}

export interface BonUpdate extends Partial<BonCreate> {}

export interface LivraisonDetail {
  id: number;
  bl_id: number;
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
  bl_id: number;
  client_id: number;
  client_name: string;
  client_code?: string;
  detail?: LivraisonDetail;
}

export interface DashboardStats {
  total_clients: number;
  total_bls: number;
  today_bls: number;
  total_plastic_balance: number;
  total_wood_balance: number;
  total_plastic_consigne: number;
  total_plastic_nc: number;
  total_wood_consigne: number;
  total_wood_nc: number;
}
