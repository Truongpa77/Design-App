"use client";

import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import "../../customers/customers.css"; // Reuse card, table and modal styles

interface Material {
  id: number;
  material_code: string | null;
  name: string;
  unit: string;
  unit_price: number;
}

interface Warehouse {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
}

interface SummaryReportItem {
  material_id: number;
  material_code: string | null;
  material_name: string;
  material_unit: string;
  material_type: string;
  total_quantity: number;
  total_amount: number;
  total_tax: number;
  grand_total: number;
}

interface DetailReportItem {
  voucher_id: number;
  document_no: string;
  document_date: string;
  partner_name: string;
  warehouse_code: string;
  quantity: number;
  unit_price: number;
  line_amount: number;
  tax_percent: number;
  total_price: number;
  material_name: string;
  material_code: string | null;
  material_unit: string;
}

interface ExportsReportClientProps {
  materials: Material[];
  warehouses: Warehouse[];
  customers: Customer[];
}

export default function ExportsReportClient({
  materials,
  warehouses,
  customers,
}: ExportsReportClientProps) {
  // Filters state
  const getStartOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  };
  const getToday = () => new Date().toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(getStartOfMonth());
  const [toDate, setToDate] = useState(getToday());
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState("");

  // UI state
  const [view, setView] = useState<"summary" | "detail">("summary");
  const [summaryData, setSummaryData] = useState<SummaryReportItem[]>([]);
  const [detailData, setDetailData] = useState<DetailReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Drill-down states
  const [activeMaterial, setActiveMaterial] = useState<{ id: number; name: string; code: string | null } | null>(null);

  // Multi-select materials dropdown state
  const [isMatDropdownOpen, setIsMatDropdownOpen] = useState(false);
  const [matSearchQuery, setMatSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Totals calculations
  const [summaryTotals, setSummaryTotals] = useState({ qty: 0, amount: 0, tax: 0, grand: 0 });
  const [detailTotals, setDetailTotals] = useState({ qty: 0, amount: 0, tax: 0, grand: 0 });

  // Handle click outside to close materials dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMatDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch report data (Summary mode)
  const handleLoadReport = async () => {
    setLoading(true);
    setError("");
    setView("summary");
    setActiveMaterial(null);
    try {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
        mode: "summary",
      });

      if (selectedMaterialIds.length > 0) {
        params.append("material_ids", selectedMaterialIds.join(","));
      }
      if (selectedCustomerId) {
        params.append("customer_id", selectedCustomerId);
      }
      if (selectedWarehouseCode) {
        params.append("warehouse_code", selectedWarehouseCode);
      }

      const res = await fetch(`/api/reports/exports?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể tải báo cáo");
      }
      const data: SummaryReportItem[] = await res.json();
      
      // Calculate totals
      let qty = 0, amt = 0, tax = 0, grand = 0;
      data.forEach(item => {
        qty += Number(item.total_quantity || 0);
        amt += Number(item.total_amount || 0);
        tax += Number(item.total_tax || 0);
        grand += Number(item.grand_total || 0);
      });
      setSummaryTotals({ qty, amount: amt, tax, grand });
      setSummaryData(data);
    } catch (e: any) {
      setError(e.message || "Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  // Fetch detail report data for a specific material
  const handleLoadDetailReport = async (materialId: number, materialName: string, materialCode: string | null) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
        mode: "detail",
        material_id: materialId.toString(),
      });

      if (selectedCustomerId) {
        params.append("customer_id", selectedCustomerId);
      }
      if (selectedWarehouseCode) {
        params.append("warehouse_code", selectedWarehouseCode);
      }

      const res = await fetch(`/api/reports/exports?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể tải báo cáo chi tiết");
      }
      const data: DetailReportItem[] = await res.json();

      // Calculate totals
      let qty = 0, amt = 0, tax = 0, grand = 0;
      data.forEach(item => {
        const itemTax = Number(item.line_amount || 0) * (Number(item.tax_percent || 0) / 100);
        qty += Number(item.quantity || 0);
        amt += Number(item.line_amount || 0);
        tax += itemTax;
        grand += Number(item.total_price || 0);
      });
      setDetailTotals({ qty, amount: amt, tax, grand });
      
      setDetailData(data);
      setActiveMaterial({ id: materialId, name: materialName, code: materialCode });
      setView("detail");
    } catch (e: any) {
      setError(e.message || "Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  // Load report on mount
  useEffect(() => {
    handleLoadReport();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

  // Toggle material selection in dropdown list
  const toggleMaterialSelect = (id: number) => {
    if (selectedMaterialIds.includes(id)) {
      setSelectedMaterialIds(selectedMaterialIds.filter(mid => mid !== id));
    } else {
      setSelectedMaterialIds([...selectedMaterialIds, id]);
    }
  };

  // Select all or none
  const selectAllMaterials = () => {
    setSelectedMaterialIds(materials.map(m => m.id));
  };
  const clearMaterialsSelection = () => {
    setSelectedMaterialIds([]);
  };

  // Filter materials list by search query
  const filteredMaterialsList = materials.filter(m => 
    m.name.toLowerCase().includes(matSearchQuery.toLowerCase()) ||
    (m.material_code && m.material_code.toLowerCase().includes(matSearchQuery.toLowerCase()))
  );

  // Drill down by double clicking summary item
  const handleSummaryRowDoubleClick = (item: SummaryReportItem) => {
    handleLoadDetailReport(item.material_id, item.material_name, item.material_code);
  };

  // Open voucher editing in a new window/tab
  const handleDetailRowDoubleClick = (item: DetailReportItem) => {
    window.open(`/vouchers/export?edit_id=${item.voucher_id}`, "_blank");
  };

  // Export current view data to Excel
  const handleExportExcel = () => {
    const title = view === "summary" ? "BÁO CÁO TỔNG HỢP XUẤT KHO" : `BÁO CÁO CHI TIẾT XUẤT KHO - ${activeMaterial?.name || ""}`;
    const filterInfo = `Từ ngày: ${new Date(fromDate).toLocaleDateString("vi-VN")} - Đến ngày: ${new Date(toDate).toLocaleDateString("vi-VN")} | Kho: ${selectedWarehouseCode || "Tất cả"} | Khách hàng: ${customers.find(c => c.id.toString() === selectedCustomerId)?.name || "Tất cả"}`;
    
    let headers: string[] = [];
    let rows: any[][] = [];

    if (view === "summary") {
      headers = ["STT", "Mã vật tư/SP", "Tên vật tư, sản phẩm", "ĐVT", "Phân loại", "Tổng số lượng", "Đơn giá bình quân (đ)", "Tổng tiền trước thuế (đ)", "Tổng tiền thuế VAT (đ)", "Tổng cộng thanh toán (đ)"];
      rows = summaryData.map((item, idx) => [
        idx + 1,
        item.material_code || "-",
        item.material_name,
        item.material_unit || "-",
        item.material_type || "-",
        item.total_quantity,
        item.total_quantity > 0 ? Math.round(item.total_amount / item.total_quantity) : 0,
        item.total_amount,
        item.total_tax,
        item.grand_total
      ]);
      // Add summary totals row
      rows.push([
        "Tổng cộng", "", "", "", "",
        summaryTotals.qty, "", summaryTotals.amount, summaryTotals.tax, summaryTotals.grand
      ]);
    } else {
      headers = ["STT", "Số chứng từ", "Ngày chứng từ", "Người nhận / Đối tác", "Kho xuất", "Số lượng", "Đơn giá (đ)", "Thành tiền trước thuế (đ)", "% Thuế", "Tiền thuế VAT (đ)", "Tổng thanh toán (đ)"];
      rows = detailData.map((item, idx) => {
        const itemTax = item.line_amount * (item.tax_percent / 100);
        return [
          idx + 1,
          item.document_no,
          new Date(item.document_date).toLocaleDateString("vi-VN"),
          item.partner_name || "-",
          item.warehouse_code || "-",
          item.quantity,
          item.unit_price,
          item.line_amount,
          `${item.tax_percent}%`,
          itemTax,
          item.total_price
        ];
      });
      // Add detailed totals row
      rows.push([
        "Tổng cộng", "", "", "", "",
        detailTotals.qty, "", detailTotals.amount, "", detailTotals.tax, detailTotals.grand
      ]);
    }

    const wb = XLSX.utils.book_new();
    const wsData = [
      [title],
      [filterInfo],
      [],
      headers,
      ...rows
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto-fit column widths
    const maxCols = headers.length;
    const colWidths = [];
    for (let c = 0; c < maxCols; c++) {
      let maxLen = headers[c].toString().length;
      for (let r = 3; r < wsData.length; r++) {
        if (wsData[r][c] !== undefined && wsData[r][c] !== null) {
          const cellLen = wsData[r][c].toString().length;
          if (cellLen > maxLen) maxLen = cellLen;
        }
      }
      colWidths.push({ wch: Math.min(Math.max(maxLen + 3, 8), 50) });
    }
    ws["!cols"] = colWidths;

    // Merge title rows
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } }
    ];

    XLSX.utils.book_append_sheet(wb, ws, view === "summary" ? "TongHop" : "ChiTiet");
    
    const fileName = view === "summary" 
      ? `Bao_Cao_Tong_Hop_Xuat_${fromDate}_${toDate}.xlsx`
      : `Bao_Cao_Chi_Tiet_Xuat_${activeMaterial?.code || activeMaterial?.id}_${fromDate}_${toDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Print view (exports to PDF via standard browser print option)
  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const title = view === "summary" ? "BÁO CÁO TỔNG HỢP XUẤT KHO" : `BÁO CÁO CHI TIẾT XUẤT KHO`;
    const filterInfo = `Từ ngày: ${new Date(fromDate).toLocaleDateString("vi-VN")} - Đến ngày: ${new Date(toDate).toLocaleDateString("vi-VN")} | Kho: ${selectedWarehouseCode || "Tất cả"} | Khách hàng: ${customers.find(c => c.id.toString() === selectedCustomerId)?.name || "Tất cả"}`;
    
    let subHeaderHtml = "";
    if (view === "detail" && activeMaterial) {
      subHeaderHtml = `
        <div style="font-size: 15px; margin-bottom: 15px; text-align: center; color: #333;">
          Vật tư / Sản phẩm: <strong>${activeMaterial.name}</strong> ${activeMaterial.code ? `(Mã: ${activeMaterial.code})` : ""}
        </div>
      `;
    }

    let tableHeadersHtml = "";
    let tableRowsHtml = "";

    if (view === "summary") {
      tableHeadersHtml = `
        <tr>
          <th style="width: 50px; text-align: center;">STT</th>
          <th>Mã vật tư/SP</th>
          <th>Tên vật tư, sản phẩm</th>
          <th style="width: 70px; text-align: center;">ĐVT</th>
          <th style="width: 100px; text-align: center;">Phân loại</th>
          <th style="width: 110px; text-align: right;">Tổng số lượng</th>
          <th style="width: 130px; text-align: right;">Đơn giá bình quân</th>
          <th style="width: 150px; text-align: right;">Tiền hàng trước thuế</th>
          <th style="width: 120px; text-align: right;">Thuế VAT</th>
          <th style="width: 160px; text-align: right;">Tổng cộng thanh toán</th>
        </tr>
      `;

      summaryData.forEach((item, idx) => {
        const avgPrice = item.total_quantity > 0 ? Math.round(item.total_amount / item.total_quantity) : 0;
        tableRowsHtml += `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="font-family: monospace;">${item.material_code || "-"}</td>
            <td style="font-weight: 500;">${item.material_name}</td>
            <td style="text-align: center;">${item.material_unit || "-"}</td>
            <td style="text-align: center;">${item.material_type || "-"}</td>
            <td class="num">${fmt(item.total_quantity)}</td>
            <td class="num">${fmt(avgPrice)}</td>
            <td class="num">${fmt(item.total_amount)}</td>
            <td class="num" style="color: #666;">${fmt(item.total_tax)}</td>
            <td class="num" style="font-weight: bold;">${fmt(item.grand_total)}</td>
          </tr>
        `;
      });

      tableRowsHtml += `
        <tr class="total-row">
          <td colspan="5" style="text-align: right; font-weight: bold;">TỔNG CỘNG</td>
          <td class="num">${fmt(summaryTotals.qty)}</td>
          <td></td>
          <td class="num">${fmt(summaryTotals.amount)}</td>
          <td class="num">${fmt(summaryTotals.tax)}</td>
          <td class="num">${fmt(summaryTotals.grand)}</td>
        </tr>
      `;
    } else {
      tableHeadersHtml = `
        <tr>
          <th style="width: 50px; text-align: center;">STT</th>
          <th style="width: 110px;">Số chứng từ</th>
          <th style="width: 110px; text-align: center;">Ngày chứng từ</th>
          <th>Người nhận / Đối tác</th>
          <th style="width: 80px; text-align: center;">Kho xuất</th>
          <th style="width: 90px; text-align: right;">Số lượng</th>
          <th style="width: 120px; text-align: right;">Đơn giá</th>
          <th style="width: 140px; text-align: right;">Thành tiền trước thuế</th>
          <th style="width: 80px; text-align: center;">% Thuế</th>
          <th style="width: 110px; text-align: right;">Tiền thuế VAT</th>
          <th style="width: 150px; text-align: right;">Tổng thanh toán</th>
        </tr>
      `;

      detailData.forEach((item, idx) => {
        const itemTax = item.line_amount * (item.tax_percent / 100);
        tableRowsHtml += `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="font-family: monospace; font-weight: bold; color: #d97706;">${item.document_no}</td>
            <td style="text-align: center;">${new Date(item.document_date).toLocaleDateString("vi-VN")}</td>
            <td>${item.partner_name || "-"}</td>
            <td style="text-align: center; font-family: monospace;">${item.warehouse_code || "-"}</td>
            <td class="num">${fmt(item.quantity)} ${item.material_unit ? `(${item.material_unit})` : ""}</td>
            <td class="num">${fmt(item.unit_price)}</td>
            <td class="num">${fmt(item.line_amount)}</td>
            <td style="text-align: center;">${item.tax_percent}%</td>
            <td class="num" style="color: #666;">${fmt(itemTax)}</td>
            <td class="num" style="font-weight: bold;">${fmt(item.total_price)}</td>
          </tr>
        `;
      });

      tableRowsHtml += `
        <tr class="total-row">
          <td colspan="5" style="text-align: right; font-weight: bold;">TỔNG CỘNG</td>
          <td class="num">${fmt(detailTotals.qty)}</td>
          <td></td>
          <td class="num">${fmt(detailTotals.amount)}</td>
          <td></td>
          <td class="num">${fmt(detailTotals.tax)}</td>
          <td class="num">${fmt(detailTotals.grand)}</td>
        </tr>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Segoe UI', 'Inter', sans-serif; padding: 40px; color: #111; background: #fff; line-height: 1.4; }
            .header-container { display: flex; justify-content: space-between; margin-bottom: 25px; }
            .company-info { font-size: 13px; text-transform: uppercase; font-weight: bold; }
            .company-addr { font-size: 11px; font-weight: normal; text-transform: none; color: #555; margin-top: 3px; }
            
            .title-block { text-align: center; margin-bottom: 20px; }
            .title-block h1 { font-size: 22px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
            .title-block .date { font-style: italic; font-size: 13px; color: #444; }
            
            .print-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            .print-table th, .print-table td { border: 1px solid #777; padding: 8px 6px; text-align: left; }
            .print-table th { background: #f2f4f7; font-weight: bold; text-transform: uppercase; color: #222; text-align: center; font-size: 11px; }
            .print-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
            .print-table tr.total-row td { background: #f2f4f7; font-weight: bold; font-size: 12px; }
            
            .footer-block { display: flex; justify-content: space-between; margin-top: 50px; font-size: 13px; }
            .signature-cell { width: 250px; text-align: center; }
            .signature-cell .title { font-weight: bold; margin-bottom: 70px; }
            
            .actions { margin-bottom: 25px; display: flex; gap: 10px; }
            .btn { padding: 8px 18px; border-radius: 6px; cursor: pointer; border: 1px solid #ccc; background: #f9f9f9; font-weight: bold; font-size: 13px; }
            .btn-primary { background: #d97706; color: #fff; border-color: #d97706; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
              @page { size: A4 landscape; margin: 1.2cm; }
            }
          </style>
        </head>
        <body>
          <div class="actions no-print">
            <button class="btn btn-primary" onclick="window.print()">🖨️ In Báo Cáo / Lưu PDF</button>
            <button class="btn" onclick="window.close()">Đóng</button>
          </div>
          
          <div class="header-container">
            <div class="company-info">
              CÔNG TY THIẾT KẾ NỘI THẤT TOÀN PHÁT
              <div class="company-addr">Địa chỉ: Số 12, Phố Duy Tân, Cầu Giấy, Hà Nội</div>
            </div>
            <div style="font-size: 11px; font-style: italic; color: #555;">
              Ngày lập: ${new Date().toLocaleDateString("vi-VN")}
            </div>
          </div>

          <div class="title-block">
            <h1>${title}</h1>
            <div class="date">${filterInfo}</div>
          </div>
          
          ${subHeaderHtml}

          <table class="print-table">
            <thead>
              ${tableHeadersHtml}
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-block">
            <div class="signature-cell">
              &nbsp;
            </div>
            <div class="signature-cell">
              <div class="title">Người lập biểu</div>
              <div>(Ký, họ tên)</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="customers-container animate-fade-in" style={{ paddingBottom: "40px" }}>
      {/* Toast Error Alert */}
      {error && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 10000,
          background: "rgba(239, 68, 68, 0.95)", color: "#fff",
          padding: "12px 24px", borderRadius: "8px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
          borderLeft: "4px solid #b91c1c", fontWeight: 500
        }}>
          ❌ {error}
        </div>
      )}

      {/* FILTER NAVIGATOR BAR */}
      <div className="glass-panel" style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "flex-end" }}>
        
        {/* Date Filters */}
        <div className="form-group">
          <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Từ ngày</label>
          <input 
            type="date" 
            className="input-glass" 
            value={fromDate} 
            onChange={e => setFromDate(e.target.value)} 
          />
        </div>
        <div className="form-group">
          <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Đến ngày</label>
          <input 
            type="date" 
            className="input-glass" 
            value={toDate} 
            onChange={e => setToDate(e.target.value)} 
          />
        </div>

        {/* Multi-select materials dropdown */}
        <div className="form-group" ref={dropdownRef} style={{ position: "relative" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Vật tư / Sản phẩm</label>
          <button 
            type="button" 
            className="input-glass"
            style={{ 
              textAlign: "left", 
              background: "rgba(15, 23, 42, 0.6)", 
              color: selectedMaterialIds.length === 0 ? "var(--text-muted)" : "var(--text-main)",
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              cursor: "pointer"
            }}
            onClick={() => setIsMatDropdownOpen(!isMatDropdownOpen)}
          >
            <span>
              {selectedMaterialIds.length === 0 
                ? "Tất cả vật tư / SP" 
                : `Đã chọn ${selectedMaterialIds.length} vật tư`}
            </span>
            <span style={{ fontSize: "10px", transition: "transform 0.2s", transform: isMatDropdownOpen ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
          </button>

          {isMatDropdownOpen && (
            <div className="glass-panel animate-fade-in" style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 1000,
              maxHeight: "300px", display: "flex", flexDirection: "column", padding: "10px",
              background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
            }}>
              {/* Dropdown controls */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <button type="button" className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px", flex: 1 }} onClick={selectAllMaterials}>Chọn hết</button>
                <button type="button" className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px", flex: 1 }} onClick={clearMaterialsSelection}>Bỏ chọn</button>
              </div>
              <input 
                type="text" 
                className="input-glass" 
                placeholder="Tìm kiếm nhanh..." 
                style={{ padding: "6px 10px", fontSize: "12px", marginBottom: "8px" }} 
                value={matSearchQuery}
                onChange={e => setMatSearchQuery(e.target.value)}
              />
              <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                {filteredMaterialsList.map(m => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", cursor: "pointer", padding: "4px 6px", borderRadius: "4px", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <input 
                      type="checkbox" 
                      checked={selectedMaterialIds.includes(m.id)} 
                      onChange={() => toggleMaterialSelect(m.id)}
                    />
                    <span style={{ fontFamily: "monospace", color: "#f59e0b", fontSize: "11.5px" }}>{m.material_code || "-"}</span>
                    <span style={{ color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  </label>
                ))}
                {filteredMaterialsList.length === 0 && (
                  <div style={{ padding: "8px", color: "var(--text-muted)", fontSize: "12px", textAlign: "center" }}>Không tìm thấy</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Customer Filter */}
        <div className="form-group">
          <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Khách hàng / Đối tác nhận</label>
          <select 
            className="input-glass" 
            value={selectedCustomerId} 
            onChange={e => setSelectedCustomerId(e.target.value)}
          >
            <option value="">-- Tất cả khách hàng --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
            ))}
          </select>
        </div>

        {/* Warehouse Filter */}
        <div className="form-group">
          <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Xuất từ kho</label>
          <select 
            className="input-glass" 
            value={selectedWarehouseCode} 
            onChange={e => setSelectedWarehouseCode(e.target.value)}
          >
            <option value="">-- Tất cả kho bãi --</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.warehouse_code}>{w.warehouse_code} - {w.warehouse_name}</option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <button 
          className="btn-primary" 
          style={{ height: "42px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none" }}
          onClick={handleLoadReport}
          disabled={loading}
        >
          🔍 {loading ? "Đang tải..." : "Xem báo cáo"}
        </button>
      </div>

      {/* REPORT CONTENT VIEW */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        
        {/* Report Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "16px" }}>
          <div>
            {view === "detail" && activeMaterial ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span 
                  onClick={handleLoadReport} 
                  style={{ color: "#f59e0b", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px", width: "fit-content" }}
                >
                  ← Quay lại báo cáo tổng hợp
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: 600 }}>Báo cáo chi tiết xuất kho vật tư</h2>
                <div style={{ fontSize: "14px", color: "#f59e0b", fontWeight: 500, marginTop: "2px" }}>
                  Chủng loại: <span style={{ textDecoration: "underline" }}>{activeMaterial.name}</span> {activeMaterial.code ? `(${activeMaterial.code})` : ""}
                </div>
              </div>
            ) : (
              <h2 style={{ fontSize: "20px", fontWeight: 600 }}>Báo cáo tổng hợp xuất vật tư, sản phẩm</h2>
            )}
          </div>
          
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              className="btn-secondary" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "13px", borderColor: "#10b981", color: "#34d399" }}
              onClick={handleExportExcel}
              disabled={loading || (view === "summary" ? summaryData.length === 0 : detailData.length === 0)}
            >
              📥 Xuất Excel
            </button>
            <button 
              className="btn-secondary" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "13px", borderColor: "#f59e0b", color: "#f59e0b" }}
              onClick={handlePrintPDF}
              disabled={loading || (view === "summary" ? summaryData.length === 0 : detailData.length === 0)}
            >
              🖨️ Xuất PDF / In
            </button>
          </div>
        </div>

        {/* Info Instruction */}
        <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px dashed rgba(245,158,11,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#fcd34d", display: "flex", alignItems: "center", gap: "8px" }}>
          💡 <strong>Hướng dẫn nhanh:</strong> 
          {view === "summary" 
            ? "Tích đúp (double-click) vào một dòng vật tư để xem báo cáo xuất kho chi tiết của vật tư đó."
            : "Tích đúp (double-click) vào một dòng phiếu xuất để mở tab mới chỉnh sửa chứng từ."}
        </div>

        {/* TABLES AREA */}
        {loading ? (
          <div style={{ padding: "64px 0", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px", animation: "pulse 1.5s infinite" }}>🔄</div>
            <p>Đang xử lý dữ liệu và truy vấn báo cáo, vui lòng đợi...</p>
          </div>
        ) : view === "summary" ? (
          /* SUMMARY REPORT TABLE */
          <div className="table-container" style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: "1000px" }}>
              <thead>
                <tr>
                  <th style={{ width: "50px", textAlign: "center" }}>STT</th>
                  <th style={{ width: "130px" }}>Mã vật tư/SP</th>
                  <th>Tên vật tư, sản phẩm</th>
                  <th style={{ width: "70px", textAlign: "center" }}>ĐVT</th>
                  <th style={{ width: "110px", textAlign: "center" }}>Phân loại</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Tổng lượng</th>
                  <th style={{ width: "140px", textAlign: "right" }}>Đơn giá TB (đ)</th>
                  <th style={{ width: "150px", textAlign: "right" }}>Tiền trước thuế (đ)</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Thuế VAT (đ)</th>
                  <th style={{ width: "160px", textAlign: "right" }}>Tổng thanh toán (đ)</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map((item, idx) => {
                  const avgPrice = item.total_quantity > 0 ? Math.round(item.total_amount / item.total_quantity) : 0;
                  return (
                    <tr 
                      key={item.material_id} 
                      onDoubleClick={() => handleSummaryRowDoubleClick(item)}
                      style={{ cursor: "pointer", transition: "background 0.2s" }}
                      title="Kích đúp để xem chi tiết"
                    >
                      <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td style={{ fontFamily: "monospace", color: "#f59e0b", fontWeight: 600 }}>{item.material_code || "-"}</td>
                      <td className="font-medium" style={{ color: "#fff" }}>{item.material_name}</td>
                      <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{item.material_unit || "-"}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ 
                          fontSize: "11px", 
                          padding: "2px 6px", 
                          borderRadius: "4px",
                          fontWeight: 500,
                          background: item.material_type === "Ván" ? "rgba(245,158,11,0.15)" : item.material_type === "Nẹp chỉ" ? "rgba(249,115,22,0.15)" : item.material_type.startsWith("Phụ kiện") ? "rgba(167,139,250,0.15)" : "rgba(16,185,129,0.15)",
                          color: item.material_type === "Ván" ? "#f59e0b" : item.material_type === "Nẹp chỉ" ? "#f97316" : item.material_type.startsWith("Phụ kiện") ? "#c084fc" : "#34d399"
                        }}>
                          {item.material_type}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13.5px" }}>{fmt(item.total_quantity)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13.5px" }}>{fmt(avgPrice)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13.5px" }}>{fmt(item.total_amount)}</td>
                      <td style={{ textAlign: "right", color: "#f59e0b", fontFamily: "monospace", fontSize: "13.5px" }}>{fmt(item.total_tax)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#ef4444", fontFamily: "monospace", fontSize: "14px" }}>{fmt(item.grand_total)}</td>
                    </tr>
                  );
                })}
                {summaryData.length > 0 && (
                  <tr style={{ background: "rgba(255,255,255,0.03)", fontWeight: "bold" }}>
                    <td colSpan={5} style={{ textAlign: "right", padding: "16px", color: "var(--text-main)" }}>TỔNG CỘNG</td>
                    <td style={{ textAlign: "right", padding: "16px", fontFamily: "monospace" }}>{fmt(summaryTotals.qty)}</td>
                    <td></td>
                    <td style={{ textAlign: "right", padding: "16px", fontFamily: "monospace" }}>{fmt(summaryTotals.amount)}</td>
                    <td style={{ textAlign: "right", padding: "16px", color: "#f59e0b", fontFamily: "monospace" }}>{fmt(summaryTotals.tax)}</td>
                    <td style={{ textAlign: "right", padding: "16px", color: "#ef4444", fontFamily: "monospace", fontSize: "14.5px" }}>{fmt(summaryTotals.grand)}</td>
                  </tr>
                )}
                {summaryData.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>Không tìm thấy dữ liệu xuất kho khớp với bộ lọc</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* DETAILED REPORT TABLE */
          <div className="table-container" style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: "1100px" }}>
              <thead>
                <tr>
                  <th style={{ width: "50px", textAlign: "center" }}>STT</th>
                  <th style={{ width: "120px" }}>Số chứng từ</th>
                  <th style={{ width: "120px", textAlign: "center" }}>Ngày chứng từ</th>
                  <th>Người nhận / Nhà cung cấp</th>
                  <th style={{ width: "100px", textAlign: "center" }}>Kho xuất</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Số lượng xuất</th>
                  <th style={{ width: "130px", textAlign: "right" }}>Đơn giá (đ)</th>
                  <th style={{ width: "150px", textAlign: "right" }}>Thành tiền (đ)</th>
                  <th style={{ width: "80px", textAlign: "center" }}>% Thuế</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Tiền thuế (đ)</th>
                  <th style={{ width: "160px", textAlign: "right" }}>Tổng thanh toán (đ)</th>
                </tr>
              </thead>
              <tbody>
                {detailData.map((item, idx) => {
                  const itemTax = item.line_amount * (item.tax_percent / 100);
                  return (
                    <tr 
                      key={idx} 
                      onDoubleClick={() => handleDetailRowDoubleClick(item)}
                      style={{ cursor: "pointer", transition: "background 0.2s" }}
                      title="Kích đúp để mở trang sửa phiếu xuất"
                    >
                      <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td style={{ fontFamily: "monospace", color: "#f59e0b", fontWeight: 700, letterSpacing: "0.04em" }}>{item.document_no}</td>
                      <td style={{ textAlign: "center" }}>{new Date(item.document_date).toLocaleDateString("vi-VN")}</td>
                      <td className="font-medium">{item.partner_name || "-"}</td>
                      <td style={{ textAlign: "center", fontFamily: "monospace" }}>{item.warehouse_code || "-"}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13px" }}>
                        {fmt(item.quantity)} <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.material_unit || ""}</span>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13px" }}>{fmt(item.unit_price)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "13px" }}>{fmt(item.line_amount)}</td>
                      <td style={{ textAlign: "center", color: "#f59e0b" }}>{item.tax_percent}%</td>
                      <td style={{ textAlign: "right", color: "#f59e0b", fontFamily: "monospace", fontSize: "13px" }}>{fmt(itemTax)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#ef4444", fontFamily: "monospace", fontSize: "13.5px" }}>{fmt(item.total_price)}</td>
                    </tr>
                  );
                })}
                {detailData.length > 0 && (
                  <tr style={{ background: "rgba(255,255,255,0.03)", fontWeight: "bold" }}>
                    <td colSpan={5} style={{ textAlign: "right", padding: "16px", color: "var(--text-main)" }}>TỔNG CỘNG</td>
                    <td style={{ textAlign: "right", padding: "16px", fontFamily: "monospace" }}>{fmt(detailTotals.qty)}</td>
                    <td></td>
                    <td style={{ textAlign: "right", padding: "16px", fontFamily: "monospace" }}>{fmt(detailTotals.amount)}</td>
                    <td></td>
                    <td style={{ textAlign: "right", padding: "16px", color: "#f59e0b", fontFamily: "monospace" }}>{fmt(detailTotals.tax)}</td>
                    <td style={{ textAlign: "right", padding: "16px", color: "#ef4444", fontFamily: "monospace", fontSize: "14px" }}>{fmt(detailTotals.grand)}</td>
                  </tr>
                )}
                {detailData.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>Không có lịch sử xuất kho của vật tư này trong khoảng thời gian đã chọn</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
