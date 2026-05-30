"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "../../customers/customers.css"; // Reusing card, table and modal styles

interface Account {
  account_code: string;
  account_name: string;
}

interface CashbookItem {
  voucher_id: number;
  document_no: string;
  voucher_type: string;
  document_date: string;
  partner_name: string;
  description: string;
  debit_account: string;
  credit_account: string;
  amount: number;
}

interface CashbookReportClientProps {
  accounts: Account[];
}

export default function CashbookReportClient({
  accounts,
}: CashbookReportClientProps) {
  // Filters state
  const getStartOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  };
  const getToday = () => new Date().toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(getStartOfMonth());
  const [toDate, setToDate] = useState(getToday());
  const [selectedAccountCode, setSelectedAccountCode] = useState("111");

  // UI state
  const [openingBalance, setOpeningBalance] = useState(0);
  const [rawItems, setRawItems] = useState<CashbookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch report data
  const handleLoadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
        account_code: selectedAccountCode,
      });

      const res = await fetch(`/api/reports/cashbook?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể tải báo cáo sổ quỹ");
      }
      const data = await res.json();
      setOpeningBalance(data.opening_balance || 0);
      setRawItems(data.items || []);
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

  // Get active account details
  const activeAccount = accounts.find(a => a.account_code === selectedAccountCode) || {
    account_code: selectedAccountCode,
    account_name: "Tiền mặt",
  };

  // Determine report title based on selected account
  const getReportTitle = () => {
    if (selectedAccountCode.startsWith("111")) {
      return "SỔ QUỸ TIỀN MẶT";
    } else if (selectedAccountCode.startsWith("112")) {
      return "SỔ TIỀN GỬI NGÂN HÀNG";
    } else {
      return "SỔ CHI TIẾT TÀI KHOẢN";
    }
  };

  // Process items to insert Thu/Chi values and calculate running balance
  const getProcessedItems = () => {
    let currentBal = Number(openingBalance) || 0;
    let totalThu = 0;
    let totalChi = 0;

    const items = rawItems.map(item => {
      const isDebit = !!(item.debit_account && item.debit_account.startsWith(selectedAccountCode));
      const isCredit = !!(item.credit_account && item.credit_account.startsWith(selectedAccountCode));

      let thu = 0;
      let chi = 0;
      const amt = Number(item.amount) || 0;

      if (isDebit) {
        thu = amt;
        totalThu += amt;
      }
      if (isCredit) {
        chi = amt;
        totalChi += amt;
      }

      currentBal = currentBal + thu - chi;

      return {
        ...item,
        thu,
        chi,
        running_bal: currentBal,
      };
    });

    return {
      items,
      total_thu: totalThu,
      total_chi: totalChi,
      closing_balance: currentBal,
    };
  };

  const { items, total_thu, total_chi, closing_balance } = getProcessedItems();

  // Export to Excel
  const handleExportExcel = () => {
    const title = getReportTitle();
    const filterInfo = `Từ ngày: ${new Date(fromDate).toLocaleDateString("vi-VN")} - Đến ngày: ${new Date(toDate).toLocaleDateString("vi-VN")} | Tài khoản: ${activeAccount.account_code} - ${activeAccount.account_name}`;

    const headers = [
      "Ngày, tháng ghi sổ",
      "Số hiệu CT Thu",
      "Số hiệu CT Chi",
      "Diễn giải",
      "Số tiền Thu",
      "Số tiền Chi",
      "Số tiền Tồn",
      "Ghi chú"
    ];

    const rows: any[][] = [];

    // 1. Opening balance row
    rows.push(["", "", "", "Số dư đầu kỳ", "", "", openingBalance, ""]);

    // 2. Transaction rows
    items.forEach(item => {
      rows.push([
        new Date(item.document_date).toLocaleDateString("vi-VN"),
        item.thu > 0 ? item.document_no : "",
        item.chi > 0 ? item.document_no : "",
        item.description,
        item.thu > 0 ? item.thu : "",
        item.chi > 0 ? item.chi : "",
        item.running_bal,
        ""
      ]);
    });

    // 3. Totals row
    rows.push(["", "", "", "Tổng số phát sinh", total_thu, total_chi, "", ""]);

    // 4. Closing balance row
    rows.push(["", "", "", "Số dư cuối kỳ", "", "", closing_balance, ""]);

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

    XLSX.utils.book_append_sheet(wb, ws, "SoQuy");
    XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}_${fromDate}_${toDate}.xlsx`);
  };

  // Print/PDF Export
  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const title = getReportTitle();
    const filterInfo = `Từ ngày ${new Date(fromDate).toLocaleDateString("vi-VN")} đến ngày ${new Date(toDate).toLocaleDateString("vi-VN")}`;
    const accountInfo = `Tài khoản: ${activeAccount.account_code}: ${activeAccount.account_name}`;

    let tableRowsHtml = "";

    // 1. Opening balance row
    tableRowsHtml += `
      <tr style="font-weight: 500;">
        <td style="border: 1px solid #777; padding: 8px; text-align: center;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px; font-weight: bold;">Số dư đầu kỳ</td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td class="num" style="border: 1px solid #777; padding: 8px; font-weight: bold;">${openingBalance !== 0 ? fmt(openingBalance) : "0"}</td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
      </tr>
    `;

    // 2. Transaction rows
    items.forEach(item => {
      tableRowsHtml += `
        <tr>
          <td style="border: 1px solid #777; padding: 8px; text-align: center;">${new Date(item.document_date).toLocaleDateString("vi-VN")}</td>
          <td style="border: 1px solid #777; padding: 8px; text-align: center; font-family: monospace;">${item.thu > 0 ? item.document_no : ""}</td>
          <td style="border: 1px solid #777; padding: 8px; text-align: center; font-family: monospace;">${item.chi > 0 ? item.document_no : ""}</td>
          <td style="border: 1px solid #777; padding: 8px;">${item.description}</td>
          <td class="num" style="border: 1px solid #777; padding: 8px;">${item.thu > 0 ? fmt(item.thu) : ""}</td>
          <td class="num" style="border: 1px solid #777; padding: 8px;">${item.chi > 0 ? fmt(item.chi) : ""}</td>
          <td class="num" style="border: 1px solid #777; padding: 8px;">${fmt(item.running_bal)}</td>
          <td style="border: 1px solid #777; padding: 8px;"></td>
        </tr>
      `;
    });

    // 3. Totals row
    tableRowsHtml += `
      <tr class="total-row" style="font-weight: bold; background: #f2f4f7;">
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px; text-transform: uppercase;">Tổng số phát sinh</td>
        <td class="num" style="border: 1px solid #777; padding: 8px;">${total_thu > 0 ? fmt(total_thu) : "-"}</td>
        <td class="num" style="border: 1px solid #777; padding: 8px;">${total_chi > 0 ? fmt(total_chi) : "-"}</td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
      </tr>
    `;

    // 4. Closing balance row
    tableRowsHtml += `
      <tr class="total-row" style="font-weight: bold; background: #f2f4f7;">
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px; text-transform: uppercase;">Số dư cuối kỳ</td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
        <td class="num" style="border: 1px solid #777; padding: 8px; color: #10b981;">${closing_balance !== 0 ? fmt(closing_balance) : "0"}</td>
        <td style="border: 1px solid #777; padding: 8px;"></td>
      </tr>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Segoe UI', 'Inter', sans-serif; padding: 40px; color: #111; background: #fff; line-height: 1.4; }
            .header-container { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .company-info { font-size: 13px; text-transform: uppercase; font-weight: bold; }
            .company-addr { font-size: 11px; font-weight: normal; text-transform: none; color: #555; margin-top: 3px; }
            
            .template-info { text-align: right; font-size: 11.5px; line-height: 1.3; }
            .template-info .bold { font-weight: bold; }
            .template-info .italic { font-style: italic; }
            
            .title-block { text-align: center; margin-bottom: 25px; margin-top: 10px; }
            .title-block h1 { font-size: 24px; font-weight: bold; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.03em; }
            .title-block .date { font-style: italic; font-size: 13.5px; color: #333; margin-bottom: 4px; }
            .title-block .account { font-weight: bold; font-size: 14px; color: #111; }
            
            .print-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            .print-table th, .print-table td { border: 1px solid #777; padding: 8px 6px; text-align: left; }
            .print-table th { background: #f2f4f7; font-weight: bold; text-transform: uppercase; color: #222; text-align: center; font-size: 11px; }
            .print-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
            
            .footer-block { display: flex; justify-content: space-between; margin-top: 50px; font-size: 13px; page-break-inside: avoid; }
            .signature-cell { width: 200px; text-align: center; }
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
            <div class="template-info">
              <div class="bold">Mẫu số: S07-DN</div>
              <div class="italic">(Ban hành theo Thông tư số 200/2014/TT-BTC ngày</div>
              <div class="italic">22/12/2014 của Bộ Tài chính)</div>
            </div>
          </div>

          <div class="title-block">
            <h1>${title}</h1>
            <div class="date">${filterInfo}</div>
            <div class="account">${accountInfo}</div>
          </div>

          <table class="print-table">
            <thead>
              <tr>
                <th rowspan="2" style="width: 100px;">Ngày, tháng<br/>ghi sổ</th>
                <th colspan="2" style="width: 160px; text-align: center;">Số hiệu chứng từ</th>
                <th rowspan="2">Diễn giải</th>
                <th colspan="3" style="width: 360px; text-align: center;">Số tiền</th>
                <th rowspan="2" style="width: 80px;">Ghi chú</th>
              </tr>
              <tr>
                <th style="width: 80px; text-align: center;">Thu</th>
                <th style="width: 80px; text-align: center;">Chi</th>
                <th style="width: 120px; text-align: right;">Thu</th>
                <th style="width: 120px; text-align: right;">Chi</th>
                <th style="width: 120px; text-align: right;">Tồn</th>
              </tr>
              <tr style="background-color: #f2f4f7; font-weight: normal; font-size: 10.5px; text-align: center;">
                <td style="text-align: center; border: 1px solid #777;">A</td>
                <td style="text-align: center; border: 1px solid #777;" colspan="2">B</td>
                <td style="text-align: center; border: 1px solid #777;">E</td>
                <td style="text-align: center; border: 1px solid #777;">1</td>
                <td style="text-align: center; border: 1px solid #777;">2</td>
                <td style="text-align: center; border: 1px solid #777;">3</td>
                <td style="text-align: center; border: 1px solid #777;">G</td>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div style="font-size: 12px; font-style: italic; margin-top: 20px;">
            - Sổ này có {PageCount} trang, đánh số từ trang số 1 đến trang {PageCount}<br/>
            - Ngày mở sổ: ...........................
          </div>

          <div class="footer-block">
            <div class="signature-cell">
              <div class="title">Người ghi sổ</div>
              <div>(Ký, họ tên)</div>
            </div>
            <div class="signature-cell">
              <div class="title">Kế toán trưởng</div>
              <div>(Ký, họ tên)</div>
            </div>
            <div class="signature-cell">
              <div class="title" style="margin-bottom: 10px;">Giám đốc</div>
              <div style="font-size: 11px; font-style: italic; margin-bottom: 50px;">(Ký, họ tên, đóng dấu)</div>
              <div style="font-size: 12.5px; color: #555;">Ngày ..... tháng ...... năm .........</div>
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

        {/* Account Selector Dropdown */}
        <div className="form-group">
          <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>Tài khoản kế toán</label>
          <select 
            className="input-glass" 
            value={selectedAccountCode} 
            onChange={e => setSelectedAccountCode(e.target.value)}
          >
            {accounts.map(acc => (
              <option key={acc.account_code} value={acc.account_code}>
                {acc.account_code} - {acc.account_name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <button 
          className="btn-primary" 
          style={{ height: "42px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "linear-gradient(135deg, var(--primary-color), var(--primary-hover))", border: "none" }}
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
            <h2 style={{ fontSize: "20px", fontWeight: 600 }}>{getReportTitle()}</h2>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
              Tài khoản: <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{activeAccount.account_code} - {activeAccount.account_name}</span> | Khoảng thời gian: <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{new Date(fromDate).toLocaleDateString("vi-VN")}</span> đến <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{new Date(toDate).toLocaleDateString("vi-VN")}</span>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              className="btn-secondary" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "13px", borderColor: "#10b981", color: "#34d399" }}
              onClick={handleExportExcel}
              disabled={rawItems.length === 0}
            >
              📥 Xuất Excel
            </button>
            <button 
              className="btn-secondary" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "13px", borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
              onClick={handlePrintPDF}
            >
              🖨️ In / Xuất PDF
            </button>
          </div>
        </div>

        {/* REPORT TABLE */}
        <div className="table-container">
          <table className="data-table" style={{ width: "100%", minWidth: "1000px" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <th rowSpan={2} style={{ width: "110px", verticalAlign: "middle", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Ngày ghi sổ</th>
                <th colSpan={2} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>Số hiệu chứng từ</th>
                <th rowSpan={2} style={{ verticalAlign: "middle", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Diễn giải</th>
                <th colSpan={3} style={{ textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>Số tiền</th>
                <th rowSpan={2} style={{ width: "100px", verticalAlign: "middle", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Ghi chú</th>
              </tr>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <th style={{ width: "90px", textAlign: "center", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Thu</th>
                <th style={{ width: "90px", textAlign: "center", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Chi</th>
                <th style={{ width: "130px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Thu</th>
                <th style={{ width: "130px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Chi</th>
                <th style={{ width: "140px", textAlign: "right", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Tồn</th>
              </tr>
              <tr style={{ background: "rgba(255,255,255,0.01)", fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
                <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>A</td>
                <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }} colSpan={2}>B</td>
                <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "left" }}>E</td>
                <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>1</td>
                <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>2</td>
                <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>3</td>
                <td style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>G</td>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr style={{ fontWeight: 500 }}>
                <td></td>
                <td colSpan={2}></td>
                <td className="font-medium">Số dư đầu kỳ</td>
                <td></td>
                <td></td>
                <td style={{ textAlign: "right", fontWeight: 600, color: "var(--text-main)" }}>{openingBalance !== 0 ? fmt(openingBalance) : "0"}</td>
                <td></td>
              </tr>

              {/* Transaction items */}
              {items.map((item, idx) => (
                <tr key={`${item.voucher_id}-${idx}`}>
                  <td>{new Date(item.document_date).toLocaleDateString("vi-VN")}</td>
                  <td style={{ fontFamily: "monospace", color: "#f59e0b", textAlign: "center" }}>{item.thu > 0 ? item.document_no : ""}</td>
                  <td style={{ fontFamily: "monospace", color: "#f59e0b", textAlign: "center" }}>{item.chi > 0 ? item.document_no : ""}</td>
                  <td className="font-medium" style={{ color: "var(--text-main)" }}>{item.description}</td>
                  <td style={{ textAlign: "right" }}>{item.thu > 0 ? fmt(item.thu) : ""}</td>
                  <td style={{ textAlign: "right" }}>{item.chi > 0 ? fmt(item.chi) : ""}</td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{fmt(item.running_bal)}</td>
                  <td></td>
                </tr>
              ))}

              {/* Totals row */}
              {rawItems.length > 0 && (
                <tr style={{ background: "rgba(255, 255, 255, 0.03)", fontWeight: "bold" }}>
                  <td></td>
                  <td colSpan={2}></td>
                  <td>TỔNG SỐ PHÁT SINH</td>
                  <td style={{ textAlign: "right" }}>{total_thu > 0 ? fmt(total_thu) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{total_chi > 0 ? fmt(total_chi) : "-"}</td>
                  <td></td>
                  <td></td>
                </tr>
              )}

              {/* Closing balance row */}
              <tr style={{ background: "rgba(16, 185, 129, 0.05)", fontWeight: "bold", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <td></td>
                <td colSpan={2}></td>
                <td style={{ color: "#34d399" }}>SỐ DƯ CUỐI KỲ</td>
                <td></td>
                <td></td>
                <td style={{ textAlign: "right", color: "#10b981", fontSize: "14px" }}>{closing_balance !== 0 ? fmt(closing_balance) : "0"}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
