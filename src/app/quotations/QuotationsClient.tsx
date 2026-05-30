"use client";

import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import "../customers/customers.css";
import "../vouchers/voucher.css";
import { useMenu } from "@/components/MenuProvider";
import { 
  LookupSelect, 
  QuickAddCustomerModal, 
  QuickAddMaterialModal, 
  QuickAddProjectModal,
  DateInput
} from "@/components/LookupSelect";

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
}

interface Material {
  id: number;
  material_code: string | null;
  name: string;
  type: string;
  unit: string;
  unit_price: number;
  length: number | null;
  width: number | null;
  thickness: number | null;
}

interface QuotationItem {
  material_id: string;
  quantity: number;
  length: string;
  width: string;
  height: string;
  category: string;
  tax_percent: string;
  unit_price: string;
  image_path: string;
  project_item_id?: string;
  project_item_name?: string;
  // fields for rendering
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  total_price?: number;
}

interface Quotation {
  id: number;
  document_no: string;
  quotation_date: string;
  customer_id: number;
  customer_name: string;
  project_name: string;
  project_id?: number | null;
  project_item_id?: number | null;
  selected_project_name?: string | null;
  selected_project_item_name?: string | null;
  description: string;
  partner_address: string;
  total_price: number;
  status: string;
  created_at: string;
}

interface Project {
  id: number;
  code: string;
  name: string;
  type: string;
  parent_id: number | null;
  notes: string | null;
}

interface QuotationsClientProps {
  initialData: Quotation[];
  customers: Customer[];
  projects: Project[];
  materials: Material[];
}

