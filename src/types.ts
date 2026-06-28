export interface Workspace {
  isletmeId: string;
  adi: string;
  davetKodu: string;
  cokSubeli: boolean;
}

export interface Sube {
  subeId: string;
  isletmeId: string;
  adi: string;
  latitude?: number;
  longitude?: number;
}

export type UserRole = 'genel-mudur' | 'sube-muduru' | 'calisan' | 'sistem-yoneticisi' | 'bireysel';

export interface Personel {
  personelId: string; // The profile doc ID
  uid: string; // The Firebase Authentication UID
  isletmeId: string;
  subeId?: string;
  adi: string;
  rol: UserRole;
  tanimlananSaat: number;
  avatarUrl?: string;
  email: string;
  password?: string;
  canManageInventory?: boolean;
  aktif?: boolean;
  notificationTokens?: string[];
  puan?: number;
}

export interface Vardiya {
  vardiyaId: string;
  isletmeId: string;
  subeId?: string;
  personelId: string;
  personelAdi?: string; // Denormalized for reporting
  tarih: any; // Can be Date or Firebase Timestamp
  tur: 'calisma' | 'izinli';
  planliGiris?: any;
  planliSureDakika?: number;
  girisSaati?: any;
  cikisSaati?: any;
  durum?: 'beklemede' | 'onaylandi' | 'reddedildi';
}

export interface UserProfile {
  profileId: string;
  ownerUid: string;
  title: string;
  rol: 'genel-mudur' | 'sube-muduru' | 'calisan' | 'bireysel';
  isletmeId: string;
  subeId?: string;
  aktif: boolean;
  tanimlananSaat?: number;
}

export type AppUser = {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  isletmeId?: string;
  subeId?: string;
  activeProfileId?: string;
  canManageInventory?: boolean;
};
