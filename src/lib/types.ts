export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "preparing"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";
export type ProductStatus = "draft" | "active" | "archived";
export type ShipmentStatus = "pending" | "in_cart" | "released" | "posted" | "delivered" | "cancelled" | "error";
export type CouponType = "percentage" | "fixed";

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  position: number;
  is_active: boolean;
  show_in_menu: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  storage_path: string | null;
  alt: string | null;
  position: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  color_hex: string | null;
  price: number | null;
  promo_price: number | null;
  image_url: string | null;
  position: number;
  is_active: boolean;
}

export interface InventoryRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  low_stock_threshold: number;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  sku: string;
  brand: string | null;
  short_description: string | null;
  description: string | null;
  price: number;
  promo_price: number | null;
  weight_grams: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  status: ProductStatus;
  is_featured: boolean;
  is_new: boolean;
  has_variants: boolean;
  sales_count: number;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithRelations extends Product {
  category?: Pick<Category, "id" | "name" | "slug" | "parent_id"> | null;
  images: ProductImage[];
  variants: ProductVariant[];
  inventory: InventoryRow[];
}

/** Projeção leve usada em cards/listagens */
export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  price: number;
  promo_price: number | null;
  is_new: boolean;
  has_variants: boolean;
  sales_count: number;
  image: string | null;
  image_alt: string | null;
  second_image: string | null;
  in_stock: boolean;
  category_slug: string | null;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  eyebrow: string | null;
  cta_label: string | null;
  link_url: string | null;
  image_url: string | null;
  image_path: string | null;
  mobile_image_url: string | null;
  mobile_image_path: string | null;
  theme: "dark" | "light";
  position: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface Testimonial {
  name: string;
  text: string;
  city?: string;
  rating?: number;
}

export interface InstagramPost {
  image_url: string;
  link_url: string;
  caption?: string;
}

export interface StoreSettings {
  id: number;
  store_name: string;
  tagline: string | null;
  logo_url: string | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  company_name: string | null;
  cnpj: string | null;
  origin_name: string | null;
  origin_postal_code: string | null;
  origin_street: string | null;
  origin_number: string | null;
  origin_complement: string | null;
  origin_district: string | null;
  origin_city: string | null;
  origin_state: string | null;
  origin_document: string | null;
  max_installments: number;
  min_installment_value: number;
  free_shipping_min: number | null;
  announcement: string | null;
  testimonials: Testimonial[];
  instagram_posts: InstagramPost[];
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  recipient_name: string;
  phone: string | null;
  postal_code: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  is_default: boolean;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  accepts_marketing: boolean;
  created_at: string;
}

export interface ShippingAddressSnapshot {
  recipient_name: string;
  postal_code: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  phone?: string | null;
}

export interface Order {
  id: string;
  order_number: number;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_cpf: string | null;
  shipping_address: ShippingAddressSnapshot;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  total: number;
  coupon_code: string | null;
  shipping_service_id: number | null;
  shipping_service_name: string | null;
  shipping_carrier: string | null;
  shipping_days: number | null;
  shipping_package: ShippingPackage | null;
  payment_method: "pix" | "credit_card" | null;
  notes: string | null;
  admin_notes: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string;
  image_url: string | null;
  unit_price: number;
  quantity: number;
  total: number;
}

export interface Payment {
  id: string;
  order_id: string;
  provider_payment_id: string | null;
  method: "pix" | "credit_card";
  status: PaymentStatus;
  status_detail: string | null;
  amount: number;
  installments: number;
  card_brand: string | null;
  card_last_four: string | null;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_ticket_url: string | null;
  expires_at: string | null;
  approved_at: string | null;
  refunded_amount: number;
  created_at: string;
}

export interface Shipment {
  id: string;
  order_id: string;
  service_id: number;
  service_name: string | null;
  superfrete_order_id: string | null;
  status: ShipmentStatus;
  provider_status: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  label_url: string | null;
  price: number | null;
  package: ShippingPackage | null;
  error_message: string | null;
  released_at: string | null;
  posted_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface ShipmentTrackingEvent {
  id: string;
  shipment_id: string;
  status: string;
  description: string | null;
  location: string | null;
  occurred_at: string;
}

export interface ShippingPackage {
  height: number;
  width: number;
  length: number;
  weight: number; // kg
}

export interface ShippingOption {
  service_id: number;
  name: string;
  carrier: string;
  carrier_logo: string | null;
  price: number;
  delivery_days: number;
  delivery_min: number | null;
  delivery_max: number | null;
  package: ShippingPackage | null;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  min_order_value: number;
  max_uses: number | null;
  max_uses_per_user: number | null;
  uses_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CartLine {
  id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  slug: string;
  variant_name: string | null;
  image: string | null;
  unit_price: number;
  regular_price: number;
  quantity: number;
  line_total: number;
  available: number;
  issue: string | null;
}

export interface CartView {
  id: string | null;
  items: CartLine[];
  count: number;
  subtotal: number;
  coupon: { code: string; discount: number } | null;
  coupon_error: string | null;
  discount: number;
  total_before_shipping: number;
  free_shipping_min: number | null;
  has_issues: boolean;
}
