"use client";

import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import "../../customers/customers.css"; // Reusing card, table and modal styles

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

interface InventoryReportItem {
  warehouse_code: string;
  warehouse_name: string;
  material_id: number;
  material_code: string | null;
  material_name: string;
  material_unit: string;
  opening_qty: number;
  opening_val: number;
  import_qty: number;
  import_val: number;
  export_qty: number;
  export_val: number;
  closing_qty: number;
  closing_val: number;
}

interface InventoryReportClientProps {
  materials: Material[];
  warehouses: Warehouse[];
}

export default function InventoryReportClient({
  materials,
  warehouses,
}: InventoryReportClientProps) {
  // Filters state
  const getStartOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  };
  const getToday = () => new Date().toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(getStartOfMonth());
  const [toDate, setToDate] = useState(getToday());
  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState("");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);

  // UI state
  const [reportData, setReportData] = useState<InventoryReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Multi-select materials dropdown state
  const [isMatDropdownOpen, setIsMatDropdownOpen] = useState(false);
  const [matSearchQuery, setMatSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch report data
  const handleLoadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
      });

      if (selectedWarehouseCode) {
        params.append("warehouse_code", selectedWarehouseCode);
      }
      if (selectedMaterialIds.length > 0) {
        params.append("material_ids", selectedMaterialIds.join(","));
      }

      const res = await fetch(`/api/reports/inventory?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể tải báo cáo nhập xuất tồn");
      }
      const data: InventoryReportItem[] = await res.json();
      setReportData(data);
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

  // Group report data by warehouse
  const getGroupedData = () => {
    const grouped: { [key: string]: { name: string; items: InventoryReportItem[] } } = {};
    reportData.forEach(item => {
      if (!grouped[item.warehouse_code]) {
        grouped[item.warehouse_code] = {
          name: item.warehouse_name,
          items: [],
        };
      }
      grouped[item.warehouse_code].items.push(item);
    });
    return grouped;
  };

  const groupedData = getGroupedData();

  // Calculate totals for a group of items
  const getTotals = (items: InventoryReportItem[]) => {
    let opening_qty = 0;
    let opening_val = 0;
    let import_qty = 0;
    let import_val = 0;
    let export_qty = 0;
    let export_val = 0;
    let closing_qty = 0;
    let closing_val = 0;

    items.forEach(item => {
      opening_qty += item.opening_qty;
      opening_val += item.opening_val;
      import_qty += item.import_qty;
      import_val += item.import_val;
      export_qty += item.export_qty;
      export_val += item.export_val;
      closing_qty += item.closing_qty;
      closing_val += item.closing_val;
    });

    return {
      opening_qty,
      opening_val,
      import_qty,
      import_val,
      export_qty,
      export_val,
      closing_qty,
      closing_val,
    };
  };

  const grandTotals = getTotals(reportData);

  // Export to Excel
  const handleExportExcel = () => {
    const title = "BÁO CÁO NHẬP XUẤT TỒN KHO VẬT TƯ, SẢN PHẨM";
    const filterInfo = `Từ ngày: ${new Date(fromDate).toLocaleDateString("vi-VN")} - Đến ngày: ${new Date(toDate).toLocaleDateString("vi-VN")} | Kho: ${
      selectedWarehouseCode 
        ? warehouses.find(w => w.warehouse_code === selectedWarehouseCode)?.warehouse_name || selectedWarehouseCode 
        : "Tất cả các kho"
    }`;

    const headers = [
      "STT",
      "Mã vật tư/SP",
      "Tên vật tư, sản phẩm",
      "ĐVT",
      "SL Đầu kỳ",
      "Tiền Đầu kỳ",
      "SL Nhập",
      "Tiền Nhập",
      "SL Xuất",
      "Tiền Xuất",
      "SL Tồn cuối",
      "Tiền Tồn cuối"
    ];

    const rows: any[][] = [];

    Object.keys(groupedData).forEach(wCode => {
      const g = groupedData[wCode];
      // Add warehouse group title row
      rows.push([`KHO: ${g.name} (${wCode})`, "", "", "", "", "", "", "", "", "", "", ""]);
      
      g.items.forEach((item, idx) => {
        rows.push([
          idx + 1,
          item.material_code || "-",
          item.material_name,
          item.material_unit || "-",
          item.opening_qty,
          item.opening_val,
          item.import_qty,
          item.import_val,
          item.export_qty,
          item.export_val,
          item.closing_qty,
          item.closing_val
        ]);
      });

      // Add subtotal row for this warehouse
      const sub = getTotals(g.items);
      rows.push([
        `Cộng kho ${wCode}`,
        "",
        "",
        "",
        sub.opening_qty,
        sub.opening_val,
        sub.import_qty,
        sub.import_val,
        sub.export_qty,
        sub.export_val,
        sub.closing_qty,
        sub.closing_val
      ]);
    });

    // Add grand total row
    rows.push([
      "TỔNG CỘNG BÁO CÁO",
      "",
      "",
      "",
      grandTotals.opening_qty,
      grandTotals.opening_val,
      grandTotals.import_qty,
      grandTotals.import_val,
      grandTotals.export_qty,
      grandTotals.export_val,
      grandTotals.closing_qty,
      grandTotals.closing_val
    ]);

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

    // Merge title and info rows
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } }
    ];

    // Merge warehouse header rows (optional but keeps it cleaner)
    // Find rows that start with "KHO:" and merge them from column 0 to 11
    let currentRowIdx = 4; // Excel rows are 0-indexed, wsData starts with title (0), info (1), empty (2), headers (3). Rows start at 4.
    Object.keys(groupedData).forEach(wCode => {
      const g = groupedData[wCode];
      ws["!merges"]?.push({
        s: { r: currentRowIdx, c: 0 },
        e: { r: currentRowIdx, c: maxCols - 1 }
      });
      currentRowIdx += g.items.length + 2; // +1 for items, +1 for the Cộng kho row
    });

    XLSX.utils.book_append_sheet(wb, ws, "NhapXuatTon");
    XLSX.writeFile(wb, `Bao_Cao_Nhap_Xuat_Ton_${fromDate}_${toDate}.xlsx`);
  };

  // Print/PDF Export
  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const title = "BÁO CÁO NHẬP XUẤT TỒN KHO VẬT TƯ, SẢN PHẨM";
    const filterInfo = `Từ ngày: ${new Date(fromDate).toLocaleDateString("vi-VN")} - Đến ngày: ${new Date(toDate).toLocaleDateString("vi-VN")} | Kho: ${
      selectedWarehouseCode 
        ? warehouses.find(w => w.warehouse_code === selectedWarehouseCode)?.warehouse_name || selectedWarehouseCode 
        : "Tất cả các kho"
    }`;

    let tableRowsHtml = "";

    Object.keys(groupedData).forEach(wCode => {
      const g = groupedData[wCode];
      // Warehouse Header Row
      tableRowsHtml += `
        <tr class="group-header" style="font-weight: bold; background-color: #f2f4f7;">
          <td colspan="12" style="font-weight: bold; padding: 10px 8px; border: 1px solid #777;">
            KHO: ${g.name} (${wCode})
          </td>
        </tr>
      `;

      g.items.forEach((item, idx) => {
        tableRowsHtml += `
          <tr>
            <td style="text-align: center; border: 1px solid #777; padding: 8px;">${idx + 1}</td>
            <td style="font-family: monospace; border: 1px solid #777; padding: 8px;">${item.material_code || "-"}</td>
            <td style="border: 1px solid #777; padding: 8px; font-weight: 500;">${item.material_name}</td>
            <td style="text-align: center; border: 1px solid #777; padding: 8px;">${item.material_unit || "-"}</td>
            <td class="num">${item.opening_qty !== 0 ? fmt(item.opening_qty) : "-"}</td>
            <td class="num" style="font-weight: 500;">${item.opening_val !== 0 ? fmt(item.opening_val) : "-"}</td>
            <td class="num">${item.import_qty !== 0 ? fmt(item.import_qty) : "-"}</td>
            <td class="num">${item.import_val !== 0 ? fmt(item.import_val) : "-"}</td>
            <td class="num">${item.export_qty !== 0 ? fmt(item.export_qty) : "-"}</td>
            <td class="num">${item.export_val !== 0 ? fmt(item.export_val) : "-"}</td>
            <td class="num" style="font-weight: 500;">${item.closing_qty !== 0 ? fmt(item.closing_qty) : "-"}</td>
            <td class="num" style="font-weight: bold;">${item.closing_val !== 0 ? fmt(item.closing_val) : "-"}</td>
          </tr>
        `;
      });

      // Warehouse Subtotal Row
      const sub = getTotals(g.items);
      tableRowsHtml += `
        <tr class="subtotal-row" style="font-weight: bold; background-color: #f2f4f7;">
          <td colspan="4" style="border: 1px solid #777; padding: 8px; text-align: left;">Cộng kho: ${wCode}</td>
          <td class="num">${sub.opening_qty !== 0 ? fmt(sub.opening_qty) : "-"}</td>
          <td class="num">${sub.opening_val !== 0 ? fmt(sub.opening_val) : "-"}</td>
          <td class="num">${sub.import_qty !== 0 ? fmt(sub.import_qty) : "-"}</td>
          <td class="num">${sub.import_val !== 0 ? fmt(sub.import_val) : "-"}</td>
          <td class="num">${sub.export_qty !== 0 ? fmt(sub.export_qty) : "-"}</td>
          <td class="num">${sub.export_val !== 0 ? fmt(sub.export_val) : "-"}</td>
          <td class="num">${sub.closing_qty !== 0 ? fmt(sub.closing_qty) : "-"}</td>
          <td class="num">${sub.closing_val !== 0 ? fmt(sub.closing_val) : "-"}</td>
        </tr>
      `;
    });

    // Grand Total Row
    tableRowsHtml += `
      <tr class="grand-total-row" style="font-weight: bold; background-color: #f2f4f7;">
        <td colspan="4" style="border: 1px solid #777; padding: 10px 8px; text-align: left; text-transform: uppercase;">Tổng cộng toàn báo cáo</td>
        <td class="num">${grandTotals.opening_qty !== 0 ? fmt(grandTotals.opening_qty) : "-"}</td>
        <td class="num">${grandTotals.opening_val !== 0 ? fmt(grandTotals.opening_val) : "-"}</td>
        <td class="num">${grandTotals.import_qty !== 0 ? fmt(grandTotals.import_qty) : "-"}</td>
        <td class="num">${grandTotals.import_val !== 0 ? fmt(grandTotals.import_val) : "-"}</td>
        <td class="num">${grandTotals.export_qty !== 0 ? fmt(grandTotals.export_qty) : "-"}</td>
        <td class="num">${grandTotals.export_val !== 0 ? fmt(grandTotals.export_val) : "-"}</td>
        <td class="num">${grandTotals.closing_qty !== 0 ? fmt(grandTotals.closing_qty) : "-"}</td>
        <td class="num" style="font-size: 13px;">${grandTotals.closing_val !== 0 ? fmt(grandTotals.closing_val) : "-"}</td>
      </tr>
    `;

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
            .btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
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

          <table class="print-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 40px;">STT</th>
                <th rowspan="2" style="width: 100px;">Mã vật tư</th>
                <th rowspan="2">Tên sản phẩm vật tư</th>
                <th rowspan="2" style="width: 50px;">ĐVT</th>
                <th colspan="2">Đầu kỳ</th>
                <th colspan="2">Nhập trong kỳ</th>
                <th colspan="2">Xuất trong kỳ</th>
                <th colspan="2">Tồn cuối kỳ</th>
              </tr>
              <tr>
                <th style="width: 80px; text-align: right;">Số lượng</th>
                <th style="width: 100px; text-align: right;">Tiền trước thuế</th>
                <th style="width: 80px; text-align: right;">Số lượng</th>
                <th style="width: 100px; text-align: right;">Tiền trước thuế</th>
                <th style="width: 80px; text-align: right;">Số lượng</th>
                <th style="width: 100px; text-align: right;">Tiền trước thuế</th>
                <th style="width: 80px; text-align: right;">Số lượng</th>
                <th style="width: 100px; text-align: right;">Tiền trước thuế</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-block">
            <div class="signature-cell">
              <div class="title">Thủ kho</div>
              <div>(Ký, họ tên)</div>
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

        {/* Warehouse Filter */}
        <div className="form-group">
          <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Kho bãi</label>
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
          style={{ height: "42px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none" }}
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
            <h2 style={{ fontSize: "20px", fontWeight: 600 }}>Báo cáo tổng hợp Nhập - Xuất - Tồn kho</h2>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
              Khoảng thời gian: <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{new Date(fromDate).toLocaleDateString("vi-VN")}</span> đến <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{new Date(toDate).toLocaleDateString("vi-VN")}</span>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              className="btn-secondary" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "13px", borderColor: "#10b981", color: "#34d399" }}
              onClick={handleExportExcel}
              disabled={reportData.length === 0}
            >
              📥 Xuất Excel
            </button>
            <button 
              className="btn-secondary" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "13px", borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
              onClick={handlePrintPDF}
              disabled={reportData.length === 0}
            >
              🖨️ In / Xuất PDF
            </button>
          </div>
        </div>

        {/* REPORT TABLE */}
        <div className="table-container">
          <table className="data-table" style={{ width: "100%", minWidth: "1200px" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <th rowSpan={2} style={{ width: "50px", textAlign: "center", verticalAlign: "middle", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>STT</th>
                <th rowSpan={2} style={{ width: "120px", verticalAlign: "middle", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Mã vật tư</th>
                <th rowSpan={2} style={{ verticalAlign: "middle", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Tên sản phẩm vật tư</th>
                <th rowSpan={2} style={{ width: "70px", textAlign: "center", verticalAlign: "middle", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>ĐVT</th>
                <th colSpan={2} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>Đầu kỳ</th>
                <th colSpan={2} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>Nhập trong kỳ</th>
                <th colSpan={2} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>Xuất trong kỳ</th>
                <th colSpan={2} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>Tồn cuối kỳ</th>
              </tr>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <th style={{ width: "80px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>SL</th>
                <th style={{ width: "120px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Tiền</th>
                <th style={{ width: "80px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>SL</th>
                <th style={{ width: "120px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Tiền</th>
                <th style={{ width: "80px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>SL</th>
                <th style={{ width: "120px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Tiền</th>
                <th style={{ width: "80px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>SL</th>
                <th style={{ width: "120px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Tiền</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedData).length > 0 ? (
                Object.keys(groupedData).map(wCode => {
                  const g = groupedData[wCode];
                  const sub = getTotals(g.items);

                  return (
                    <React.Fragment key={wCode}>
                      {/* Warehouse header row */}
                      <tr style={{ background: "rgba(16, 185, 129, 0.08)", fontWeight: 600 }}>
                        <td colSpan={12} style={{ padding: "12px 16px", color: "#34d399", fontSize: "14px", borderBottom: "1px solid rgba(16, 185, 129, 0.2)" }}>
                          📦 Kho: {g.name} ({wCode})
                        </td>
                      </tr>

                      {/* Items rows */}
                      {g.items.map((item, idx) => (
                        <tr key={`${wCode}-${item.material_id}`}>
                          <td className="text-center" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                          <td style={{ fontFamily: "monospace", color: "#f59e0b" }}>{item.material_code || "-"}</td>
                          <td className="font-medium">{item.material_name}</td>
                          <td className="text-center">{item.material_unit || "-"}</td>
                          {/* Opening */}
                          <td style={{ textAlign: "right" }}>{item.opening_qty !== 0 ? fmt(item.opening_qty) : "-"}</td>
                          <td style={{ textAlign: "right", color: item.opening_val !== 0 ? "var(--text-main)" : "var(--text-muted)" }}>{item.opening_val !== 0 ? fmt(item.opening_val) : "-"}</td>
                          {/* Imports */}
                          <td style={{ textAlign: "right" }}>{item.import_qty !== 0 ? fmt(item.import_qty) : "-"}</td>
                          <td style={{ textAlign: "right" }}>{item.import_val !== 0 ? fmt(item.import_val) : "-"}</td>
                          {/* Exports */}
                          <td style={{ textAlign: "right" }}>{item.export_qty !== 0 ? fmt(item.export_qty) : "-"}</td>
                          <td style={{ textAlign: "right" }}>{item.export_val !== 0 ? fmt(item.export_val) : "-"}</td>
                          {/* Closing */}
                          <td style={{ textAlign: "right", fontWeight: 500, color: item.closing_qty < 0 ? "#ef4444" : "var(--text-main)" }}>{item.closing_qty !== 0 ? fmt(item.closing_qty) : "-"}</td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: item.closing_val < 0 ? "#ef4444" : "#10b981" }}>{item.closing_val !== 0 ? fmt(item.closing_val) : "-"}</td>
                        </tr>
                      ))}

                      {/* Warehouse subtotal row */}
                      <tr style={{ background: "rgba(255, 255, 255, 0.03)", fontWeight: "bold" }}>
                        <td colSpan={4} style={{ padding: "12px 16px" }}>Cộng kho: {wCode}</td>
                        <td style={{ textAlign: "right" }}>{sub.opening_qty !== 0 ? fmt(sub.opening_qty) : "-"}</td>
                        <td style={{ textAlign: "right" }}>{sub.opening_val !== 0 ? fmt(sub.opening_val) : "-"}</td>
                        <td style={{ textAlign: "right" }}>{sub.import_qty !== 0 ? fmt(sub.import_qty) : "-"}</td>
                        <td style={{ textAlign: "right" }}>{sub.import_val !== 0 ? fmt(sub.import_val) : "-"}</td>
                        <td style={{ textAlign: "right" }}>{sub.export_qty !== 0 ? fmt(sub.export_qty) : "-"}</td>
                        <td style={{ textAlign: "right" }}>{sub.export_val !== 0 ? fmt(sub.export_val) : "-"}</td>
                        <td style={{ textAlign: "right" }}>{sub.closing_qty !== 0 ? fmt(sub.closing_qty) : "-"}</td>
                        <td style={{ textAlign: "right", color: "#10b981" }}>{sub.closing_val !== 0 ? fmt(sub.closing_val) : "-"}</td>
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-muted">
                    {loading ? "Đang truy vấn dữ liệu báo cáo..." : "Không tìm thấy dữ liệu phát sinh Nhập - Xuất - Tồn trong khoảng thời gian này."}
                  </td>
                </tr>
              )}

              {/* Grand Total row */}
              {reportData.length > 0 && (
                <tr style={{ background: "rgba(var(--primary-color-rgb), 0.15)", fontWeight: "bold", borderTop: "2px solid var(--primary-color)" }}>
                  <td colSpan={4} style={{ padding: "14px 16px", color: "var(--primary-color)", textTransform: "uppercase", fontSize: "13px" }}>Tổng cộng toàn báo cáo</td>
                  <td style={{ textAlign: "right" }}>{grandTotals.opening_qty !== 0 ? fmt(grandTotals.opening_qty) : "-"}</td>
                  <td style={{ textAlign: "right", color: "var(--primary-color)" }}>{grandTotals.opening_val !== 0 ? fmt(grandTotals.opening_val) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{grandTotals.import_qty !== 0 ? fmt(grandTotals.import_qty) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{grandTotals.import_val !== 0 ? fmt(grandTotals.import_val) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{grandTotals.export_qty !== 0 ? fmt(grandTotals.export_qty) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{grandTotals.export_val !== 0 ? fmt(grandTotals.export_val) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{grandTotals.closing_qty !== 0 ? fmt(grandTotals.closing_qty) : "-"}</td>
                  <td style={{ textAlign: "right", color: "#10b981", fontSize: "14px" }}>{grandTotals.closing_val !== 0 ? fmt(grandTotals.closing_val) : "-"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
