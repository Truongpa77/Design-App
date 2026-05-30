"use client";

import React, { useState, useEffect } from 'react';
import '../customers/customers.css';

interface Material {
  id: number;
  name: string;
  type: string;
  length: number | null;
  width: number | null;
  thickness: number | null;
  unit: string;
  unit_price: number;
  material_code: string | null;
}

interface BOMItem {
  id?: number;
  component_name: string;
  material_id: string;
  length: string;
  width: string;
  quantity: string;
  quantity_required: number;
  length_map: string;
  width_map: string;
}

export default function BOMClient({ initialMaterials }: { initialMaterials: Material[] }) {
  // Lọc sản phẩm
  const products = initialMaterials.filter(m => m.type === 'Sản phẩm');
  // Lọc vật tư thô (ván + phụ kiện) làm cấu phần
  const rawMaterials = initialMaterials.filter(m => m.type !== 'Sản phẩm');

  const [selectedProduct, setSelectedProduct] = useState<Material | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Kích thước tiêu chuẩn của sản phẩm đang chọn
  const [prodLength, setProdLength] = useState('');
  const [prodWidth, setProdWidth] = useState('');
  const [prodHeight, setProdHeight] = useState('');

  // Tự động tính toán định mức quy đổi ván (nếu là ván)
  const calculateRequiredQty = (matId: string, len: string, wid: string, qty: string) => {
    if (!matId) return 0;
    const mat = rawMaterials.find(m => m.id.toString() === matId);
    if (!mat) return 0;

    const count = Number(qty) || 0;
    if (mat.type !== 'Ván' || !len || !wid) {
      return count;
    }

    const sheetL = Number(mat.length) || 1220;
    const sheetW = Number(mat.width) || 2440;
    const sheetArea = sheetL * sheetW;
    const compArea = Number(len) * Number(wid) * count;
    return sheetArea > 0 ? Number((compArea / sheetArea).toFixed(4)) : 0;
  };

  const handleProductSelect = async (product: Material) => {
    setSelectedProduct(product);
    setProdLength(product.length ? product.length.toString() : '');
    setProdWidth(product.width ? product.width.toString() : '');
    setProdHeight(product.thickness ? product.thickness.toString() : '');
    setBomItems([]);

    try {
      const res = await fetch(`/api/bom?product_id=${product.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setBomItems(data.map((d: any) => ({
            id: d.id,
            component_name: d.component_name || '',
            material_id: d.material_id.toString(),
            length: d.length ? d.length.toString() : '',
            width: d.width ? d.width.toString() : '',
            quantity: d.quantity ? d.quantity.toString() : '1',
            quantity_required: Number(d.quantity_required) || 0,
            length_map: d.length_map || 'Fixed',
            width_map: d.width_map || 'Fixed'
          })));
        } else {
          setBomItems([{ component_name: '', material_id: '', length: '', width: '', quantity: '1', quantity_required: 1, length_map: 'Fixed', width_map: 'Fixed' }]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addBomItem = () => {
    setBomItems([...bomItems, { component_name: '', material_id: '', length: '', width: '', quantity: '1', quantity_required: 1, length_map: 'Fixed', width_map: 'Fixed' }]);
  };

  const updateBomItem = (index: number, field: keyof BOMItem, value: any) => {
    const newItems = [...bomItems];
    (newItems[index] as any)[field] = value;

    if (field === 'material_id') {
      const mat = rawMaterials.find(m => m.id.toString() === value);
      if (mat && mat.type !== 'Ván') {
        newItems[index].length = '';
        newItems[index].width = '';
        newItems[index].length_map = 'Fixed';
        newItems[index].width_map = 'Fixed';
      }
    }

    // Tự động tính toán lại định mức quy đổi khi thay đổi số lượng, kích thước
    if (field === 'material_id' || field === 'length' || field === 'width' || field === 'quantity') {
      const item = newItems[index];
      item.quantity_required = calculateRequiredQty(item.material_id, item.length, item.width, item.quantity);
    }

    setBomItems(newItems);
  };

  const removeBomItem = (index: number) => {
    setBomItems(bomItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    // Validate
    const invalid = bomItems.some(i => !i.material_id);
    if (invalid) {
      alert("Vui lòng chọn vật tư cho tất cả cấu phần!");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          product_length: prodLength ? Number(prodLength) : null,
          product_width: prodWidth ? Number(prodWidth) : null,
          product_height: prodHeight ? Number(prodHeight) : null,
          items: bomItems.map(i => ({
            material_id: Number(i.material_id),
            component_name: i.component_name || '',
            length: i.length ? Number(i.length) : null,
            width: i.width ? Number(i.width) : null,
            quantity: i.quantity ? Number(i.quantity) : null,
            quantity_required: Number(i.quantity_required),
            length_map: i.length_map,
            width_map: i.width_map
          }))
        })
      });

      if (res.ok) {
        alert("Lưu định mức thành công!");
        // Cập nhật lại kích thước của selectedProduct trong danh sách client
        selectedProduct.length = prodLength ? Number(prodLength) : null;
        selectedProduct.width = prodWidth ? Number(prodWidth) : null;
        selectedProduct.thickness = prodHeight ? Number(prodHeight) : null;
      } else {
        alert("Có lỗi xảy ra khi lưu định mức");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.material_code && p.material_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', minHeight: 'calc(100vh - 180px)' }}>
      {/* Sidebar chọn sản phẩm */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#60a5fa', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sản phẩm
        </h3>
        <input 
          type="text" 
          className="input-glass" 
          placeholder="Tìm sản phẩm nhanh..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ marginBottom: '12px', padding: '8px 12px', fontSize: '13px' }}
        />
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '600px' }}>
          {filteredProducts.map(p => {
            const isSelected = selectedProduct?.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleProductSelect(p)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: isSelected ? 'var(--primary-color)' : '#f8fafc' }}>
                  {p.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                  <span>{p.material_code || '-'}</span>
                  <span>{p.length ? `${p.length}x${p.width}x${p.thickness}` : 'Chưa nhập KT'}</span>
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              Không tìm thấy sản phẩm
            </div>
          )}
        </div>
      </div>

      {/* Workspace thiết lập định mức */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        {selectedProduct ? (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Định mức sản phẩm: {selectedProduct.name}</h2>
                <p className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
                  Mã sản phẩm: <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{selectedProduct.material_code || '-'}</span> | Đơn vị: {selectedProduct.unit}
                </p>
              </div>
              <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', padding: '10px 24px' }}>
                {saving ? '⏳ Đang lưu...' : '💾 Lưu định mức'}
              </button>
            </div>

            {/* Khối kích thước tiêu chuẩn */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                Kích thước tham chiếu tiêu chuẩn (Std Size)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dài tiêu chuẩn (L_std - mm) *</label>
                  <input 
                    type="number" 
                    required 
                    className="input-glass" 
                    placeholder="Ví dụ: 2500" 
                    value={prodLength} 
                    onChange={e => setProdLength(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rộng tiêu chuẩn (W_std - mm) *</label>
                  <input 
                    type="number" 
                    required 
                    className="input-glass" 
                    placeholder="Ví dụ: 600" 
                    value={prodWidth} 
                    onChange={e => setProdWidth(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cao tiêu chuẩn (H_std - mm) *</label>
                  <input 
                    type="number" 
                    required 
                    className="input-glass" 
                    placeholder="Ví dụ: 700" 
                    value={prodHeight} 
                    onChange={e => setProdHeight(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Danh sách cấu phần BOM */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#60a5fa', marginBottom: '12px' }}>
                Chi tiết cấu phần & Liên kết kích thước
              </h3>
              <div className="table-container" style={{ overflowX: 'auto', minHeight: '280px' }}>
                <table className="data-table" style={{ minWidth: '1000px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Tên cấu phần / Chi tiết</th>
                      <th>Vật tư sử dụng</th>
                      <th style={{ width: '90px' }}>Dài (mm)</th>
                      <th style={{ width: '90px' }}>Rộng (mm)</th>
                      <th style={{ width: '70px' }}>SL</th>
                      <th style={{ width: '130px' }}>Liên kết Dài</th>
                      <th style={{ width: '130px' }}>Liên kết Rộng</th>
                      <th style={{ width: '140px' }}>Định mức quy đổi</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomItems.map((item, index) => {
                      const selectedMat = rawMaterials.find(m => m.id.toString() === item.material_id);
                      const isBoard = selectedMat ? selectedMat.type === 'Ván' : true;

                      return (
                        <tr key={index}>
                          <td style={{ padding: '6px' }}>
                            <input
                              className="input-glass"
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                              placeholder="Ví dụ: Hông, Cánh..."
                              value={item.component_name}
                              onChange={e => updateBomItem(index, 'component_name', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '6px' }}>
                            <select
                              required
                              className="input-glass"
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                              value={item.material_id}
                              onChange={e => updateBomItem(index, 'material_id', e.target.value)}
                            >
                              <option value="">-- Chọn vật tư --</option>
                              {rawMaterials.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.type}{m.length ? ` ${m.length}x${m.width}` : ''})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '6px' }}>
                            <input
                              type="number"
                              className="input-glass"
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                              placeholder="mm"
                              disabled={!isBoard}
                              value={item.length}
                              onChange={e => updateBomItem(index, 'length', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '6px' }}>
                            <input
                              type="number"
                              className="input-glass"
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                              placeholder="mm"
                              disabled={!isBoard}
                              value={item.width}
                              onChange={e => updateBomItem(index, 'width', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '6px' }}>
                            <input
                              type="number"
                              required
                              min="1"
                              className="input-glass"
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                              placeholder="1"
                              value={item.quantity}
                              onChange={e => updateBomItem(index, 'quantity', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '6px' }}>
                            <select
                              className="input-glass"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              disabled={!isBoard}
                              value={item.length_map}
                              onChange={e => updateBomItem(index, 'length_map', e.target.value)}
                            >
                              <option value="Fixed">Cố định (Fixed)</option>
                              <option value="L">Tỷ lệ theo Dài (L)</option>
                              <option value="W">Tỷ lệ theo Rộng (W)</option>
                              <option value="H">Tỷ lệ theo Cao (H)</option>
                            </select>
                          </td>
                          <td style={{ padding: '6px' }}>
                            <select
                              className="input-glass"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                              disabled={!isBoard}
                              value={item.width_map}
                              onChange={e => updateBomItem(index, 'width_map', e.target.value)}
                            >
                              <option value="Fixed">Cố định (Fixed)</option>
                              <option value="L">Tỷ lệ theo Dài (L)</option>
                              <option value="W">Tỷ lệ theo Rộng (W)</option>
                              <option value="H">Tỷ lệ theo Cao (H)</option>
                            </select>
                          </td>
                          <td style={{ padding: '6px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                required
                                min="0.0001"
                                step="0.0001"
                                className="input-glass"
                                style={{ padding: '6px 10px', fontSize: '13px', fontWeight: 'bold', color: '#60a5fa' }}
                                value={item.quantity_required}
                                onChange={e => updateBomItem(index, 'quantity_required', Number(e.target.value))}
                              />
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {selectedMat ? selectedMat.unit : ''}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeBomItem(index)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
                            >
                              ❌
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: '100%', marginTop: '12px', padding: '10px' }}
                onClick={addBomItem}
              >
                ➕ Thêm chi tiết cấu phần
              </button>
            </div>
          </form>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', minHeight: '350px' }}>
            <span style={{ fontSize: '64px', marginBottom: '16px' }}>⚙️</span>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>Vui lòng chọn sản phẩm ở danh sách bên trái để thiết lập Định mức BOM tiêu chuẩn.</p>
          </div>
        )}
      </div>
    </div>
  );
}
