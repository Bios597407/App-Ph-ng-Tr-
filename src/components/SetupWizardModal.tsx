import React, { useState } from 'react';
import { HouseProfile, Room } from '../types/index.ts';
import { api } from '../services/api.ts';
import {
  Settings,
  Building,
  CheckCircle2,
  CreditCard,
  Zap,
  X,
  Type,
  Save,
} from 'lucide-react';

interface SetupWizardModalProps {
  currentProfile: HouseProfile;
  rooms: Room[];
  onClose: () => void;
  onSuccess: () => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  currentProfile,
  onClose,
  onSuccess,
}) => {
  // Tabs: 1 = Ngân hàng (VietQR), 2 = Đơn giá Điện Nước, 3 = Thông tin khu trọ & Cỡ chữ
  const [activeTab, setActiveTab] = useState<'bank' | 'rates' | 'info'>('bank');

  const [houseName, setHouseName] = useState(currentProfile.name || 'Nhà Trọ Xanh');
  const [address, setAddress] = useState(currentProfile.address || '');
  const [ownerName, setOwnerName] = useState(currentProfile.ownerName || '');
  const [ownerPhone, setOwnerPhone] = useState(currentProfile.ownerPhone || '');

  const [bankId, setBankId] = useState(currentProfile.bankAccount?.bankId || 'MB');
  const [bankName, setBankName] = useState(currentProfile.bankAccount?.bankName || 'MBBank - Ngân hàng Quân Đội');
  const [accountNumber, setAccountNumber] = useState(currentProfile.bankAccount?.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(currentProfile.bankAccount?.accountHolder || '');

  const [elecRate, setElecRate] = useState(
    (currentProfile.electricityDefaultRate && currentProfile.electricityDefaultRate !== 3500
      ? currentProfile.electricityDefaultRate
      : 5000).toString()
  );
  const [waterRate, setWaterRate] = useState(
    (currentProfile.waterDefaultRate && currentProfile.waterDefaultRate !== 20000
      ? currentProfile.waterDefaultRate
      : 4000).toString()
  );
  const [textScale, setTextScale] = useState<'sm' | 'md' | 'lg'>(() => {
    try {
      const saved = localStorage.getItem('troxanh_text_height');
      if (saved === 'sm' || saved === 'md' || saved === 'lg') return saved;
    } catch {}
    return 'md';
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleTextScaleChange = (scale: 'sm' | 'md' | 'lg') => {
    setTextScale(scale);
    try {
      localStorage.setItem('troxanh_text_height', scale);
    } catch {}
    const root = document.documentElement;
    root.classList.remove('text-scale-sm', 'text-scale-md', 'text-scale-lg');
    root.classList.add(`text-scale-${scale}`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.submitSetupWizard({
        profile: {
          name: houseName.trim(),
          address: address.trim(),
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          electricityDefaultRate: parseInt(elecRate.replace(/\D/g, ''), 10) || 5000,
          waterDefaultRate: parseInt(waterRate.replace(/\D/g, ''), 10) || 4000,
          bankAccount: {
            bankId,
            bankName,
            accountNumber: accountNumber.trim(),
            accountHolder: accountHolder.trim().toUpperCase(),
            qrTemplate: 'compact',
          },
        },
      });
      setSavedSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch {
      // In case of error, still close gracefully after notification
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 px-5 py-4 flex items-center justify-between border-b border-indigo-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight text-white">
                Cài Đặt (Ngân Hàng & Đơn Giá)
              </h2>
              <p className="text-xs text-indigo-200">
                Cập nhật tài khoản nhận tiền VietQR và đơn giá điện nước mặc định
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'bank'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>1. Ngân Hàng VietQR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'rates'
                ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>2. Đơn Giá Điện Nước</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'info'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>3. Khu Trọ & Cỡ Chữ</span>
          </button>
        </div>

        {/* Success Alert Banner */}
        {savedSuccess && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/50 p-3 text-center flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold animate-pulse">
            <CheckCircle2 className="w-4 h-4" />
            <span>Đã lưu cài đặt Ngân hàng & Đơn giá thành công!</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: NGÂN HÀNG VIETQR */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 text-indigo-200">
                Mã VietQR tự động sinh trên hóa đơn và chia sẻ Zalo sẽ sử dụng đúng số tài khoản này để khách quét chuyển tiền trực tiếp.
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Mã ngân hàng (NAPAS):</label>
                    <select
                      value={bankId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBankId(val);
                        if (val === 'MB') setBankName('MBBank - Ngân hàng Quân Đội');
                        if (val === 'VCB') setBankName('Vietcombank - Ngoại Thương');
                        if (val === 'ACB') setBankName('ACB - Á Châu');
                        if (val === 'TCB') setBankName('Techcombank - Kỹ Thương');
                        if (val === 'ICB') setBankName('VietinBank - Công Thương');
                        if (val === 'BIDV') setBankName('BIDV - Đầu Tư Phát Triển');
                        if (val === 'VPB') setBankName('VPBank - Thịnh Vượng');
                        if (val === 'TPB') setBankName('TPBank - Tiên Phong');
                      }}
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    >
                      <option value="MB">MB (MBBank - Ngân hàng Quân Đội)</option>
                      <option value="VCB">VCB (Vietcombank)</option>
                      <option value="ACB">ACB (Á Châu)</option>
                      <option value="TCB">TCB (Techcombank)</option>
                      <option value="ICB">ICB (VietinBank)</option>
                      <option value="BIDV">BIDV</option>
                      <option value="VPB">VPBank</option>
                      <option value="TPB">TPBank</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Số tài khoản nhận tiền:</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="VD: 0987654321"
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold text-sm tracking-wide"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Tên chủ tài khoản (In hoa không dấu):
                  </label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                    placeholder="VD: NGUYEN VAN A"
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-white uppercase font-bold tracking-wider"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ĐƠN GIÁ ĐIỆN NƯỚC */}
          {activeTab === 'rates' && (
            <div className="space-y-4">
              <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 text-amber-200">
                Đơn giá này áp dụng tự động cho các chu kỳ tính tiền phòng. Bạn cũng có thể điều chỉnh riêng từng phòng trong hộp thoại &ldquo;Tổng số tiền kỳ này&rdquo;.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-xl space-y-2">
                  <label className="block text-amber-300 font-bold flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Đơn giá điện mặc định (đ/kWh):</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={elecRate}
                    onChange={(e) => setElecRate(e.target.value)}
                    placeholder="VD: 5000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-black text-sm"
                  />
                  <div className="text-[11px] text-slate-400">
                    Mặc định: 5.000 đ/số
                  </div>
                </div>

                <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-xl space-y-2">
                  <label className="block text-sky-300 font-bold flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-sky-400" />
                    <span>Đơn giá nước mặc định (đ/m³):</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={waterRate}
                    onChange={(e) => setWaterRate(e.target.value)}
                    placeholder="VD: 4000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-black text-sm"
                  />
                  <div className="text-[11px] text-slate-400">
                    Mặc định: 4.000 đ/khối
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium">Hạn thu tiền phòng mặc định:</span>
                <p className="font-bold text-white text-xs">Ngày 10 hằng tháng</p>
                <span className="text-slate-400 text-[11px] block">
                  (Khớp với chu kỳ nhận lương tiêu chuẩn của công nhân, nhân viên tại Việt Nam)
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: THÔNG TIN KHU TRỌ & CỠ CHỮ */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tên khu trọ:</label>
                  <input
                    type="text"
                    value={houseName}
                    onChange={(e) => setHouseName(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Địa chỉ thực tế:</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Người quản lý:</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Số điện thoại liên hệ:</label>
                    <input
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-white font-semibold"
                    />
                  </div>
                </div>

                {/* 3 Lựa chọn Chiều cao & Cỡ chữ */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <label className="block text-slate-300 font-bold flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Chiều cao & kích cỡ chữ hiển thị (Toàn ứng dụng):</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTextScaleChange('sm')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        textScale === 'sm'
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-black ring-1 ring-emerald-500 shadow-sm'
                          : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-black">Nhỏ (14px)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Dòng 1.35 • Gọn</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTextScaleChange('md')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        textScale === 'md'
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-black ring-1 ring-emerald-500 shadow-sm'
                          : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-black">Vừa (16px)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Dòng 1.5 • Chuẩn</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTextScaleChange('lg')}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        textScale === 'lg'
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-black ring-1 ring-emerald-500 shadow-sm'
                          : 'bg-slate-850 border-slate-750 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-black">Lớn (18px)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Dòng 1.65 • Rõ</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs flex items-center gap-2 shadow-lg shadow-indigo-950/50 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu cài đặt...' : 'Lưu Cài Đặt Ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
