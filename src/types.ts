export type Role = "boss" | "manager" | "cashier" | "employee";
export type AppModule = "dashboard" | "caisse" | "boutique";

export type ScreenKey =
  | "home_dashboard"
  | "statistics"
  | "home_caisse"
  | "orders"
  | "clients"
  | "appointments"
  | "tickets"
  | "home_boutique"
  | "products"
  | "attendance"
  | "team"
  | "permissions"
  | "logs"
  | "settings";

export type PaymentMethod = "cash" | "mobile_money" | "card";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled";
export type AttendanceStatus =
  | "present"
  | "absent_justified"
  | "absent_unjustified";
export type StatisticsPeriod = "today" | "week" | "month";

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  employee_id: number | null;
  permissions: string | null;
  has_password: number;
  is_active: number;
  created_at: string;
}

export interface Employee {
  id: number;
  name: string;
  phone: string;
  position: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  order_count?: number;
  total_sales?: number;
  has_account?: number;
  account_role?: Role | null;
  account_active?: number | null;
}

export interface AttendanceRecord {
  id: number | null;
  employee_id: number;
  employee_name: string;
  employee_position: string;
  work_date: string;
  status: AttendanceStatus | null;
  arrival_at: string | null;
  note: string;
  recorded_by: number | null;
  recorded_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AttendanceInput {
  employeeId: number;
  workDate: string;
  status: AttendanceStatus;
  arrivalAt: string | null;
  note?: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  category: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  tracks_stock: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  created_at: string;
  updated_at: string;
  order_count?: number;
  total_spent?: number;
}

export interface Appointment {
  id: number;
  client_id: number;
  client_name: string;
  client_phone: string;
  product_id: number | null;
  product_name: string | null;
  scheduled_at: string;
  reminder_minutes: number;
  notes: string;
  status: AppointmentStatus;
  notification_id: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentInput {
  clientId: number;
  productId: number | null;
  scheduledAt: string;
  reminderMinutes: number;
  notes?: string;
}

export interface Order {
  id: number;
  order_number: string;
  client_id: number | null;
  client_name: string | null;
  user_id: number;
  user_name: string;
  employee_id: number | null;
  employee_name: string | null;
  total: number;
  payment_method: PaymentMethod;
  status: "paid";
  created_at: string;
  item_count?: number;
}

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string;
  user_role: Role | "system";
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface DashboardStats {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  ordersToday: number;
  newClientsToday: number;
  newClientsWeek: number;
  newClientsMonth: number;
  activeEmployees: number;
  lowStockCount: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  recentOrders: Order[];
}

export interface StatisticsData {
  period: StatisticsPeriod;
  startAt: string;
  revenue: number;
  orderCount: number;
  itemsSold: number;
  averageBasket: number;
  newClients: number;
  topProducts: Array<{
    id: number | null;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  topEmployees: Array<{
    id: number | null;
    name: string;
    orderCount: number;
    revenue: number;
  }>;
  revenueByDay: Array<{
    day: string;
    revenue: number;
    orderCount: number;
  }>;
  recentOrders: Order[];
}

export interface ProductInput {
  name: string;
  sku?: string;
  category: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  tracksStock: boolean;
}

export interface ClientInput {
  name: string;
  phone: string;
  address?: string;
}

export interface UserInput {
  employeeId: number;
  username: string;
  role: Exclude<Role, "boss">;
  password: string;
  permissions?: string | null;
}

export interface EmployeeInput {
  name: string;
  phone?: string;
  position: string;
}
