"use client";

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { DateInput } from '@/components/LookupSelect';
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

interface ReportRow {
  quotation_id: number;
  project_id: number | null;
  project_name: string;
  project_item_id: number | null;
  project_item_name: string;
  product_id: number | null;
  product_name: string;
  product_code: string;
  product_quantity: number;
  material_id: number;
  material_name: string;
  material_code: string;
  material_unit: string;
  material_type: string;
  component_name: string;
  component_length: number | null;
  component_width: number | null;
  component_quantity: number | null;
  calculated_quantity: number;
  custom_quantity: number;
  stock_quantity: number;
}

export default function MaterialReqClient({ initialQuotations }: { initialQuotations: Quotation[] }) {
  const [quotations] = useState<Quotation[]>(initialQuotations);
  
  // Mặc định từ ngày 30 ngày trước đến ngày hôm nay
  const getDefaultFromDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  };
  const getDefaultToDate = () => new Date().toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(getDefaultFromDate());
  const [toDate, setToDate] = useState(getDefaultToDate());
  const [selectedQId, setSelectedQId] = useState('');
  
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<{ [key: string]: boolean }>({});

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/api/reports/material-requirements?from_date=${fromDate}&to_date=${toDate}`;
      if (selectedQId) {
        url += `&quotation_id=${selectedQId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const rows = await res.json();
        setData(rows);
        setCollapsedNodes({}); // Reset collapse/expand
      } else {
        alert('Lỗi khi tải dữ liệu báo cáo');
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const toggleNode = (nodeKey: string) => {
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  // Group data to hierarchical structure
  const buildTree = (rows: ReportRow[]) => {
    const projectsMap = new Map<string, any>();

    rows.forEach(row => {
      const projName = row.project_name || 'Không có công trình';
      if (!projectsMap.has(projName)) {
        projectsMap.set(projName, {
          name: projName,
          categories: new Map<string, any>()
        });
      }
      const project = projectsMap.get(projName);

      const catName = row.project_item_name || 'Không có hạng mục';
      if (!project.categories.has(catName)) {
        project.categories.set(catName, {
          name: catName,
          products: new Map<string, any>()
        });
      }
      const category = project.categories.get(catName);

      const prodName = row.product_name || 'Vật tư trực tiếp';
      const prodKey = `${row.product_id || 0}_${prodName}`;
      if (!category.products.has(prodKey)) {
        category.products.set(prodKey, {
          id: row.product_id,
          name: prodName,
          code: row.product_code,
          quantity: Number(row.product_quantity) || 1,
          materials: []
        });
      }
      const product = category.products.get(prodKey);

      product.materials.push({
        material_id: row.material_id,
        material_name: row.material_name,
        material_code: row.material_code,
        material_unit: row.material_unit,
        material_type: row.material_type,
        component_name: row.component_name,
        component_length: row.component_length ? Number(row.component_length) : null,
        component_width: row.component_width ? Number(row.component_width) : null,
        component_quantity: row.component_quantity ? Number(row.component_quantity) : null,
        calculated_quantity: Number(row.calculated_quantity),
        custom_quantity: Number(row.custom_quantity),
        stock_quantity: Number(row.stock_quantity)
      });
    });

    return Array.from(projectsMap.values()).map(proj => ({
      ...proj,
      categories: Array.from(proj.categories.values()).map((cat: any) => ({
        ...cat,
        products: Array.from(cat.products.values()).map((prod: any) => ({
          ...prod
        }))
      }))
    }));
  };

  const handleExportExcel = () => {
    if (data.length === 0) return alert('Không có dữ liệu để xuất Excel');

    const tree = buildTree(data);
    const exportRows: any[] = [];

    tree.forEach(proj => {
      exportRows.push({
        'Phân cấp công trình / Cấu phần': `🏢 Công trình: ${proj.name}`,
        'Mã Vật tư': '',
        'Tên Vật tư': '',
        'Kích thước': '',
        'SL cấu phần': '',
        'Đơn vị': '',
        'Nhu cầu tính toán (BOM)': '',
        'Nhu cầu yêu cầu (Đã sửa)': '',
        'Tồn kho': ''
      });

      proj.categories.forEach((cat: any) => {
        exportRows.push({
          'Phân cấp công trình / Cấu phần': `  ↳ Hạng mục: ${cat.name}`,
          'Mã Vật tư': '',
          'Tên Vật tư': '',
          'Kích thước': '',
          'SL cấu phần': '',
          'Đơn vị': '',
          'Nhu cầu tính toán (BOM)': '',
          'Nhu cầu yêu cầu (Đã sửa)': '',
          'Tồn kho': ''
        });

        cat.products.forEach((prod: any) => {
          exportRows.push({
            'Phân cấp công trình / Cấu phần': `    ↳ Sản phẩm: ${prod.name} ${prod.code ? `(${prod.code})` : ''} [SL: ${prod.quantity}]`,
            'Mã Vật tư': '',
            'Tên Vật tư': '',
            'Kích thước': '',
            'SL cấu phần': '',
            'Đơn vị': '',
            'Nhu cầu tính toán (BOM)': '',
            'Nhu cầu yêu cầu (Đã sửa)': '',
            'Tồn kho': ''
          });

          prod.materials.forEach((mat: any) => {
            exportRows.push({
              'Phân cấp công trình / Cấu phần': `      ▪ Cấu phần: ${mat.component_name}`,
              'Mã Vật tư': mat.material_code || '',
              'Tên Vật tư': mat.material_name,
              'Kích thước': mat.component_length ? `${mat.component_length}x${mat.component_width} mm` : '',
              'SL cấu phần': mat.component_quantity || '',
              'Đơn vị': mat.material_unit,
              'Nhu cầu tính toán (BOM)': mat.calculated_quantity,
              'Nhu cầu yêu cầu (Đã sửa)': mat.custom_quantity,
              'Tồn kho': mat.stock_quantity
            });
          });
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nhu cau Vat tu');

    ws['!cols'] = [
      { wch: 55 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 22 },
      { wch: 22 },
      { wch: 12 }
    ];

    XLSX.writeFile(wb, `Bao_Cao_Nhu_Cau_Vat_Tu_${fromDate}_to_${toDate}.xlsx`);
  };

  const treeData = buildTree(data);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filters */}
      <div className="glass-panel animate-fade-in" style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 1fr', gap: '16px', alignItems: 'end' }}>
          <div className="form-group">
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              Từ ngày
            </label>
            <DateInput value={fromDate} onChange={setFromDate} />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              Đến ngày
            </label>
            <DateInput value={toDate} onChange={setToDate} />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              Lọc theo Báo giá
            </label>
            <select
              className="input-glass"
              value={selectedQId}
              onChange={e => setSelectedQId(e.target.value)}
              style={{ fontSize: '13.5px', padding: '9px 12px' }}
            >
              <option value="">-- Tất cả báo giá --</option>
              {quotations.map(q => (
                <option key={q.id} value={q.id}>
                  {q.document_no || `#BG-${q.id}`} - {q.customer_name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={fetchReport}
              disabled={loading}
              style={{ width: 'auto', flex: 1, padding: '10px 16px' }}
            >
              {loading ? '⏳' : '🔍 Xem'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportExcel}
              disabled={loading || data.length === 0}
              style={{ width: 'auto', flex: 1, padding: '10px 16px' }}
            >
              📥 Excel
            </button>
          </div>
        </div>
      </div>

      {/* Grid Treeview */}
      <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px' }}>
          Danh sách nhu cầu mua vật tư công trình
        </h3>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            ⏳ Đang truy vấn báo cáo nhu cầu vật tư...
          </div>
        ) : data.length > 0 ? (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '1000px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ textAlign: 'left', padding: '10px' }}>Phân cấp công trình / Cấu phần</th>
                  <th style={{ width: '130px', textAlign: 'left' }}>Mã Vật tư</th>
                  <th style={{ width: '220px', textAlign: 'left' }}>Tên Vật tư</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Kích thước</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>SL phụ</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Nhu cầu chuẩn (BOM)</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Yêu cầu (Đã sửa)</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Tồn kho</th>
                </tr>
              </thead>
              <tbody>
                {treeData.map((proj, pIdx) => {
                  const projKey = `proj_${proj.name}`;
                  const isProjCollapsed = collapsedNodes[projKey];

                  return (
                    <React.Fragment key={pIdx}>
                      {/* Project Header Row */}
                      <tr 
                        onClick={() => toggleNode(projKey)}
                        style={{ 
                          background: 'rgba(59, 130, 246, 0.12)', 
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255,255,255,0.04)' 
                        }}
                      >
                        <td colSpan={8} style={{ padding: '10px 12px', fontWeight: 'bold', color: '#60a5fa', userSelect: 'none' }}>
                          <span style={{ marginRight: '8px', fontSize: '10px' }}>{isProjCollapsed ? '▶' : '▼'}</span>
                          🏢 Công trình: {proj.name}
                        </td>
                      </tr>

                      {!isProjCollapsed && proj.categories.map((cat: any, cIdx: number) => {
                        const catKey = `cat_${proj.name}_${cat.name}`;
                        const isCatCollapsed = collapsedNodes[catKey];

                        return (
                          <React.Fragment key={cIdx}>
                            {/* Category Header Row */}
                            <tr
                              onClick={() => toggleNode(catKey)}
                              style={{ 
                                background: 'rgba(234, 179, 8, 0.06)', 
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.04)'
                              }}
                            >
                              <td colSpan={8} style={{ padding: '9px 12px 9px 30px', fontWeight: 600, color: '#eab308', userSelect: 'none' }}>
                                <span style={{ marginRight: '8px', fontSize: '10px' }}>{isCatCollapsed ? '▶' : '▼'}</span>
                                ↳ Hạng mục: {cat.name}
                              </td>
                            </tr>

                            {!isCatCollapsed && cat.products.map((prod: any, prIdx: number) => {
                              const prodKey = `prod_${proj.name}_${cat.name}_${prod.name}_${prod.id}`;
                              const isProdCollapsed = collapsedNodes[prodKey];

                              return (
                                <React.Fragment key={prIdx}>
                                  {/* Product Header Row */}
                                  <tr
                                    onClick={() => toggleNode(prodKey)}
                                    style={{
                                      background: 'rgba(168, 85, 247, 0.04)',
                                      cursor: 'pointer',
                                      borderBottom: '1px solid rgba(255,255,255,0.04)'
                                    }}
                                  >
                                    <td colSpan={8} style={{ padding: '8px 12px 8px 48px', fontWeight: 600, color: '#c084fc', userSelect: 'none' }}>
                                      <span style={{ marginRight: '8px', fontSize: '10px' }}>{isProdCollapsed ? '▶' : '▼'}</span>
                                      ↳ Sản phẩm: {prod.name} {prod.code ? `(${prod.code})` : ''} [SL: {prod.quantity}]
                                    </td>
                                  </tr>

                                  {!isProdCollapsed && prod.materials.map((mat: any, mIdx: number) => {
                                    const shortage = mat.custom_quantity - mat.stock_quantity;
                                    const isShort = shortage > 0;
                                    
                                    return (
                                      <tr 
                                        key={mIdx}
                                        style={{ 
                                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                                          background: 'rgba(255,255,255,0.01)'
                                        }}
                                      >
                                        <td style={{ padding: '8px 12px 8px 70px', color: '#e2e8f0' }}>
                                          ▪ {mat.component_name}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>
                                          {mat.material_code || '-'}
                                        </td>
                                        <td style={{ color: '#cbd5e1' }}>
                                          {mat.material_name}
                                        </td>
                                        <td style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                                          {mat.component_length && mat.component_width ? (
                                            <span>{mat.component_length}x{mat.component_width} mm</span>
                                          ) : '-'}
                                        </td>
                                        <td style={{ textAlign: 'center', color: '#cbd5e1' }}>
                                          {mat.component_quantity || '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 500, color: '#94a3b8' }}>
                                          {mat.calculated_quantity.toFixed(4).replace(/\.?0+$/, "")} {mat.material_unit}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#60a5fa' }}>
                                          {mat.custom_quantity.toFixed(4).replace(/\.?0+$/, "")} {mat.material_unit}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: isShort ? '#ef4444' : '#10b981' }}>
                                          {mat.stock_quantity.toFixed(2).replace(/\.?0+$/, "")} {mat.material_unit}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            ⚠️ Không tìm thấy dữ liệu nhu cầu vật tư trong thời gian lọc.
          </div>
        )}
      </div>
    </div>
  );
}