export default function QuotationsClient({
  initialData,
  customers,
  projects,
  materials
}: QuotationsClientProps) {
  const [quotations, setQuotations] = useState<Quotation[]>(initialData);

  const { setHeaderActions } = useMenu();
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [localMaterials, setLocalMaterials] = useState<Material[]>(materials);
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Quick Add Modal States
  const [isAddCustOpen, setIsAddCustOpen] = useState(false);
  const [isAddProjOpen, setIsAddProjOpen] = useState(false);
  const [isAddItemCatOpen, setIsAddItemCatOpen] = useState(false);
  const [isAddMatOpen, setIsAddMatOpen] = useState(false);
  const [quickAddMatIndex, setQuickAddMatIndex] = useState<number | null>(null);
  const [quickAddProjItemIndex, setQuickAddProjItemIndex] = useState<number | null>(null);

  const handleAddCustSuccess = (newCust: any) => {
    setLocalCustomers(prev => [...prev, newCust]);
    setFormData(prev => ({
      ...prev,
      customer_id: newCust.id.toString(),
      partner_address: newCust.address || ""
    }));
  };

  const handleAddProjSuccess = (newProj: any) => {
    setLocalProjects(prev => [...prev, newProj]);
    setFormData(prev => ({
      ...prev,
      project_id: newProj.id.toString(),
      project_name: newProj.name
    }));
  };

  const handleAddItemCatSuccess = (newProjItem: any) => {
    setLocalProjects(prev => [...prev, newProjItem]);
    if (quickAddProjItemIndex !== null) {
      updateItem(quickAddProjItemIndex, "project_item_id", newProjItem.id.toString());
      updateItem(quickAddProjItemIndex, "category", newProjItem.name);
      setQuickAddProjItemIndex(null);
    }
  };

  const handleAddMatSuccess = (newMat: any) => {
    setLocalMaterials(prev => [...prev, newMat]);
    if (quickAddMatIndex !== null) {
      updateItem(quickAddMatIndex, "material_id", newMat.id.toString());
      updateItem(quickAddMatIndex, "unit_price", newMat.unit_price.toString());
      updateItem(quickAddMatIndex, "length", newMat.length ? newMat.length.toString() : "");
      updateItem(quickAddMatIndex, "width", newMat.width ? newMat.width.toString() : "");
      updateItem(quickAddMatIndex, "height", newMat.thickness ? newMat.thickness.toString() : "");
      updateItem(quickAddMatIndex, "category", newMat.type || "");
      setQuickAddMatIndex(null);
    }
  };
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [calcActiveTab, setCalcActiveTab] = useState<'summary' | 'breakdown'>('summary');
  const [calcData, setCalcData] = useState<{ summary: any[], breakdown: any[] }>({ summary: [], breakdown: [] });
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [expandedQuotations, setExpandedQuotations] = useState<{ [key: number]: any[] }>({});
  const [loadingQuotationId, setLoadingQuotationId] = useState<number | null>(null);

  const toggleExpand = async (id: number) => {
    if (expandedQuotations[id] !== undefined) {
      const next = { ...expandedQuotations };
      delete next[id];
      setExpandedQuotations(next);
    } else {
      setLoadingQuotationId(id);
      setExpandedQuotations(prev => ({ ...prev, [id]: [] }));
      try {
        const res = await fetch(`/api/quotations/${id}`);
        if (res.ok) {
          const data = await res.json();
          setExpandedQuotations(prev => ({ ...prev, [id]: data.items || [] }));
        } else {
          const next = { ...expandedQuotations };
          delete next[id];
          setExpandedQuotations(next);
          alert("Không thể tải chi tiết báo giá");
        }
      } catch (e) {
        console.error(e);
        const next = { ...expandedQuotations };
        delete next[id];
        setExpandedQuotations(next);
      } finally {
        setLoadingQuotationId(null);
      }
    }
  };

  const [formData, setFormData] = useState({
    customer_id: "",
    quotation_date: new Date().toISOString().split("T")[0],
    document_no: "",
    project_id: "",
    project_item_id: "",
    project_name: "",
    description: "Báo giá sản phẩm",
    partner_address: "",
  });

  const [items, setItems] = useState<QuotationItem[]>([
    { material_id: "", quantity: 1, length: "", width: "", height: "", category: "", tax_percent: "10", unit_price: "0", image_path: "" }
  ]);

  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(price));
  };

  const formatNumber = (num: any) => {
    return new Intl.NumberFormat("vi-VN").format(Number(num));
  };

  const handleProjectChange = (projId: string) => {
    const proj = localProjects.find(p => p.id.toString() === projId);
    setFormData(prev => ({
      ...prev,
      project_id: projId,
      project_name: proj ? proj.name : ""
    }));
    // Reset all items' categories and project item ids as they belong to the old project
    setItems(items.map(item => ({
      ...item,
      project_item_id: "",
      category: ""
    })));
  };

  const openAddModal = async () => {
    setEditingId(null);
    setFormData({
      customer_id: "",
      quotation_date: new Date().toISOString().split("T")[0],
      document_no: "Đang tải...",
      project_id: "",
      project_item_id: "",
      project_name: "",
      description: "Báo giá sản phẩm",
      partner_address: "",
    });
    setItems([
      { material_id: "", quantity: 1, length: "", width: "", height: "", category: "", tax_percent: "10", unit_price: "0", image_path: "" }
    ]);
    setIsModalOpen(true);

    try {
      const res = await fetch("/api/quotations/next-no");
      if (res.ok) {
        const data = await res.json();
        setFormData((prev) => ({ ...prev, document_no: data.document_no }));
      }
    } catch (e) {
      console.error(e);
      setFormData((prev) => ({ ...prev, document_no: "" }));
    }
  };

  useEffect(() => {
    setHeaderActions(
      <button className="btn-primary" style={{ width: "auto" }} onClick={openAddModal}>
        ➕ Thêm mới
      </button>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  const openEditModal = async (q: Quotation) => {
    setEditingId(q.id);
    setFormData({
      customer_id: q.customer_id ? q.customer_id.toString() : "",
      quotation_date: new Date(q.quotation_date || q.created_at).toISOString().split("T")[0],
      document_no: q.document_no || "",
      project_id: q.project_id ? q.project_id.toString() : "",
      project_item_id: q.project_item_id ? q.project_item_id.toString() : "",
      project_name: q.project_name || "",
      description: q.description || "",
      partner_address: q.partner_address || "",
    });

    try {
      const res = await fetch(`/api/quotations/${q.id}`);
      if (res.ok) {
        const data = await res.json();
        const mappedItems = data.items.map((i: any) => ({
          material_id: i.material_id.toString(),
          quantity: i.calculated_quantity,
          length: i.length || "",
          width: i.width || "",
          height: i.height || "",
          category: i.category || "",
          tax_percent: i.tax_percent !== undefined ? i.tax_percent.toString() : "10",
          unit_price: i.unit_price ? i.unit_price.toString() : "0",
          image_path: i.image_path || "",
          project_item_id: i.project_item_id ? i.project_item_id.toString() : "",
        }));
        setItems(mappedItems.length > 0 ? mappedItems : [
          { material_id: "", quantity: 1, length: "", width: "", height: "", category: "", tax_percent: "10", unit_price: "0", image_path: "" }
        ]);
        setIsModalOpen(true);
      } else {
        alert("Không thể tải chi tiết báo giá");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    if (!customerId) {
      setFormData((prev) => ({ ...prev, customer_id: "", partner_address: "" }));
      return;
    }
    const cust = localCustomers.find((c) => c.id.toString() === customerId);
    setFormData((prev) => ({
      ...prev,
      customer_id: customerId,
      partner_address: cust ? cust.address || "" : "",
    }));
  };

  const addItem = () =>
    setItems([
      ...items,
      { material_id: "", quantity: 1, length: "", width: "", height: "", category: "", tax_percent: "10", unit_price: "0", image_path: "" },
    ]);

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;

    if (field === "material_id") {
      const mat = localMaterials.find((m) => m.id.toString() === value);
      if (mat) {
        newItems[index].unit_price = mat.unit_price.toString();
        if (!newItems[index].category) {
          newItems[index].category = mat.type || "";
        }
        newItems[index].length = mat.length ? mat.length.toString() : "";
        newItems[index].width = mat.width ? mat.width.toString() : "";
        newItems[index].height = mat.thickness ? mat.thickness.toString() : "";
      }
    }

    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const triggerUpload = (index: number) => {
    setActiveUploadIndex(index);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeUploadIndex === null) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    // Truyền mã công trình để lưu ảnh vào thư mục bmp/{Mã công trình}
    const selectedProject = localProjects.find(p => p.id.toString() === formData.project_id);
    if (selectedProject && selectedProject.code) {
      uploadFormData.append("project_code", selectedProject.code);
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });
      if (res.ok) {
        const data = await res.json();
        const pathVal = data.absolutePath || data.relativePath;
        updateItem(activeUploadIndex, "image_path", pathVal);
      } else {
        alert("Lỗi khi tải ảnh lên");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối khi tải ảnh lên");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveUploadIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id) return alert("Vui lòng chọn khách hàng");
    const validItems = items.filter((i) => i.material_id && i.quantity > 0);
    if (validItems.length === 0) return alert("Vui lòng nhập ít nhất 1 dòng sản phẩm hợp lệ");

    const payloadItems = validItems.map((i) => ({
      material_id: Number(i.material_id),
      calculated_quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      length: i.length ? Number(i.length) : null,
      width: i.width ? Number(i.width) : null,
      height: i.height ? Number(i.height) : null,
      category: i.category || null,
      tax_percent: Number(i.tax_percent || 0),
      image_path: i.image_path || null,
      project_item_id: i.project_item_id ? Number(i.project_item_id) : null,
    }));

    try {
      const url = editingId ? `/api/quotations/${editingId}` : "/api/quotations";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: Number(formData.customer_id),
          quotation_date: formData.quotation_date,
          document_no: formData.document_no,
          project_id: formData.project_id ? Number(formData.project_id) : null,
          project_item_id: formData.project_item_id ? Number(formData.project_item_id) : null,
          project_name: formData.project_name,
          description: formData.description,
          partner_address: formData.partner_address,
          items: payloadItems,
        }),
      });
      if (res.ok) {
        const updatedQ = await res.json();
        if (editingId) {
          setQuotations(quotations.map((q) => (q.id === editingId ? updatedQ : q)));
        } else {
          setQuotations([updatedQ, ...quotations]);
        }
        setIsModalOpen(false);
        setEditingId(null);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Có lỗi xảy ra");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ");
    }
  };

  const handleCalculate = async (quotation: Quotation) => {
    setActiveQuotation(quotation);
    setCalcActiveTab('summary');
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/calculate`);
      if (res.ok) {
        const data = await res.json();
        setCalcData(data);
        setIsCalcModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatVietnameseDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Ngày ... tháng ... năm 2026";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `Ngày ${day} tháng ${month} năm ${year}`;
  };

  const handlePrint = async (q: Quotation) => {
    try {
      const res = await fetch(`/api/quotations/${q.id}`);
      if (!res.ok) return alert("Không thể tải dữ liệu in báo giá");
      const data = await res.json();

      // Nhóm items theo Hạng mục
      const groups: { [key: string]: any[] } = {};
      data.items.forEach((item: any) => {
        const rawCat = item.project_item_name || item.category || "Khác";
        const cat = typeof rawCat === 'string' ? rawCat.trim() : rawCat;
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      });

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        let tableRowsHtml = "";
        let subtotal = 0;
        let totalTax = 0;
        let grandTotal = 0;

        Object.keys(groups).forEach((catName) => {
          tableRowsHtml += `
            <tr class="category-row">
              <td colspan="11"><strong>${catName}</strong></td>
            </tr>
          `;

          groups[catName].forEach((item: any) => {
            const qty = Number(item.calculated_quantity || 0);
            const price = Number(item.unit_price || 0);
            const lineAmount = qty * price;
            const taxPercent = Number(item.tax_percent || 0);
            const taxAmount = lineAmount * (taxPercent / 100);
            const itemTotal = lineAmount + taxAmount;

            subtotal += lineAmount;
            totalTax += taxAmount;
            grandTotal += itemTotal;

            const imgUrl = item.image_path
              ? `/api/view-image?path=${encodeURIComponent(item.image_path)}`
              : "";
            const imgHtml = imgUrl
              ? `<img src="${imgUrl}" class="print-img" />`
              : "-";

            tableRowsHtml += `
              <tr>
                <td style="font-family: monospace;">${item.material_code || "-"}</td>
                <td>${item.material_name}</td>
                <td class="num">${item.length ? formatNumber(item.length) : "-"}</td>
                <td class="num">${item.width ? formatNumber(item.width) : "-"}</td>
                <td class="num">${item.height ? formatNumber(item.height) : "-"}</td>
                <td class="num">${qty}</td>
                <td class="num">${formatNumber(price)}</td>
                <td class="num">${formatNumber(lineAmount)}</td>
                <td class="num" style="text-align: center;">${taxPercent}%</td>
                <td class="num" style="font-weight: bold;">${formatNumber(itemTotal)}</td>
                <td style="text-align: center; padding: 4px;">${imgHtml}</td>
              </tr>
            `;
          });
        });

        const qDateStr = formatVietnameseDate(data.quotation_date || data.created_at);

        printWindow.document.write(`
          <html>
            <head>
              <title>Báo giá ${data.document_no || ""}</title>
              <style>
                body { font-family: 'Segoe UI', 'Inter', sans-serif; padding: 40px; color: #111; background: #fff; line-height: 1.4; }
                .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 20px; text-align: left; }
                .title-block { text-align: center; margin-bottom: 30px; }
                .title-block h1 { font-size: 26px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.05em; }
                .title-block .date { font-style: italic; font-size: 14px; margin-bottom: 5px; }
                .title-block .doc-no { font-size: 14px; font-weight: 500; }
                
                .info-table { width: 100%; margin-bottom: 25px; border-collapse: collapse; }
                .info-table td { padding: 5px 0; border: none; font-size: 14px; }
                .info-table td.label { width: 110px; font-weight: bold; vertical-align: top; }
                .info-table td.value { border-bottom: 1px dotted #ccc; }

                .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
                .print-table th, .print-table td { border: 1px solid #777; padding: 8px 6px; text-align: left; }
                .print-table th { background: #e9ecf0; font-weight: bold; font-size: 12px; text-transform: uppercase; color: #333; text-align: center; }
                .print-table tr.category-row { background: #f2f4f7; }
                .print-table tr.category-row td { font-weight: bold; font-size: 13px; padding: 8px 10px; color: #111; }
                .print-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
                .print-img { max-height: 60px; max-width: 90px; object-fit: contain; border-radius: 4px; border: 1px solid #ccc; display: block; margin: 0 auto; }
                
                .summary-block { display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px; width: 100%; font-size: 14px; }
                .summary-row { display: flex; justify-content: flex-end; width: 320px; padding: 5px 0; }
                .summary-row span:first-child { flex: 1; text-align: right; padding-right: 15px; font-weight: bold; }
                .summary-row span:last-child { width: 140px; text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; }
                .summary-total { border-top: 2px solid #333; padding-top: 6px; margin-top: 4px; font-size: 16px; }
                
                .footer-block { display: flex; justify-content: flex-end; margin-top: 40px; padding-right: 40px; font-size: 14px; }
                .footer-signer { text-align: center; width: 300px; }
                .footer-signer .date-loc { font-style: italic; margin-bottom: 8px; }
                .footer-signer .title { font-weight: bold; margin-bottom: 70px; }
                .footer-signer .name { font-weight: bold; }
                
                .actions { margin-bottom: 20px; display: flex; gap: 10px; }
                .btn { padding: 8px 16px; border-radius: 4px; cursor: pointer; border: 1px solid #ccc; background: #f9f9f9; font-weight: bold; }
                .btn-primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
                @media print {
                  body { padding: 0; }
                  .no-print { display: none; }
                  @page { size: A4 portrait; margin: 1.5cm; }
                }
              </style>
            </head>
            <body>
              <div class="actions no-print">
                <button class="btn btn-primary" onclick="window.print()">🖨️ In Báo Giá (Xuất PDF)</button>
                <button class="btn" onclick="window.close()">Đóng cửa sổ</button>
              </div>
              <div class="company-name">CÔNG TY THIẾT KẾ NỘI THẤT TOÀN PHÁT</div>
              <div class="title-block">
                <h1>BÁO GIÁ</h1>
                <div class="date">${qDateStr}</div>
                <div class="doc-no">Số báo giá: ${data.document_no || ("PN" + String(data.id).padStart(4, "0"))}</div>
              </div>
              
              <table class="info-table">
                <tr>
                  <td class="label">Khách hàng:</td>
                  <td class="value">${data.customer_name || ""}</td>
                </tr>
                <tr>
                  <td class="label">Địa chỉ:</td>
                  <td class="value">${data.partner_address || ""}</td>
                </tr>
                <tr>
                  <td class="label">Công trình:</td>
                  <td class="value">${data.selected_project_name || data.project_name || ""}</td>
                </tr>
                ${data.selected_project_item_name ? `
                <tr>
                  <td class="label">Hạng mục:</td>
                  <td class="value">${data.selected_project_item_name}</td>
                </tr>
                ` : ''}
                <tr>
                  <td class="label">Diễn giải:</td>
                  <td class="value">${data.description || ""}</td>
                </tr>
              </table>

              <table class="print-table">
                <thead>
                  <tr>
                    <th style="width: 80px;">Mã SP/Vt</th>
                    <th>Tên Sp vật tư</th>
                    <th style="width: 60px;">Dài</th>
                    <th style="width: 60px;">Rộng</th>
                    <th style="width: 60px;">Cao</th>
                    <th style="width: 60px;">Số lượng</th>
                    <th style="width: 100px;">Đơn giá</th>
                    <th style="width: 110px;">Tiền hàng</th>
                    <th style="width: 60px;">% Thuế</th>
                    <th style="width: 120px;">Thành tiền</th>
                    <th style="width: 100px;">Hình Ảnh</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>

              <div class="summary-block">
                <div class="summary-row">
                  <span>Tiền hàng:</span>
                  <span>${formatNumber(subtotal)} đ</span>
                </div>
                <div class="summary-row">
                  <span>Tiền thuế:</span>
                  <span>${formatNumber(totalTax)} đ</span>
                </div>
                <div class="summary-row summary-total">
                  <span>Tổng tiền:</span>
                  <span>${formatNumber(grandTotal)} đ</span>
                </div>
              </div>

              <div class="footer-block">
                <div class="footer-signer">
                  <div class="date-loc">Hà Nội, ${qDateStr}</div>
                  <div class="title">Người lập</div>
                  <div class="name">................................................</div>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi khi tải thông tin in báo giá");
    }
  };

  const handleExportExcel = async (q: Quotation) => {
    try {
      const res = await fetch(`/api/quotations/${q.id}`);
      if (!res.ok) return alert("Không thể tải dữ liệu báo giá");
      const data = await res.json();

      const groups: { [key: string]: any[] } = {};
      data.items.forEach((item: any) => {
        const rawCat = item.project_item_name || item.category || "Khác";
        const cat = typeof rawCat === 'string' ? rawCat.trim() : rawCat;
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      });

      const qDate = new Date(data.quotation_date || data.created_at);
      const day = String(qDate.getDate()).padStart(2, "0");
      const month = String(qDate.getMonth() + 1).padStart(2, "0");
      const year = qDate.getFullYear();

      const rows: any[][] = [
        ["CÔNG TY THIẾT KẾ NỘI THẤT TOÀN PHÁT", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", ""],
        ["BÁO GIÁ", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", `Ngày ${day} tháng ${month} năm ${year}`, "", "", "", "", "", "", ""],
        ["", "", "", `Số báo giá: ${data.document_no || ("PN" + String(data.id).padStart(4, "0"))}`, "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", ""],
        ["Khách hàng:", data.customer_name || "", "", "", "", "", "", "", "", "", ""],
        ["Địa chỉ:", data.partner_address || "", "", "", "", "", "", "", "", "", ""],
        ["Công trình:", data.selected_project_name || data.project_name || "", "", "", "", "", "", "", "", "", ""],
        ["Hạng mục:", data.selected_project_item_name || "", "", "", "", "", "", "", "", "", ""],
        ["Diễn giải:", data.description || "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", ""],
        [
          "Mã SP/Vt",
          "Tên Sp vật tư",
          "Dài",
          "Rộng",
          "Cao",
          "Số lượng",
          "Đơn giá",
          "Tiền hàng",
          "% Thuế",
          "Thành tiền",
          "Hình Ảnh (Đường dẫn)"
        ]
      ];

      let subtotal = 0;
      let totalTax = 0;
      let grandTotal = 0;
      const merges: XLSX.Range[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
        { s: { r: 3, c: 3 }, e: { r: 3, c: 7 } },
        { s: { r: 4, c: 3 }, e: { r: 4, c: 7 } }
      ];

      let currentIdx = 12; 

      Object.keys(groups).forEach((catName) => {
        rows.push(["", catName, "", "", "", "", "", "", "", "", ""]);
        merges.push({ s: { r: currentIdx, c: 1 }, e: { r: currentIdx, c: 10 } });
        currentIdx++;

        groups[catName].forEach((item: any) => {
          const qty = Number(item.calculated_quantity || 0);
          const price = Number(item.unit_price || 0);
          const lineAmount = qty * price;
          const taxPercent = Number(item.tax_percent || 0);
          const taxAmount = lineAmount * (taxPercent / 100);
          const itemTotal = lineAmount + taxAmount;

          subtotal += lineAmount;
          totalTax += taxAmount;
          grandTotal += itemTotal;

          rows.push([
            item.material_code || "",
            item.material_name || "",
            item.length || "",
            item.width || "",
            item.height || "",
            qty,
            price,
            lineAmount,
            taxPercent ? `${taxPercent}%` : "0%",
            itemTotal,
            item.image_path || ""
          ]);
          currentIdx++;
        });
      });

      rows.push(["", "", "", "", "", "", "", "", "", "", ""]);
      currentIdx++;

      rows.push(["", "", "", "", "", "", "", "Tiền hàng:", "", subtotal, ""]);
      rows.push(["", "", "", "", "", "", "", "Tiền thuế:", "", totalTax, ""]);
      rows.push(["", "", "", "", "", "", "", "Tổng tiền:", "", grandTotal, ""]);
      currentIdx += 3;

      rows.push(["", "", "", "", "", "", "", "", "", "", ""]);
      rows.push(["", "", "", "", "", "", "", `Hà Nội, Ngày ${day} tháng ${month} năm ${year}`, "", "", ""]);
      rows.push(["", "", "", "", "", "", "", "Người lập", "", "", ""]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!merges"] = merges;
      ws["!cols"] = [
        { wch: 12 },
        { wch: 30 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 8 },
        { wch: 15 },
        { wch: 40 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bao Gia");

      const docNo = data.document_no || `PN${String(data.id).padStart(4, "0")}`;
      XLSX.writeFile(wb, `Bao_Gia_${docNo}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi kết xuất file Excel");
    }
  };

  const getFormSubtotal = () => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      return sum + qty * price;
    }, 0);
  };

  const getFormTax = () => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      const tax = Number(item.tax_percent || 0);
      return sum + (qty * price * tax) / 100;
    }, 0);
  };

  const getFormTotal = () => {
    return getFormSubtotal() + getFormTax();
  };

  return (
    <div className="customers-container">
      <div className="glass-panel table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}></th>
              <th>Số Báo Giá</th>
              <th>Ngày báo giá</th>
              <th>Khách hàng</th>
              <th>Công trình</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th className="th-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => {
              const isExpanded = expandedQuotations[q.id] !== undefined;
              const itemsList = expandedQuotations[q.id] || [];
              const isLoading = loadingQuotationId === q.id;
              return (
                <React.Fragment key={q.id}>
                  <tr 
                    onClick={() => toggleExpand(q.id)} 
                    style={{ cursor: "pointer", transition: "background 0.2s" }}
                  >
                    <td style={{ textAlign: "center" }}>
                      <span style={{ 
                        display: "inline-block", 
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", 
                        transition: "transform 0.2s",
                        fontSize: "10px",
                        color: "var(--primary-color)"
                      }}>
                        ▶
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: "var(--primary-color)", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                        {q.document_no || `#PN-${q.id.toString().padStart(4, "0")}`}
                      </span>
                    </td>
                    <td>{new Date(q.quotation_date || q.created_at).toLocaleDateString("vi-VN")}</td>
                    <td className="font-medium">{q.customer_name}</td>
                    <td>
                      {q.selected_project_name ? (
                        <div>
                          <span style={{ fontWeight: 500 }}>{q.selected_project_name}</span>
                          {q.selected_project_item_name && (
                            <span style={{ color: "var(--text-muted)", fontSize: "12px", display: "block" }}>
                              ↳ {q.selected_project_item_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        q.project_name || "-"
                      )}
                    </td>
                    <td style={{ color: "#10b981", fontWeight: 600 }}>{formatPrice(q.total_price)}</td>
                    <td>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          background: q.status === "draft" ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                          color: q.status === "draft" ? "#f59e0b" : "#10b981",
                        }}
                      >
                        {q.status === "draft" ? "Bản nháp" : "Đã chốt"}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="action-btn-group">
                        <button
                          className="action-btn-icon action-btn-edit"
                          onClick={(e) => { e.stopPropagation(); openEditModal(q); }}
                          title="Sửa"
                        >
                          ✏️
                        </button>
                        <button
                          className="action-btn-icon action-btn-secondary"
                          onClick={(e) => { e.stopPropagation(); handleCalculate(q); }}
                          title="Vật tư"
                        >
                          📊
                        </button>
                        <button
                          className="action-btn-icon action-btn-secondary"
                          onClick={(e) => { e.stopPropagation(); handlePrint(q); }}
                          title="In / PDF"
                        >
                          🖨️
                        </button>
                        <button
                          className="action-btn-icon action-btn-secondary"
                          onClick={(e) => { e.stopPropagation(); handleExportExcel(q); }}
                          title="Excel"
                        >
                          📥
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr onClick={(e) => e.stopPropagation()}>
                      <td colSpan={8} style={{ padding: "12px 24px", background: "rgba(15, 23, 42, 0.4)" }}>
                        <div className="animate-fade-in" style={{ padding: "8px 0" }}>
                          <h4 style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Chi tiết sản phẩm Báo giá
                          </h4>
                          {isLoading && itemsList.length === 0 ? (
                            <div style={{ padding: "12px", color: "var(--text-muted)", fontSize: "13px" }}>Đang tải chi tiết...</div>
                          ) : itemsList.length === 0 ? (
                            <div style={{ padding: "12px", color: "var(--text-muted)", fontSize: "13px" }}>Không có chi tiết sản phẩm</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                              <thead>
                                <tr style={{ background: "rgba(59, 130, 246, 0.08)" }}>
                                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#60a5fa", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>Mã SP/Vt</th>
                                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>Tên sản phẩm / Vật tư</th>
                                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>Hạng mục</th>
                                  <th style={{ padding: "8px 10px", textAlign: "center", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>Kích thước (D x R x C)</th>
                                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>Số lượng</th>
                                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>Đơn giá</th>
                                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>Tiền hàng</th>
                                  <th style={{ padding: "8px 10px", textAlign: "center", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>% Thuế</th>
                                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>Thành tiền</th>
                                  <th style={{ padding: "8px 10px", textAlign: "center", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 600, width: "80px" }}>Hình ảnh</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemsList.map((item, idx) => {
                                  const itemSubtotal = Number(item.calculated_quantity || 0) * Number(item.unit_price || 0);
                                  const thumbUrl = item.image_path
                                    ? `/api/view-image?path=${encodeURIComponent(item.image_path)}`
                                    : "";
                                  return (
                                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                      <td style={{ padding: "8px 10px", color: "#60a5fa", fontFamily: "monospace", border: "1px solid rgba(255,255,255,0.06)" }}>{item.material_code || "-"}</td>
                                      <td style={{ padding: "8px 10px", color: "#f8fafc", fontWeight: 500, border: "1px solid rgba(255,255,255,0.06)" }}>{item.material_name || item.name}</td>
                                      <td style={{ padding: "8px 10px", color: "#eab308", border: "1px solid rgba(255,255,255,0.06)" }}>{item.project_item_name || item.category || "-"}</td>
                                      <td style={{ padding: "8px 10px", textAlign: "center", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.06)" }}>
                                        {item.length || item.width || item.height
                                          ? `${item.length || 0} x ${item.width || 0} x ${item.height || 0}`
                                          : "-"}
                                      </td>
                                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.06)" }}>{formatNumber(item.calculated_quantity)}</td>
                                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.06)" }}>{formatNumber(item.unit_price)}</td>
                                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.06)" }}>{formatNumber(itemSubtotal)}</td>
                                      <td style={{ padding: "8px 10px", textAlign: "center", color: "#f59e0b", border: "1px solid rgba(255,255,255,0.06)" }}>{item.tax_percent}%</td>
                                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#10b981", border: "1px solid rgba(255,255,255,0.06)" }}>{formatNumber(item.total_price)}</td>
                                      <td style={{ padding: "8px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
                                        {thumbUrl ? (
                                          <img
                                            src={thumbUrl}
                                            alt="thumb"
                                            style={{
                                              width: "28px",
                                              height: "28px",
                                              objectFit: "contain",
                                              borderRadius: "4px",
                                              background: "rgba(0,0,0,0.3)",
                                              cursor: "pointer",
                                              border: "1px solid rgba(255,255,255,0.1)",
                                              display: "block",
                                              margin: "0 auto"
                                            }}
                                            onClick={() => setPreviewImage(item.image_path)}
                                            title="Nhấn để xem ảnh lớn"
                                          />
                                        ) : (
                                          "-"
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {quotations.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted">
                  Chưa có bản báo giá nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: "98vw", width: "98vw", margin: "10px auto" }}>
            <h2>{editingId ? "Sửa Báo giá" : "Tạo Báo giá mới"}</h2>
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="voucher-meta">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Ngày báo giá *
                    </label>
                    <DateInput
                      required
                      value={formData.quotation_date}
                      onChange={(val) => setFormData({ ...formData, quotation_date: val })}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Số báo giá *
                    </label>
                    <input
                      type="text"
                      required
                      className="input-glass"
                      style={{ fontFamily: "monospace", fontWeight: 700, color: "#60a5fa" }}
                      value={formData.document_no}
                      onChange={(e) => setFormData({ ...formData, document_no: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "16px", marginTop: "14px" }}>
                  <div className="form-group">
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Đối tượng (Khách hàng) *
                    </label>
                    <LookupSelect
                      lookupKey="customer"
                      value={formData.customer_id}
                      onChange={(val) => handleCustomerChange(val)}
                      placeholder="-- Chọn khách hàng --"
                      onQuickAdd={() => setIsAddCustOpen(true)}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Địa chỉ
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="Địa chỉ..."
                      value={formData.partner_address}
                      onChange={(e) => setFormData({ ...formData, partner_address: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "16px", marginTop: "14px" }}>
                  <div className="form-group">
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Công trình
                    </label>
                    <LookupSelect
                      lookupKey="project"
                      value={formData.project_id}
                      onChange={(val) => handleProjectChange(val)}
                      placeholder="-- Chọn công trình --"
                      onQuickAdd={() => setIsAddProjOpen(true)}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Diễn giải
                    </label>
                    <input
                      type="text"
                      className="input-glass"
                      placeholder="Nội dung diễn giải..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, color: "#60a5fa" }}>
                  Chi tiết sản phẩm Báo giá
                </label>
                <div style={{ overflowX: "auto", minHeight: "350px" }}>
                  <table className="voucher-detail-table" style={{ minWidth: "1250px" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "30px" }}>#</th>
                        <th style={{ width: "80px" }}>Mã</th>
                        <th style={{ width: "220px" }}>Tên Sản phẩm / Vật tư</th>
                        <th style={{ width: "70px" }}>Dài (L)</th>
                        <th style={{ width: "70px" }}>Rộng (W)</th>
                        <th style={{ width: "70px" }}>Cao (H)</th>
                        <th style={{ width: "110px" }}>Hạng mục</th>
                        <th style={{ width: "70px" }}>SL</th>
                        <th style={{ width: "110px" }}>Đơn giá</th>
                        <th style={{ width: "120px" }}>Tiền hàng</th>
                        <th style={{ width: "70px" }}>% Thuế</th>
                        <th style={{ width: "120px" }}>Thành tiền</th>
                        <th style={{ width: "150px" }}>Hình Ảnh</th>
                        <th style={{ width: "30px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        const mat = materials.find((m) => m.id.toString() === item.material_id);
                        const qty = Number(item.quantity || 0);
                        const price = Number(item.unit_price || 0);
                        const lineAmount = qty * price;
                        const tax = Number(item.tax_percent || 0);
                        const total = lineAmount * (1 + tax / 100);

                        return (
                          <tr key={index} className={item.material_id ? "" : "voucher-empty-row"}>
                            <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{index + 1}</td>
                            <td>
                              <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "12px" }}>
                                {mat?.material_code || "-"}
                              </span>
                            </td>
                            <td>
                              <LookupSelect
                                lookupKey="material"
                                value={item.material_id}
                                onChange={(val) => updateItem(index, "material_id", val)}
                                placeholder="-- Chọn sản phẩm --"
                                onQuickAdd={() => {
                                  setQuickAddMatIndex(index);
                                  setIsAddMatOpen(true);
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="input-glass voucher-input-num"
                                placeholder="L"
                                value={item.length}
                                onChange={(e) => updateItem(index, "length", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="input-glass voucher-input-num"
                                placeholder="W"
                                value={item.width}
                                onChange={(e) => updateItem(index, "width", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="input-glass voucher-input-num"
                                placeholder="H"
                                value={item.height}
                                onChange={(e) => updateItem(index, "height", e.target.value)}
                              />
                            </td>
                            <td>
                              <LookupSelect
                                lookupKey="project_item"
                                value={item.project_item_id || ""}
                                onChange={(val) => {
                                  const selectedItem = localProjects.find(p => p.id.toString() === val);
                                  updateItem(index, "project_item_id", val);
                                  updateItem(index, "category", selectedItem ? selectedItem.name : "");
                                }}
                                parentVal={formData.project_id}
                                placeholder={formData.project_id ? "-- Chọn hạng mục --" : "-- Chọn công trình trước --"}
                                disabled={!formData.project_id}
                                onQuickAdd={() => {
                                  setQuickAddProjItemIndex(index);
                                  setIsAddItemCatOpen(true);
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="0.01"
                                className="input-glass voucher-input-num"
                                placeholder="SL"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                required
                                min="0"
                                className="input-glass voucher-input-num"
                                placeholder="Đơn giá"
                                value={item.unit_price}
                                onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 500 }}>{formatNumber(lineAmount)}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="input-glass voucher-input-num"
                                placeholder="0"
                                value={item.tax_percent}
                                onChange={(e) => updateItem(index, "tax_percent", e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600, color: "#60a5fa" }}>{formatNumber(total)}</td>
                            <td>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                {item.image_path ? (
                                  <img
                                    src={`/api/view-image?path=${encodeURIComponent(item.image_path)}`}
                                    alt="thumb"
                                    style={{
                                      width: "36px",
                                      height: "36px",
                                      objectFit: "contain",
                                      borderRadius: "4px",
                                      background: "rgba(0,0,0,0.3)",
                                      cursor: "pointer",
                                      border: "1px solid rgba(255,255,255,0.1)",
                                    }}
                                    onClick={() => setPreviewImage(item.image_path)}
                                    title="Nhấn để xem ảnh lớn"
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "4px",
                                      background: "rgba(255,255,255,0.05)",
                                      border: "1px dashed rgba(255,255,255,0.2)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "10px",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    Ảnh
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: "4px 8px", minHeight: "unset", width: "auto", fontSize: "11px" }}
                                  onClick={() => triggerUpload(index)}
                                  title="Chọn ảnh từ máy tính"
                                >
                                  📁
                                </button>
                                <input
                                  type="text"
                                  className="input-glass"
                                  style={{ padding: "4px 8px", fontSize: "10px", flex: 1, minWidth: "50px" }}
                                  placeholder="Đường dẫn ảnh..."
                                  value={item.image_path}
                                  onChange={(e) => updateItem(index, "image_path", e.target.value)}
                                  title={item.image_path}
                                />
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#ef4444",
                                  cursor: "pointer",
                                  fontSize: "16px",
                                }}
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
                  style={{ width: "100%", marginTop: "8px", padding: "8px" }}
                  onClick={addItem}
                >
                  + Thêm sản phẩm
                </button>
              </div>

              <div className="voucher-summary">
                <div className="voucher-summary-row">
                  <span>Tiền hàng</span>
                  <span>{formatNumber(getFormSubtotal())} đ</span>
                </div>
                <div className="voucher-summary-row">
                  <span>Tiền thuế</span>
                  <span style={{ color: "#60a5fa" }}>{formatNumber(getFormTax())} đ</span>
                </div>
                <div className="voucher-summary-row voucher-summary-total">
                  <span>Tổng tiền</span>
                  <span style={{ color: "#10b981" }}>{formatNumber(getFormTotal())} đ</span>
                </div>
              </div>

              <div className="modal-actions mt-6">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary" style={{ width: "auto" }}>
                  Lưu báo giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Input file ẩn cho việc upload ảnh */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Lightbox xem ảnh lớn */}
      {previewImage && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewImage(null)}
          style={{ zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            className="glass-panel"
            style={{
              padding: "16px",
              position: "relative",
              maxWidth: "85vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(15, 23, 42, 0.9)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/api/view-image?path=${encodeURIComponent(previewImage)}`}
              alt="Preview"
              style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: "8px" }}
            />
            <div style={{ marginTop: "12px", wordBreak: "break-all", fontSize: "12px", color: "var(--text-muted)" }}>
              {previewImage}
            </div>
            <button
              className="btn-secondary"
              style={{ position: "absolute", top: "10px", right: "10px", width: "auto", padding: "4px 10px" }}
              onClick={() => setPreviewImage(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {isCalcModalOpen && activeQuotation && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: "950px", width: "95%" }}>
            <h2>Bảng Tính Toán Vật Tư Cần Thiết</h2>
            <p className="text-muted" style={{ marginBottom: "16px" }}>
              Dựa trên định mức cấu phần (BOM) của các sản phẩm trong báo giá #BG-{activeQuotation.id.toString().padStart(4, "0")}.
            </p>

            <div className="tabs-container" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className={`tab-button ${calcActiveTab === 'summary' ? 'active' : ''}`}
                onClick={() => setCalcActiveTab('summary')}
              >
                Tổng hợp nhu cầu
              </button>
              <button 
                type="button" 
                className={`tab-button ${calcActiveTab === 'breakdown' ? 'active' : ''}`}
                onClick={() => setCalcActiveTab('breakdown')}
              >
                Chi tiết cấu phần & số lượng tấm
              </button>
            </div>

            {calcActiveTab === 'summary' ? (
              <table className="data-table" style={{ marginTop: "16px" }}>
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Tên Vật tư</th>
                    <th>Số lượng cần mua/sử dụng</th>
                    <th>Tồn kho hiện tại</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {(calcData.summary || []).map((item, idx) => {
                    const isShort = Number(item.stock_quantity) < item.total_required;
                    return (
                      <tr key={idx}>
                        <td>{item.material_type}</td>
                        <td className="font-medium">{item.material_name}</td>
                        <td style={{ fontWeight: "bold", color: "var(--primary-color)" }}>
                          {Number(item.total_required).toFixed(4).replace(/\.?0+$/, "")} {item.material_unit}
                        </td>
                        <td>
                          {Number(item.stock_quantity).toFixed(2).replace(/\.?0+$/, "")} {item.material_unit}
                        </td>
                        <td style={{ color: isShort ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                          {isShort ? "Thiếu hàng" : "Đủ hàng"}
                        </td>
                      </tr>
                    );
                  })}
                  {(!calcData.summary || calcData.summary.length === 0) && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted">
                        Không có dữ liệu vật tư cho báo giá này. (Chưa thiết lập Định mức BOM)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto', marginTop: '16px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm (Báo giá)</th>
                      <th>Thành phần</th>
                      <th>Vật tư/Ván</th>
                      <th style={{ width: '130px' }}>Kích thước</th>
                      <th style={{ width: '80px' }}>SL Cấu phần</th>
                      <th style={{ width: '80px' }}>SL Sản phẩm</th>
                      <th style={{ width: '110px' }}>Tổng quy đổi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(calcData.breakdown || []).map((item, idx) => {
                      const isVán = item.material_type === 'Ván';
                      return (
                        <tr key={idx}>
                          <td className="font-medium" style={{ color: '#60a5fa' }}>
                            {item.product_name} {item.product_code ? `(${item.product_code})` : ''}
                          </td>
                          <td>
                            <strong>{item.component_name}</strong>
                          </td>
                          <td>
                            {item.material_name}
                          </td>
                          <td>
                            {isVán && item.component_length && item.component_width ? (
                              <span>{item.component_length} x {item.component_width} mm</span>
                            ) : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.component_quantity !== null ? item.component_quantity : 1}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                            {item.product_quantity}
                          </td>
                          <td style={{ fontWeight: "bold", color: "#10b981" }}>
                            {Number(item.component_total_required).toFixed(4).replace(/\.?0+$/, "")} {item.material_unit}
                          </td>
                        </tr>
                      );
                    })}
                    {(!calcData.breakdown || calcData.breakdown.length === 0) && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted">
                          Không có chi tiết phân rã cấu phần cho báo giá này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions mt-6">
              <button type="button" className="btn-primary" onClick={() => setIsCalcModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Modals */}
      <QuickAddCustomerModal 
        isOpen={isAddCustOpen} 
        onClose={() => setIsAddCustOpen(false)} 
        onSuccess={handleAddCustSuccess} 
      />
      <QuickAddProjectModal 
        isOpen={isAddProjOpen} 
        onClose={() => setIsAddProjOpen(false)} 
        onSuccess={handleAddProjSuccess} 
        type="Công trình"
      />
      <QuickAddProjectModal 
        isOpen={isAddItemCatOpen} 
        onClose={() => setIsAddItemCatOpen(false)} 
        onSuccess={handleAddItemCatSuccess} 
        type="Hạng mục"
        parentId={formData.project_id}
      />
      <QuickAddMaterialModal 
        isOpen={isAddMatOpen} 
        onClose={() => setIsAddMatOpen(false)} 
        onSuccess={handleAddMatSuccess} 
      />
    </div>
  );
}
