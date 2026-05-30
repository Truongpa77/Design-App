"use client";

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import '../../customers/customers.css';

interface Quotation {
  id: number;
  document_no: string;
  quotation_date: string;
  total_price: number;
  status: string;
  customer_name: string;
  project_name: string;
}

interface SummaryItem {
  material_id: number;
  material_name: string;
  material_type: string;
  material_unit: string;
  stock_quantity: number;
  total_required: number;
  custom_quantity: number | null;
}

interface BreakdownItem {
  quotation_item_id: number;
  product_name: string;
  product_code: string;
  product_quantity: number;
  component_name: string;
  component_length: number | null;
  component_width: number | null;
  component_quantity: number | null;
  component_unit_required: number;
  component_total_required: number;
  material_id: number;
  material_name: string;
  material_type: string;
  material_unit: string;
}

export default function BomCalcClient({ initialQuotations }: { initialQuotations: Quotation[] }) {
  const [quotations] = useState<Quotation[]>(initialQuotations);
  const [selectedQId, setSelectedQId] = useState('');
  const [qInfo, setQInfo] = useState<Quotation | null>(null);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  
  const [editedQuantities, setEditedQuantities] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'breakdown'>('summary');

  const fetchQuotationDemands = async (qId: string) => {
    if (!qId) {
      setQInfo(null);
      setSummary([]);
      setBreakdown([]);
      setEditedQuantities({});
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/synthesis/bom-calc?quotation_id=${qId}`);
      if (res.ok) {
        const data = await res.json();
        setQInfo(data.quotation);
        setSummary(data.summary);
        setBreakdown(data.breakdown);

        // Khởi tạo các giá trị input chỉnh sửa
        const initialEdited: { [key: number]: string } = {};
        data.summary.forEach((item: SummaryItem) => {
          initialEdited[item.material_id] = item.custom_quantity !== null 
            ? item.custom_quantity.toString() 
            : item.total_required.toFixed(4).replace(/\.?0+$/, "");
        });
        setEditedQuantities(initialEdited);
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleQChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedQId(val);
    fetchQuotationDemands(val);
  };

  const handleQtyChange = (materialId: number, val: string) => {
    setEditedQuantities(prev => ({
      ...prev,
      [materialId]: val
    }));
  };

  const handleSave = async () => {
    if (!selectedQId) return;

    setSaving(true);
    try {
      const itemsToSave = summary.map(item => {
        const customValStr = editedQuantities[item.material_id];
        const customVal = customValStr === '' ? null : Number(customValStr);
        return {
          material_id: item.material_id,
          calculated_quantity: item.total_required,
          custom_quantity: customVal
        };
      });

      const res = await fetch('/api/synthesis/bom-calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotation_id: Number(selectedQId),
          items: itemsToSave
        })
      });

      if (res.ok) {
        alert('Lưu nhu cầu vật tư điều chỉnh thành công!');
        // Refresh lại dữ liệu để lấy đồng bộ
        fetchQuotationDemands(selectedQId);
      } else {
        alert('Có lỗi xảy ra khi lưu nhu cầu vật tư');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (!qInfo) return;

    const exportRows = summary.map((item, index) => {
      const customValStr = editedQuantities[item.material_id];
      const customVal = customValStr !== undefined && customValStr !== '' ? Number(customValStr) : item.total_required;
      const stock = Number(item.stock_quantity) || 0;
      const diff = customVal - stock;
      const status = diff > 0 ? `Thiếu ${diff.toFixed(2)}` : 'Đủ hàng';

      return {
        'STT': index + 1,
        'Mã Vật Tư': initialMaterialsMap.get(item.material_id) || '',
        'Tên Vật Tư': item.material_name,
        'Loại': item.material_type,
        'Đơn Vị': item.material_unit,
        'Tồn Kho Hiện Tại': stock,
        'Số Lượng Tự Động Tính (BOM)': item.total_required,
        'Số Lượng Đặt Mua/Yêu Cầu (Điều Chỉnh)': customVal,
        'Trạng Thái Nhu Cầu': status
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nhu Cau Vat Tu');

    // Căn chỉnh độ rộng các cột tự động
    ws['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 30 },
      { wch: 12 },
      { wch: 10 },
      { wch: 18 },
      { wch: 25 },
      { wch: 35 },
      { wch: 20 }
    ];

    XLSX.writeFile(wb, `Nhu_Cau_Vat_Tu_BG_${qInfo.document_no || qInfo.id}.xlsx`);
  };

  // Tra cứu mã vật tư từ phía client nhanh
  const [initialMaterialsMap, setInitialMaterialsMap] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    const fetchMaterialsForCode = async () => {
      try {
        const res = await fetch('/api/materials');
        if (res.ok) {
          const data = await res.json();
          const map = new Map<number, string>();
          data.forEach((m: any) => map.set(m.id, m.material_code || ''));
          setInitialMaterialsMap(map);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMaterialsForCode();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Khối bộ lọc chọn Báo giá */}
      <div className="glass-panel animate-fade-in" style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'end' }}>
          <div className="form-group">
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
              Chọn báo giá sản phẩm *
            </label>
            <select 
              className="input-glass" 
              value={selectedQId} 
              onChange={handleQChange}
              style={{ fontSize: '14px', padding: '10px' }}
            >
              <option value="">-- Chọn Báo giá --</option>
              {quotations.map(q => (
                <option key={q.id} value={q.id}>
                  {q.document_no || `#BG-${q.id}`} - {q.customer_name} ({q.project_name || 'Không có dự án'})
                </option>
              ))}
            </select>
          </div>
          {qInfo && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleSave} 
                disabled={saving || loading}
                style={{ width: 'auto', padding: '10px 24px', background: 'var(--success)' }}
              >
                {saving ? '⏳ Đang lưu...' : '💾 Lưu nhu cầu điều chỉnh'}
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleExportExcel} 
                disabled={loading}
                style={{ width: 'auto', padding: '10px 24px' }}
              >
                📥 Xuất File Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {qInfo ? (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
          {/* Thông tin Báo giá chọn */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Chi tiết nhu cầu của báo giá: {qInfo.document_no || `#BG-${qInfo.id}`}</h3>
            <p className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
              Khách hàng: <strong style={{ color: '#f8fafc' }}>{qInfo.customer_name}</strong> | Dự án: <strong style={{ color: '#f8fafc' }}>{qInfo.project_name || '-'}</strong> | Ngày: {new Date(qInfo.quotation_date).toLocaleDateString('vi-VN')}
            </p>
          </div>

          {/* Tabs */}
          <div className="tabs-container" style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              📊 Bảng tổng hợp nhu cầu đặt mua / điều chỉnh
            </button>
            <button 
              type="button" 
              className={`tab-button ${activeTab === 'breakdown' ? 'active' : ''}`}
              onClick={() => setActiveTab('breakdown')}
            >
              ⚙️ Chi tiết cấu phần phân rã (BOM Breakdown)
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlignment: 'center', color: 'var(--text-muted)' }}>
              ⏳ Đang tính toán dữ liệu định mức vật tư...
            </div>
          ) : activeTab === 'summary' ? (
            /* Tab Tổng hợp nhu cầu */
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Mã Vật Tư</th>
                    <th>Tên Vật Tư / Ván</th>
                    <th style={{ width: '100px' }}>Phân loại</th>
                    <th style={{ width: '90px' }}>Đơn vị</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>Tính toán từ BOM (Std)</th>
                    <th style={{ width: '180px' }}>SL đặt mua / yêu cầu *</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Tồn kho hiện tại</th>
                    <th style={{ width: '140px' }}>Trạng thái kho</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((item) => {
                    const customValStr = editedQuantities[item.material_id];
                    const customVal = customValStr !== undefined && customValStr !== '' ? Number(customValStr) : item.total_required;
                    const stock = Number(item.stock_quantity) || 0;
                    const shortage = customVal - stock;
                    const isShort = shortage > 0;
                    const matCode = initialMaterialsMap.get(item.material_id) || '-';

                    return (
                      <tr key={item.material_id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#60a5fa' }}>{matCode}</td>
                        <td className="font-medium">{item.material_name}</td>
                        <td>{item.material_type}</td>
                        <td>{item.material_unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: '#94a3b8' }}>
                          {item.total_required.toFixed(4).replace(/\.?0+$/, "")}
                        </td>
                        <td style={{ padding: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              className="input-glass"
                              style={{ 
                                padding: '6px 10px', 
                                fontSize: '13px', 
                                fontWeight: 'bold', 
                                color: 'var(--primary-color)',
                                border: '1px solid rgba(59, 130, 246, 0.4)'
                              }}
                              value={customValStr || ''}
                              onChange={e => handleQtyChange(item.material_id, e.target.value)}
                              step="0.0001"
                              min="0"
                            />
                            {item.custom_quantity !== null && (
                              <span style={{ fontSize: '11px', color: '#eab308', background: 'rgba(234, 179, 8, 0.1)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                Đã sửa
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {stock.toFixed(2).replace(/\.?0+$/, "")}
                        </td>
                        <td style={{ fontWeight: 600, color: isShort ? '#ef4444' : '#10b981' }}>
                          {isShort ? `⚠️ Thiếu ${shortage.toFixed(2).replace(/\.?0+$/, "")}` : '✅ Đủ hàng'}
                        </td>
                      </tr>
                    );
                  })}
                  {summary.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted">
                        Báo giá này không chứa sản phẩm nào được thiết lập định mức BOM.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Tab Chi tiết phân rã */
            <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sản phẩm trong báo giá</th>
                    <th>Cấu phần chi tiết</th>
                    <th>Vật tư/Ván</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Kích thước thực tế</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>SL cấu phần</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>SL sản phẩm</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Tổng quy đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((item, idx) => {
                    const isBoard = item.material_type === 'Ván';
                    return (
                      <tr key={idx}>
                        <td className="font-medium" style={{ color: '#60a5fa' }}>
                          {item.product_name} {item.product_code ? `(${item.product_code})` : ''}
                        </td>
                        <td>
                          <strong>{item.component_name}</strong>
                        </td>
                        <td>{item.material_name}</td>
                        <td style={{ textAlign: 'center' }}>
                          {isBoard && item.component_length && item.component_width ? (
                            <span>{item.component_length} x {item.component_width} mm</span>
                          ) : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {item.component_quantity !== null ? item.component_quantity : 1}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {item.product_quantity}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                          {item.component_total_required.toFixed(4).replace(/\.?0+$/, "")} {item.material_unit}
                        </td>
                      </tr>
                    );
                  })}
                  {breakdown.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted">
                        Không có chi tiết cấu phần nào được thiết lập.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Trạng thái chưa chọn Báo giá */
        <div className="glass-panel animate-fade-in" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', minHeight: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '64px', marginBottom: '16px' }}>🧮</span>
          <h3>Vui lòng chọn báo giá ở thanh điều kiện bên trên để tính toán và điều chỉnh nhu cầu vật tư.</h3>
          <p style={{ marginTop: '8px', fontSize: '14px' }}>Hệ thống sẽ tự động phân rã định mức cấu phần theo kích thước thực tế của báo giá.</p>
        </div>
      )}
    </div>
  );
}
