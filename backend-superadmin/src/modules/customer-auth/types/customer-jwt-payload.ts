export interface CustomerJwtPayload {
  sub: number | null;
  type: 'customer' | 'guest';
  phone?: string;
  email?: string;
  tableId?: number;
}
