// ============================================================
// BẢNG KHAI BÁO MENU - CẤU HÌNH TOÀN BỘ SIDEBAR
// ============================================================
// Để thêm menu mới: thêm 1 dòng vào mảng `items` của nhóm tương ứng
// Để thêm phân hệ mới: thêm 1 object MenuGroup vào mảng `menuConfig`
// ============================================================

/**
 * Kiểu dữ liệu cho từng menu item (mục con trong phân hệ)
 */
export interface MenuItem {
  /** Tên hiển thị trên sidebar (VD: "Khách hàng") */
  label: string;
  /** Emoji icon (VD: "👥") */
  icon: string;
  /** Route path — phải khớp với thư mục trong /src/app/ (VD: "/customers") */
  path: string;
}

/**
 * Kiểu dữ liệu cho từng phân hệ (nhóm menu)
 */
export interface MenuGroup {
  /** Số thứ tự phân hệ — hiển thị trên sidebar (VD: 1 → "1. DANH MỤC") */
  id: number;
  /** Tên phân hệ (VD: "DANH MỤC") */
  title: string;
  /** Danh sách menu items thuộc phân hệ này */
  items: MenuItem[];
}

// ============================================================
// BẢNG KHAI BÁO MENU CHÍNH
// ============================================================
// Thêm/sửa/xoá phân hệ và menu items tại đây.
// Sidebar sẽ tự động render dựa trên bảng này.
// ============================================================

export const menuConfig: MenuGroup[] = [
  // ----------------------------------------------------------
  // 1. DANH MỤC
  // ----------------------------------------------------------
  {
    id: 1,
    title: "DANH MỤC",
    items: [
      { label: "Khách hàng",             icon: "👥", path: "/customers" },
      { label: "Vật tư & SP",            icon: "🧱", path: "/materials" },
      { label: "Kho bãi",                icon: "📦", path: "/warehouse" },
      { label: "Công trình & Hạng mục",  icon: "🏗️", path: "/projects" },
      { label: "Định mức BOM",           icon: "⚙️", path: "/bom" },
      { label: "Danh mục tài khoản",     icon: "💳", path: "/accounts" },
    ],
  },

  // ----------------------------------------------------------
  // 2. CHỨNG TỪ
  // ----------------------------------------------------------
  {
    id: 2,
    title: "CHỨNG TỪ",
    items: [
      { label: "Báo giá",    icon: "📝", path: "/quotations" },
      { label: "Phiếu nhập", icon: "📥", path: "/vouchers/import" },
      { label: "Phiếu xuất", icon: "📤", path: "/vouchers/export" },
      { label: "Phiếu thu",  icon: "💵", path: "/vouchers/receipt" },
      { label: "Phiếu chi",  icon: "💸", path: "/vouchers/payment" },
      { label: "Báo nợ",     icon: "🏦", path: "/vouchers/debit-advice" },
      { label: "Báo có",     icon: "🏦", path: "/vouchers/credit-advice" },
    ],
  },

  // ----------------------------------------------------------
  // 3. TỔNG HỢP
  // ----------------------------------------------------------
  {
    id: 3,
    title: "TỔNG HỢP",
    items: [
      { label: "Tính nhu cầu mua",    icon: "🧮", path: "/synthesis/bom-calc" },
      { label: "Tồn kho đầu kỳ",      icon: "📥", path: "/synthesis/opening-stock" },
      { label: "Số dư đầu tài khoản", icon: "💵", path: "/synthesis/opening-balances" },
    ],
  },

  // ----------------------------------------------------------
  // 4. BÁO CÁO
  // ----------------------------------------------------------
  {
    id: 4,
    title: "BÁO CÁO",
    items: [
      { label: "Báo cáo nhập",              icon: "📊", path: "/reports/imports" },
      { label: "Báo cáo xuất",              icon: "📈", path: "/reports/exports" },
      { label: "Nhập xuất tồn",             icon: "📋", path: "/reports/inventory" },
      { label: "Số quỹ hoặc sổ ngân hàng",  icon: "💵", path: "/reports/cashbook" },
    ],
  },

  // ----------------------------------------------------------
  // 5. HỆ THỐNG
  // ----------------------------------------------------------
  {
    id: 5,
    title: "HỆ THỐNG",
    items: [
      { label: "Người sử dụng",      icon: "🧑‍💻", path: "/system/users" },
      { label: "Thiết lập hệ thống", icon: "⚙️",  path: "/system/settings" },
    ],
  },
];
