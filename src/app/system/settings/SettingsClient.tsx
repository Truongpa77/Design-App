"use client";

import React, { useState, useEffect } from "react";
import "../../customers/customers.css"; // Reuse card, layout and button styles

interface ThemePreset {
  name: string;
  primary: string;
  hover: string;
  bgColor: string;
  cardBg: string;
  cardBorder: string;
}

interface BgPreset {
  name: string;
  bgColor: string;
  cardBg: string;
  cardBorder: string;
}

const colorPresets: ThemePreset[] = [
  {
    name: "Sắc xanh đại dương (Mặc định)",
    primary: "#3b82f6",
    hover: "#2563eb",
    bgColor: "#0f172a",
    cardBg: "rgba(30, 41, 59, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Xanh lá bảo lục (Emerald)",
    primary: "#10b981",
    hover: "#059669",
    bgColor: "#022c22",
    cardBg: "rgba(6, 78, 59, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Hồng Ruby quý phái (Rose)",
    primary: "#f43f5e",
    hover: "#e11d48",
    bgColor: "#1c0d12",
    cardBg: "rgba(45, 20, 28, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Tím hoàng gia (Purple)",
    primary: "#8b5cf6",
    hover: "#7c3aed",
    bgColor: "#120924",
    cardBg: "rgba(30, 15, 50, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Vàng hổ phách (Amber)",
    primary: "#f59e0b",
    hover: "#d97706",
    bgColor: "#1c1202",
    cardBg: "rgba(45, 30, 10, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Bóng đêm tối thượng (Obsidian)",
    primary: "#ffffff",
    hover: "#e4e4e7",
    bgColor: "#09090b",
    cardBg: "rgba(24, 24, 27, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.15)"
  },
  {
    name: "Xanh mòng két (Teal)",
    primary: "#0d9488",
    hover: "#0f766e",
    bgColor: "#042f2e",
    cardBg: "rgba(13, 148, 136, 0.15)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Xanh xám hiện đại (Steel Slate)",
    primary: "#38bdf8",
    hover: "#0ea5e9",
    bgColor: "#18181b",
    cardBg: "rgba(39, 39, 42, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  }
];

const bgPresets: BgPreset[] = [
  {
    name: "Đại dương sâu thẳm (Deep Slate)",
    bgColor: "#0f172a",
    cardBg: "rgba(30, 41, 59, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Obsidian huyền bí (Obsidian Black)",
    bgColor: "#09090b",
    cardBg: "rgba(24, 24, 27, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.15)"
  },
  {
    name: "Xám Carbon hiện đại (Steel Carbon)",
    bgColor: "#18181b",
    cardBg: "rgba(39, 39, 42, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Rừng già sâu thẳm (Deep Emerald)",
    bgColor: "#022c22",
    cardBg: "rgba(6, 78, 59, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Tím tinh vân (Nebula Purple)",
    bgColor: "#120924",
    cardBg: "rgba(30, 15, 50, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  },
  {
    name: "Đỏ rượu vang (Deep Burgundy)",
    bgColor: "#1c0d12",
    cardBg: "rgba(45, 20, 28, 0.7)",
    cardBorder: "rgba(255, 255, 255, 0.1)"
  }
];

const hexToRgb = (hex: string): string => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "59, 130, 246";
};

const getCardBgAndBorder = (bgHex: string) => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = bgHex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  if (!result) {
    return {
      cardBg: "rgba(30, 41, 59, 0.7)",
      cardBorder: "rgba(255, 255, 255, 0.1)"
    };
  }
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  // We want card to be slightly lighter than the background for glassmorphism look
  const cardR = Math.min(255, r + 12);
  const cardG = Math.min(255, g + 16);
  const cardB = Math.min(255, b + 24);

  return {
    cardBg: `rgba(${cardR}, ${cardG}, ${cardB}, 0.7)`,
    cardBorder: `rgba(255, 255, 255, 0.08)`
  };
};

