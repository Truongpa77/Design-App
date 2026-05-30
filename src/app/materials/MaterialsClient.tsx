"use client";

import { useState, useEffect } from "react";
import "../customers/customers.css"; // Reuse table/modal styles
import { useMenu } from "@/components/MenuProvider";

export default function MaterialsClient({ initialData }: { initialData: any[] }) {
  const [materials, setMaterials] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'product' | 'material' | 'accessory' | 'edgeband'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeProduct, setActiveProduct] = useState<any>(null);
  const [bomItems, setBomItems] = useState<any[]>([{ component_name: '', material_id: '', length: '', width: '', quantity: '1', quantity_required: 1 }]);
  
  const [formData, setFormData] = useState({ 
    name: '', type: 'Ván', length: '', width: '', thickness: '', unit: 'Tấm', unit_price: '', material_code: '' 
  });

  const { setHeaderActions } = useMenu();

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'Ván', length: '', width: '', thickness: '', unit: 'Tấm', unit_price: '', material_code: '' });
    setIsModalOpen(true);
  };

  useEffect(() => {
    setHeaderActions(
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Tìm kiếm..."
            className="input-glass"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ 
              paddingLeft: '32px',
              paddingRight: searchQuery ? '28px' : '10px',
              height: '38px',
              fontSize: '13.5px',
              width: '240px',
              background: 'rgba(15, 23, 42, 0.4)'
            }}
          />
          <span style={{ 
            position: 'absolute', 
            left: '10px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            opacity: 0.5,
            fontSize: '13px',
            pointerEvents: 'none'
          }}>🔍</span>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px'
              }}
            >
              ✕
            </button>
          )}
        </div>
        <button className="btn-primary" style={{ width: 'auto', height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={openAddModal}>
          ➕ Thêm mới
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, searchQuery]);

  const openEditModal = (m: any) => {
    setEditingId(m.id);
    setFormData({ 
      name: m.name, 
      type: m.type, 
      length: m.length || '', 
      width: m.width || '', 
      thickness: m.thickness || '', 
      unit: m.unit || '', 
      unit_price: m.unit_price || '',
      material_code: m.material_code || ''
    });
    setIsModalOpen(true);
  };
  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/materials/${editingId}` : '/api/materials';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          length: formData.length ? Number(formData.length) : null,
          width: formData.width ? Number(formData.width) : null,
          thickness: formData.thickness ? Number(formData.thickness) : null,
          unit_price: Number(formData.unit_price)
        })
      });
      
      if (res.ok) {
        const updatedMat = await res.json();
        if (editingId) {
          setMaterials(materials.map(m => m.id === editingId ? updatedMat : m));
        } else {
          setMaterials([updatedMat, ...materials]);
        }
        setIsModalOpen(false);
        setFormData({ name: '', type: 'Ván', length: '', width: '', thickness: '', unit: 'Tấm', unit_price: '', material_code: '' });
        setEditingId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const calculateQuantityRequired = (materialId: string, lengthVal: string | number, widthVal: string | number, qtyVal: string | number) => {
    const matIdNum = Number(materialId);
    if (!matIdNum) return 0;
    const mat = materials.find(m => m.id === matIdNum);
    if (!mat) return 0;

    const qty = Number(qtyVal) || 0;

    // Nếu vật tư không thuộc loại Ván, hoặc kích thước không được nhập đầy đủ
    if (mat.type !== 'Ván' || !lengthVal || !widthVal) {
      return qty; // Định mức chính là số lượng cái/bộ
    }

    // Nếu là Ván, tính theo tỷ lệ diện tích
    const cLength = Number(lengthVal) || 0;
    const cWidth = Number(widthVal) || 0;
    
    const matLength = Number(mat.length) || 1220; // mặc định ván chuẩn 1220x2440
    const matWidth = Number(mat.width) || 2440;

    const sheetArea = matLength * matWidth;
    if (sheetArea === 0) return 0;

    const compArea = cLength * cWidth * qty;
    return Number((compArea / sheetArea).toFixed(4));
  };

  const openBomModal = async (product: any) => {
    setActiveProduct(product);
    try {
      const res = await fetch(`/api/bom?product_id=${product.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setBomItems(data.map((d: any) => ({
            id: d.id,
            component_name: d.component_name || '',
            material_id: d.material_id.toString(),
            length: d.length || '',
            width: d.width || '',
            quantity: d.quantity || '1',
            quantity_required: Number(d.quantity_required)
          })));
        } else {
          setBomItems([{ component_name: '', material_id: '', length: '', width: '', quantity: '1', quantity_required: 1 }]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsBomModalOpen(true);
  };

  const handleBomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate that all items have a material_id
      const invalid = bomItems.some(i => !i.material_id);
      if (invalid) {
        alert("Vui lòng chọn vật tư cho tất cả thành phần!");
        return;
      }

      const res = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: activeProduct.id,
          items: bomItems.map(i => ({
            material_id: Number(i.material_id),
            component_name: i.component_name || '',
            length: i.length ? Number(i.length) : null,
            width: i.width ? Number(i.width) : null,
            quantity: i.quantity ? Number(i.quantity) : null,
            quantity_required: Number(i.quantity_required)
          }))
        })
      });
      if (res.ok) {
        alert("Đã lưu định mức thành công!");
        setIsBomModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addBomItem = () => setBomItems([...bomItems, { component_name: '', material_id: '', length: '', width: '', quantity: '1', quantity_required: 0 }]);
  const updateBomItem = (index: number, field: string, value: any) => {
    const newItems = [...bomItems];
    newItems[index][field] = value;
    
    // Nếu thay đổi các trường liên quan đến tính toán định mức
    if (field === 'material_id' || field === 'length' || field === 'width' || field === 'quantity') {
      const item = newItems[index];
      item.quantity_required = calculateQuantityRequired(item.material_id, item.length, item.width, item.quantity);
    }
    
    setBomItems(newItems);
  };
  const removeBomItem = (index: number) => {
    setBomItems(bomItems.filter((_, i) => i !== index));
  };

  const rawMaterials = materials.filter(m => m.type !== 'Sản phẩm');

  const countAll = materials.length;
  const countProducts = materials.filter(m => m.type === 'Sản phẩm').length;
  const countMaterials = materials.filter(m => m.type === 'Ván').length;
  const countEdgeBands = materials.filter(m => m.type === 'Nẹp chỉ').length;
  const countAccessories = materials.filter(m => m.type.startsWith('Phụ kiện')).length;

  const filteredMaterials = materials.filter(m => {
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'product' && m.type === 'Sản phẩm') ||
      (activeTab === 'material' && m.type === 'Ván') ||
      (activeTab === 'edgeband' && m.type === 'Nẹp chỉ') ||
      (activeTab === 'accessory' && m.type.startsWith('Phụ kiện'));
    
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.material_code && m.material_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.type.toLowerCase().includes(searchQuery.toLowerCase());
      
    return matchesTab && matchesSearch;
  });

  return (
    <div className="customers-container">
      <div className="actions-bar" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
        <div className="tabs-container">
          <button 
            type="button"
            className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Tất cả <span className="tab-count">{countAll}</span>
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'product' ? 'active' : ''}`}
            onClick={() => setActiveTab('product')}
          >
            Sản phẩm <span className="tab-count">{countProducts}</span>
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'material' ? 'active' : ''}`}
            onClick={() => setActiveTab('material')}
          >
            Ván <span className="tab-count">{countMaterials}</span>
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'edgeband' ? 'active' : ''}`}
            onClick={() => setActiveTab('edgeband')}
          >
            Nẹp chỉ <span className="tab-count">{countEdgeBands}</span>
          </button>
          <button 
            type="button"
            className={`tab-button ${activeTab === 'accessory' ? 'active' : ''}`}
            onClick={() => setActiveTab('accessory')}
          >
            Phụ kiện <span className="tab-count">{countAccessories}</span>
          </button>
        </div>
      </div>

      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Mã</th>
              <th>Tên vật tư / Sản phẩm</th>
              <th>Loại</th>
              <th>Quy cách</th>
              <th>Đơn giá</th>
              <th>Tồn kho</th>
              <th className="th-actions" style={{ width: '120px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.map((m) => (
              <tr key={m.id}>
                <td>{m.id}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#60a5fa' }}>{m.material_code || '-'}</td>
                <td className="font-medium">{m.name}</td>
                <td>{m.type}</td>
                <td>
                  {m.length ? `${m.length}x${m.width}x${m.thickness}` : '-'}
                </td>
                <td style={{ color: '#10b981' }}>{formatPrice(m.unit_price)} / {m.unit}</td>
                <td>{m.stock_quantity} {m.unit}</td>
                <td>
                  <div className="action-btn-group">
                    <button 
                      className="action-btn-icon action-btn-edit" 
                      title="Sửa thông tin" 
                      onClick={() => openEditModal(m)}
                    >
                      ✏️
                    </button>
                    {m.type === 'Sản phẩm' && (
                      <button 
                        className="action-btn-icon action-btn-secondary" 
                        title="Thiết lập Định mức" 
                        onClick={() => openBomModal(m)}
                      >
                        ⚙️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredMaterials.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted">Chưa có dữ liệu</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in">
            <h2>{editingId ? 'Sửa thông tin' : 'Thêm mới'}</h2>
            <form onSubmit={handleSubmit} className="mt-4">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Mã *</label>
                  <input required className="input-glass" placeholder="Ví dụ: VT001" value={formData.material_code} onChange={e => setFormData({...formData, material_code: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Tên *</label>
                  <input required className="input-glass" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <div className="form-group">
                  <label>Phân loại *</label>
                  <select className="input-glass" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="Ván">Ván</option>
                    <option value="Nẹp chỉ">Nẹp chỉ</option>
                    <option value="Phụ kiện">Phụ kiện (Chung)</option>
                    <option value="Phụ kiện tủ">Phụ kiện tủ</option>
                    <option value="Phụ kiện bàn">Phụ kiện bàn</option>
                    <option value="Phụ kiện cửa">Phụ kiện cửa</option>
                    <option value="Phụ kiện giường">Phụ kiện giường</option>
                    <option value="Phụ kiện ghế">Phụ kiện ghế</option>
                    <option value="Phụ kiện khác">Phụ kiện khác</option>
                    <option value="Sản phẩm">Sản phẩm (Tủ, Giường...)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Đơn vị tính</label>
                  <input className="input-glass" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
                </div>
              </div>
              
              {(formData.type === 'Ván' || formData.type === 'Sản phẩm' || formData.type === 'Nẹp chỉ') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  {formData.type !== 'Nẹp chỉ' ? (
                    <div className="form-group">
                      <label>{formData.type === 'Sản phẩm' ? 'Dài tiêu chuẩn (mm)' : 'Dài (mm)'}</label>
                      <input type="number" className="input-glass" value={formData.length} onChange={e => setFormData({...formData, length: e.target.value})} />
                    </div>
                  ) : (
                    <div className="form-group" style={{ visibility: 'hidden' }}>
                      <label>Dài (mm)</label>
                      <input type="number" disabled className="input-glass" value="" />
                    </div>
                  )}
                  <div className="form-group">
                    <label>{formData.type === 'Sản phẩm' ? 'Rộng tiêu chuẩn (mm)' : formData.type === 'Nẹp chỉ' ? 'Độ rộng nẹp (mm)' : 'Rộng (mm)'}</label>
                    <input type="number" className="input-glass" value={formData.width} onChange={e => setFormData({...formData, width: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>{formData.type === 'Sản phẩm' ? 'Cao tiêu chuẩn (mm)' : formData.type === 'Nẹp chỉ' ? 'Độ dày nẹp (mm)' : 'Dày (mm)'}</label>
                    <input type="number" className="input-glass" value={formData.thickness} onChange={e => setFormData({...formData, thickness: e.target.value})} />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Đơn giá (VNĐ) *</label>
                <input type="number" required className="input-glass" value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: e.target.value})} />
              </div>

              <div className="modal-actions mt-6">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBomModalOpen && activeProduct && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '950px', width: '95%' }}>
            <h2>Thiết lập cấu phần & Định mức: {activeProduct.name}</h2>
            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '14px' }}>
              Nhập chi tiết các thành phần cấu tạo (hông, đáy, hậu, cánh...) để tự động quy đổi ra số tấm ván hoặc số lượng phụ kiện cần dùng cho 1 {activeProduct.unit} sản phẩm.
            </p>
            <form onSubmit={handleBomSubmit}>
              <div className="mt-4 table-container" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '800px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '160px' }}>Tên chi tiết/Cấu phần</th>
                      <th>Vật tư/Chủng loại ván</th>
                      <th style={{ width: '100px' }}>Dài (mm)</th>
                      <th style={{ width: '100px' }}>Rộng (mm)</th>
                      <th style={{ width: '90px' }}>Số lượng</th>
                      <th style={{ width: '140px' }}>Quy đổi định mức</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomItems.map((item, index) => {
                      const selectedMat = rawMaterials.find(m => m.id.toString() === item.material_id);
                      const isBoard = selectedMat ? selectedMat.type === 'Ván' : true;
                      
                      return (
                        <tr key={index}>
                          <td style={{ padding: '4px' }}>
                            <input 
                              className="input-glass" 
                              style={{ padding: '6px 8px', fontSize: '13px' }}
                              placeholder="Ví dụ: Hông tủ, Hậu..." 
                              value={item.component_name || ''} 
                              onChange={e => updateBomItem(index, 'component_name', e.target.value)} 
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <select 
                              required 
                              className="input-glass"
                              style={{ padding: '6px 8px', fontSize: '13px' }}
                              value={item.material_id} 
                              onChange={e => {
                                const val = e.target.value;
                                const mat = rawMaterials.find(m => m.id.toString() === val);
                                const newItems = [...bomItems];
                                newItems[index].material_id = val;
                                // Nếu chọn phụ kiện thì ẩn/xóa kích thước
                                if (mat && mat.type !== 'Ván') {
                                  newItems[index].length = '';
                                  newItems[index].width = '';
                                }
                                newItems[index].quantity_required = calculateQuantityRequired(val, newItems[index].length, newItems[index].width, newItems[index].quantity);
                                setBomItems(newItems);
                              }}
                            >
                              <option value="">-- Chọn vật tư --</option>
                              {rawMaterials.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.type}{m.length ? ` ${m.length}x${m.width}` : ''})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input 
                              type="number" 
                              className="input-glass" 
                              style={{ padding: '6px 8px', fontSize: '13px' }}
                              placeholder="mm"
                              disabled={!isBoard}
                              value={item.length} 
                              onChange={e => updateBomItem(index, 'length', e.target.value)} 
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input 
                              type="number" 
                              className="input-glass" 
                              style={{ padding: '6px 8px', fontSize: '13px' }}
                              placeholder="mm"
                              disabled={!isBoard}
                              value={item.width} 
                              onChange={e => updateBomItem(index, 'width', e.target.value)} 
                            />
                          </td>
                          <td style={{ padding: '4px' }}>
                            <input 
                              type="number" 
                              required 
                              min="1" 
                              className="input-glass" 
                              style={{ padding: '6px 8px', fontSize: '13px' }}
                              placeholder="SL"
                              value={item.quantity} 
                              onChange={e => updateBomItem(index, 'quantity', e.target.value)} 
                            />
                          </td>
                          <td style={{ padding: '4px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input 
                                type="number" 
                                required 
                                min="0.0001" 
                                step="0.0001" 
                                className="input-glass" 
                                style={{ padding: '6px 8px', fontSize: '13px', fontWeight: 'bold', color: '#60a5fa' }}
                                placeholder="Quy đổi"
                                value={item.quantity_required} 
                                onChange={e => updateBomItem(index, 'quantity_required', e.target.value)} 
                              />
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {selectedMat ? selectedMat.unit : 'đơn vị'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '4px', textAlign: 'center' }}>
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
                style={{ width: '100%', marginTop: '12px', padding: '8px' }} 
                onClick={addBomItem}
              >
                + Thêm chi tiết/cấu phần mới
              </button>

              <div className="modal-actions mt-6">
                <button type="button" className="btn-secondary" onClick={() => setIsBomModalOpen(false)}>Đóng</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Lưu định mức</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
