export type Product = {
  id: number;
  name: string;
  brand: string;
  category: string;
  pack: string;
  mrp: number;
  price: number;
  moq: number;
  stock: string;
  source: string;
  color: string;
};

export const products: Product[] = [
  { id: 1, name: "Water Soluble NPK 19:19:19", brand: "IFFCO", category: "Fertilizers", pack: "1 kg pack", mrp: 620, price: 485, moq: 10, stock: "In stock", source: "Marketplace supplier", color: "mint" },
  { id: 2, name: "Hybrid Tomato Seeds", brand: "Mahyco", category: "Seeds", pack: "10 g pack", mrp: 450, price: 340, moq: 5, stock: "In stock", source: "Agri-One wholesale", color: "yellow" },
  { id: 3, name: "Neem Based Crop Care", brand: "T. Stanes", category: "Crop protection", pack: "1 litre", mrp: 890, price: 720, moq: 4, stock: "Low stock", source: "Marketplace supplier", color: "blue" },
  { id: 4, name: "Premium Bio Fertilizer", brand: "Multiplex", category: "Bio inputs", pack: "500 ml bottle", mrp: 340, price: 265, moq: 12, stock: "In stock", source: "Agri-One wholesale", color: "green" },
  { id: 5, name: "Micronutrient Mix", brand: "Coromandel", category: "Micronutrients", pack: "1 kg pouch", mrp: 510, price: 395, moq: 8, stock: "In stock", source: "Marketplace supplier", color: "lilac" },
  { id: 6, name: "Drip Irrigation Starter Kit", brand: "Jain Irrigation", category: "Equipment", pack: "1 set", mrp: 2450, price: 1980, moq: 2, stock: "In stock", source: "Agri-One wholesale", color: "orange" },
];

export type PortalConfig = { label: string; subtitle: string; icon: string; menu: string[] };

export const portals: Record<string, PortalConfig> = {
  admin: { label: "Super Admin", subtitle: "Marketplace operations", icon: "AO", menu: ["Dashboard", "Retailers", "Suppliers", "Manufacturers", "Products", "Categories", "Brands", "Product approvals", "Pricing management", "Commission management", "Orders", "Purchase orders", "Inventory", "Warehouses", "Delivery", "Payments", "Supplier settlements", "Invoices", "Returns and refunds", "Offers and coupons", "Accounts", "Expenses", "Reports and analytics", "Staff management", "Roles and permissions", "Customer support", "Notifications", "District and area management", "Settings", "Audit logs"] },
  retailer: { label: "Retailer", subtitle: "Your shop workspace", icon: "RT", menu: ["Home", "Product catalogue", "Categories", "Brands", "Product details", "Product search", "Shopping cart", "Checkout", "My orders", "Order details", "Order tracking", "Reorder", "Wishlist", "Offers", "Payment history", "Due details", "Invoices", "Return requests", "Shop profile", "GST details", "Addresses", "Notifications", "Customer support", "Referral and loyalty", "Account settings"] },
  supplier: { label: "Supplier", subtitle: "Seller workspace", icon: "SP", menu: ["Dashboard", "Company profile", "KYC documents", "Products", "Add product", "Edit product", "Product approval status", "Pricing", "Stock management", "Batch and expiry", "New orders", "Accepted orders", "Rejected orders", "Dispatch", "Invoice upload", "Settlement history", "Sales reports", "Returns", "Notifications", "Support", "Settings"] },
  delivery: { label: "Delivery", subtitle: "Last-mile operations", icon: "DV", menu: ["Dashboard", "Assigned orders", "Order details", "Pickup details", "Delivery address", "Shipment status", "Delivery history", "Failed deliveries", "Profile"] },
  warehouse: { label: "Warehouse", subtitle: "Inventory operations · UI preview", icon: "WH", menu: ["Overview", "Stock", "Batch management", "Expiry management", "Stock transfer", "Goods receipt"] },
  accounts: { label: "Accounts", subtitle: "Finance operations · UI preview", icon: "AC", menu: ["Financial overview", "Sales", "Purchases", "Expenses", "Receivables", "Payables", "Profit and loss", "GST reports"] },
  farmer: { label: "Farmer", subtitle: "Farm services · UI preview", icon: "FM", menu: ["Home", "Membership", "Crop records", "Soil testing", "Crop advisory", "Support"] },
};

export const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