export default function SettingsClient() {
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [hoverColor, setHoverColor] = useState("#2563eb");
  const [bgColor, setBgColor] = useState("#0f172a");
  const [cardBg, setCardBg] = useState("rgba(30, 41, 59, 0.7)");
  const [cardBorder, setCardBorder] = useState("rgba(255, 255, 255, 0.1)");
  const [successMsg, setSuccessMsg] = useState("");

  // Load current theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedColor = localStorage.getItem("theme-primary-color");
      const savedHover = localStorage.getItem("theme-primary-hover");
      const savedBgColor = localStorage.getItem("theme-bg-color");
      const savedCardBg = localStorage.getItem("theme-card-bg");
      const savedCardBorder = localStorage.getItem("theme-card-border");

      if (savedColor) {
        setPrimaryColor(savedColor);
        document.documentElement.style.setProperty("--primary-color", savedColor);
        document.documentElement.style.setProperty("--primary-color-rgb", hexToRgb(savedColor));
      }
      if (savedHover) {
        setHoverColor(savedHover);
        document.documentElement.style.setProperty("--primary-hover", savedHover);
      }
      if (savedBgColor) {
        setBgColor(savedBgColor);
        document.documentElement.style.setProperty("--bg-color", savedBgColor);
      }
      if (savedCardBg) {
        setCardBg(savedCardBg);
        document.documentElement.style.setProperty("--card-bg", savedCardBg);
      }
      if (savedCardBorder) {
        setCardBorder(savedCardBorder);
        document.documentElement.style.setProperty("--card-border", savedCardBorder);
      }
    }
  }, []);

  // Update theme temporarily for live preview (entire theme)
  const handlePreviewTheme = (preset: ThemePreset) => {
    setPrimaryColor(preset.primary);
    setHoverColor(preset.hover);
    setBgColor(preset.bgColor);
    setCardBg(preset.cardBg);
    setCardBorder(preset.cardBorder);

    document.documentElement.style.setProperty("--primary-color", preset.primary);
    document.documentElement.style.setProperty("--primary-hover", preset.hover);
    document.documentElement.style.setProperty("--primary-color-rgb", hexToRgb(preset.primary));
    document.documentElement.style.setProperty("--bg-color", preset.bgColor);
    document.documentElement.style.setProperty("--card-bg", preset.cardBg);
    document.documentElement.style.setProperty("--card-border", preset.cardBorder);
  };

  // Update background temporarily for live preview
  const handlePreviewBgColor = (bg: string) => {
    setBgColor(bg);
    const { cardBg: cBg, cardBorder: cBorder } = getCardBgAndBorder(bg);
    setCardBg(cBg);
    setCardBorder(cBorder);

    document.documentElement.style.setProperty("--bg-color", bg);
    document.documentElement.style.setProperty("--card-bg", cBg);
    document.documentElement.style.setProperty("--card-border", cBorder);
  };

  // Update primary color temporarily for live preview
  const handlePreviewColor = (primary: string, hover: string) => {
    setPrimaryColor(primary);
    setHoverColor(hover);
    document.documentElement.style.setProperty("--primary-color", primary);
    document.documentElement.style.setProperty("--primary-hover", hover);
    document.documentElement.style.setProperty("--primary-color-rgb", hexToRgb(primary));
  };

  // Save customized theme colors
  const handleSaveTheme = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme-primary-color", primaryColor);
      localStorage.setItem("theme-primary-hover", hoverColor);
      localStorage.setItem("theme-bg-color", bgColor);
      localStorage.setItem("theme-card-bg", cardBg);
      localStorage.setItem("theme-card-border", cardBorder);

      document.documentElement.style.setProperty("--primary-color", primaryColor);
      document.documentElement.style.setProperty("--primary-hover", hoverColor);
      document.documentElement.style.setProperty("--primary-color-rgb", hexToRgb(primaryColor));
      document.documentElement.style.setProperty("--bg-color", bgColor);
      document.documentElement.style.setProperty("--card-bg", cardBg);
      document.documentElement.style.setProperty("--card-border", cardBorder);

      setSuccessMsg("Đã lưu và áp dụng cấu hình giao diện thành công! 🎉");
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  // Reset theme to original settings
  const handleResetTheme = () => {
    const defaultPrimary = "#3b82f6";
    const defaultHover = "#2563eb";
    const defaultBg = "#0f172a";
    const defaultCardBg = "rgba(30, 41, 59, 0.7)";
    const defaultCardBorder = "rgba(255, 255, 255, 0.1)";

    setPrimaryColor(defaultPrimary);
    setHoverColor(defaultHover);
    setBgColor(defaultBg);
    setCardBg(defaultCardBg);
    setCardBorder(defaultCardBorder);

    if (typeof window !== "undefined") {
      localStorage.removeItem("theme-primary-color");
      localStorage.removeItem("theme-primary-hover");
      localStorage.removeItem("theme-bg-color");
      localStorage.removeItem("theme-card-bg");
      localStorage.removeItem("theme-card-border");
    }

    document.documentElement.style.setProperty("--primary-color", defaultPrimary);
    document.documentElement.style.setProperty("--primary-hover", defaultHover);
    document.documentElement.style.setProperty("--primary-color-rgb", hexToRgb(defaultPrimary));
    document.documentElement.style.setProperty("--bg-color", defaultBg);
    document.documentElement.style.setProperty("--card-bg", defaultCardBg);
    document.documentElement.style.setProperty("--card-border", defaultCardBorder);

    setSuccessMsg("Đã khôi phục giao diện về mặc định. 🔄");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
      {/* Toast Alert */}
      {successMsg && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 10000,
          background: "rgba(16, 185, 129, 0.95)", color: "#fff",
          padding: "12px 24px", borderRadius: "8px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
          borderLeft: "4px solid #059669", fontWeight: 500
        }}>
          {successMsg}
        </div>
      )}

      <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
        🎨 Tùy chỉnh màu sắc & Giao diện
      </h2>

      <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px", lineHeight: "1.6" }}>
        Tùy biến diện mạo cho ứng dụng bằng cách chọn từ các chủ đề thiết lập sẵn đồng bộ, hoặc tự điều chỉnh màu nhấn và màu nền riêng biệt ở bảng tùy chọn bên dưới.
      </p>

      {/* COMPACT SYNCHRONIZED PRESETS GRID */}
      <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px" }}>1. Chọn chủ đề đồng bộ (Accent & Nền)</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {colorPresets.map(preset => {
          const isSelected = 
            primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
            bgColor.toLowerCase() === preset.bgColor.toLowerCase();
          return (
            <div 
              key={preset.name}
              onClick={() => handlePreviewTheme(preset)}
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: isSelected ? `2px solid ${preset.primary}` : "1px solid rgba(255,255,255,0.08)",
                background: preset.bgColor,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                transition: "all 0.2s ease",
                transform: isSelected ? "scale(1.02)" : "scale(1)",
                boxShadow: isSelected ? `0 8px 24px rgba(0,0,0,0.4)` : "none"
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span 
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: preset.primary,
                    boxShadow: `0 4px 10px ${preset.primary}40`,
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "inline-block"
                  }}
                />
                <span style={{ fontSize: "13.5px", fontWeight: 500, color: "#ffffff" }}>
                  {preset.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* QUICK BACKGROUND PRESETS GRID */}
      <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px" }}>2. Chỉ thay đổi màu nền nhanh</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {bgPresets.map(preset => {
          const isSelected = bgColor.toLowerCase() === preset.bgColor.toLowerCase();
          return (
            <div 
              key={preset.name}
              onClick={() => handlePreviewBgColor(preset.bgColor)}
              style={{
                padding: "14px 16px",
                borderRadius: "12px",
                border: isSelected ? `2px solid var(--primary-color)` : "1px solid rgba(255,255,255,0.08)",
                background: preset.bgColor,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                transition: "all 0.2s ease",
                transform: isSelected ? "scale(1.02)" : "scale(1)",
                boxShadow: isSelected ? `0 8px 24px rgba(0,0,0,0.4)` : "none"
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span 
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "4px",
                    background: preset.cardBg,
                    border: `1px solid ${preset.cardBorder}`,
                    display: "inline-block"
                  }}
                />
                <span style={{ fontSize: "13.5px", fontWeight: 500, color: "#ffffff" }}>
                  {preset.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CUSTOM COLOR PICKERS */}
      <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px" }}>3. Tùy chọn màu sắc nâng cao</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", padding: "20px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px", color: "var(--text-muted)" }}>Màu chủ đạo (Primary):</label>
          <input 
            type="color" 
            value={primaryColor} 
            onChange={e => handlePreviewColor(e.target.value, hoverColor)}
            style={{ width: "40px", height: "30px", border: "none", borderRadius: "4px", cursor: "pointer", background: "none" }}
          />
          <span style={{ fontFamily: "monospace", fontSize: "12.5px" }}>{primaryColor.toUpperCase()}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px", color: "var(--text-muted)" }}>Màu di chuột (Hover):</label>
          <input 
            type="color" 
            value={hoverColor} 
            onChange={e => handlePreviewColor(primaryColor, e.target.value)}
            style={{ width: "40px", height: "30px", border: "none", borderRadius: "4px", cursor: "pointer", background: "none" }}
          />
          <span style={{ fontFamily: "monospace", fontSize: "12.5px" }}>{hoverColor.toUpperCase()}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px", color: "var(--text-muted)" }}>Màu nền tự chọn (Background):</label>
          <input 
            type="color" 
            value={bgColor} 
            onChange={e => handlePreviewBgColor(e.target.value)}
            style={{ width: "40px", height: "30px", border: "none", borderRadius: "4px", cursor: "pointer", background: "none" }}
          />
          <span style={{ fontFamily: "monospace", fontSize: "12.5px" }}>{bgColor.toUpperCase()}</span>
        </div>
      </div>

      {/* LIVE PREVIEW AREA */}
      <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px" }}>Xem trước giao diện (Live Mockup)</h3>
      <div style={{ padding: "24px", borderRadius: "12px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: "bold" }}>Thành phần xem trước</span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>*Áp dụng trực tiếp tại đây</span>
        </div>
        
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <button className="btn-primary" style={{ width: "auto", padding: "8px 16px", fontSize: "12.5px" }}>
            Nút chính (Button)
          </button>
          
          <button className="btn-secondary" style={{ width: "auto", padding: "8px 16px", fontSize: "12.5px", cursor: "pointer" }}>
            Nút phụ (Secondary)
          </button>

          <span 
            style={{ fontSize: "13px", cursor: "pointer", textDecoration: "underline", color: primaryColor, transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = hoverColor}
            onMouseLeave={e => e.currentTarget.style.color = primaryColor}
          >
            Đường dẫn liên kết (Link)
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "300px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Hộp nhập liệu khi focus:</span>
          <input 
            type="text" 
            className="input-glass" 
            placeholder="Focus vào đây để xem viền..." 
            style={{ padding: "8px 12px", fontSize: "13px" }}
            onFocus={e => e.currentTarget.style.borderColor = primaryColor}
            onBlur={e => e.currentTarget.style.borderColor = "var(--card-border)"}
          />
        </div>
      </div>

      {/* SAVE / RESET ACTIONS */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px" }}>
        <button 
          className="btn-secondary" 
          style={{ width: "auto", padding: "10px 20px" }}
          onClick={handleResetTheme}
        >
          Khôi phục mặc định
        </button>
        <button 
          className="btn-primary" 
          style={{ width: "auto", padding: "10px 24px", display: "flex", alignItems: "center", gap: "8px" }}
          onClick={handleSaveTheme}
        >
          💾 Lưu thiết lập
        </button>
      </div>
    </div>
  );
}
