export interface TalentProfile {
  id: string;
  user_id: string;
  full_name?: string;
  temp_full_name?: string;
  temp_avatar_url?: string;
  username?: string;
  bio: string;
  pricing: number;
  is_active: boolean;
}

export interface Review {
  id: string;
  order_id: string;
  user_id: string;
  talent_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface BioSettings {
  id: string;
  talent_id: string;
  instagram_username?: string;
  one_liner?: string;
  theme: string;
  background_color: string;
  accent_color: string;
  font_family: string;
  show_shoutout_card: boolean;
  is_published: boolean;
}

export interface BioLink {
  id: string;
  talent_id: string;
  link_type: 'basic' | 'grid' | 'newsletter' | 'sponsor';
  title?: string;
  url?: string;
  icon_url?: string;
  image_url?: string;
  grid_size?: 'small' | 'medium' | 'large';
  display_order: number;
  is_active: boolean;
  bio_grid_cards?: BioGridCard[];
}

export interface BioGridCard {
  id: string;
  bio_link_id: string;
  title?: string;
  url: string;
  image_url: string;
  display_order: number;
}



