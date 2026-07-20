export interface Chauffeur {
  id: number;
  name: string;
  phone?: string;
  is_active: boolean;
  bl_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface ChauffeurCreate {
  name: string;
  phone?: string;
}

export interface ChauffeurUpdate extends Partial<ChauffeurCreate> {
  is_active?: boolean;
}
