export interface Livreur {
  id: number;
  name: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface LivreurCreate {
  name: string;
  phone?: string;
}

export interface LivreurUpdate extends Partial<LivreurCreate> {
  is_active?: boolean;
}
