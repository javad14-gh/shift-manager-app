export interface Sube {
  subeId: string;
  adi: string;
  latitude?: number;
  longitude?: number;
}

export type UserRole = 'genel-mudur' | 'sube-muduru' | 'calisan' | 'sistem-yoneticisi' | 'bireysel';

export interface Personel {
  personelId: string; // The document ID
  uid: string; // The Firebase Authentication UID
  subeId: string;
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
  subeId: string;
  personelId: string;
  personelAdi?: string; // Denormalized for reporting
  tarih: any; // Can be Date or Firebase Timestamp
  tur: 'calisma' | 'izinli';
  planliGiris?: any;
  planliSureDakika?: number;
  girisSaati?: any;
  cikisSaati?: any;
}

export type AppUser = {
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  branchId?: string;
  canManageInventory?: boolean;
};
