"use client";

import { useEffect, useState } from "react";

export default function DashboardClient() {
  const [stats, setStats] = useState({
    customers: 0,
    materials: 0,
    quotations: 0,
    warehouse: 0
  });

  useEffect(() => {
    // Giả lập fetch data tổng quan từ API
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Lỗi lấy dữ liệu:", err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="dashboard-grid animate-fade-in">
      <div className="stat-card glass-panel">
        <div className="stat-icon bg-blue">👥</div>
        <div className="stat-info">
          <h3>Khách hàng</h3>
          <p className="stat-value">{stats.customers}</p>
        </div>
      </div>

      <div className="stat-card glass-panel">
        <div className="stat-icon bg-green">🧱</div>
        <div className="stat-info">
          <h3>Sản phẩm & Vật tư</h3>
          <p className="stat-value">{stats.materials}</p>
        </div>
      </div>

      <div className="stat-card glass-panel">
        <div className="stat-icon bg-yellow">📦</div>
        <div className="stat-info">
          <h3>Số phiếu Nhập/Xuất</h3>
          <p className="stat-value">{stats.warehouse}</p>
        </div>
      </div>

      <div className="stat-card glass-panel">
        <div className="stat-icon bg-purple">📝</div>
        <div className="stat-info">
          <h3>Báo giá</h3>
          <p className="stat-value">{stats.quotations}</p>
        </div>
      </div>

      {/* Placeholder for charts or recent activity */}
      <div className="dashboard-widgets glass-panel" style={{ gridColumn: '1 / -1', minHeight: '300px', marginTop: '20px', padding: '20px' }}>
        <h2>Hoạt động gần đây</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Tính năng đang được phát triển...</p>
      </div>
    </div>
  );
}
