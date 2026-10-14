import React, { useState } from 'react';
import { HouseProfile, Room } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatVND } from '../utils/formatters.ts';
import {
  Wand2,
  Building,
  CheckCircle2,
  CreditCard,
  Zap,
  Droplet,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';

interface SetupWizardModalProps {
  currentProfile: HouseProfile;
  rooms: Room[];
  onClose: () => void;
  onSuccess: () => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  currentProfile,
  rooms,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<number>(1);
  const [houseName, setHouseName] = useState(currentProfile.name);
  const [address, setAddress] = useState(currentProfile.address);
  const [ownerName, setOwnerName] = useState(currentProfile.ownerName);
  const [ownerPhone, setOwnerPhone] = useState(currentProfile.ownerPhone);

  const [bankId, setBankId] = useState(currentProfile.bankAccount.bankId);
  const [bankName, setBankName] = useState(currentProfile.bankAccount.bankName);
  const [accountNumber, setAccountNumber] = useState(currentProfile.bankAccount.accountNumber);
  const [accountHolder, setAccountHolder] = useState(currentProfile.bankAccount.accountHolder);

  const [elecRate, setElecRate] = useState(currentProfile.electricityDefaultRate.toString());
  const [waterRate, setWaterRate] = useState(currentProfile.waterDefaultRate.toString());

  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.submitSetupWizard({
        profile: {
          name: houseName.trim(),
          address: address.trim(),
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim(),
          electricityDefaultRate: parseInt(elecRate.replace(/\D/g, ''), 10) || 3500,
          waterDefaultRate: parseInt(waterRate.replace(/\D/g, ''), 10) || 20000,
          bankAccount: {
            bankId,
            bankName,
            accountNumber: accountNumber.trim(),
            accountHolder: accountHolder.trim().toUpperCase(),
            qrTemplate: 'compact',
          },
        },
      });
      alert('Đã cập nhật cấu hình ban đầu khu trọ thành công!');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-850 to-teal-850 px-5 py-4 flex items-center justify-between border-b border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg leading-tight">Thiết Lập Ban Đầu Khu Trọ</h2>
              <p className="text-xs text-emerald-200">Bước {step} / 3: Khai báo thông tin vận hành thực tế</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-400" />
                <span>1. Thông tin khu trọ & Quản lý</span>
              </h3>
              <div>
                <label className="block text-slate-400 mb-1">Tên khu trọ:</label>
                <input
                  type="text"
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Địa chỉ thực tế:</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Đơn vị / Người quản lý:</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Số điện thoại liên hệ:</label>
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>2. Tài khoản ngân hàng nhận tiền (VietQR)</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Mã ngân hàng (NAPAS):</label>
                  <select
                    value={bankId}
                    onChange={(e) => {
                      setBankId(e.target.value);
                      if (e.target.value === 'MB') setBankName('MBBank - Ngân hàng Quân Đội');
                      if (e.target.value === 'VCB') setBankName('Vietcombank');
                      if (e.target.value === 'ACB') setBankName('ACB - Á Châu');
                      if (e.target.value === 'TCB') setBankName('Techcombank');
                    }}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white font-bold"
                  >
                    <option value="MB">MB (MBBank)</option>
                    <option value="VCB">VCB (Vietcombank)</option>
                    <option value="ACB">ACB (Á Châu)</option>
                    <option value="TCB">TCB (Techcombank)</option>
                    <option value="ICB">ICB (VietinBank)</option>
                    <option value="BIDV">BIDV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Số tài khoản:</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Tên chủ tài khoản (in hoa không dấu):</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white uppercase font-bold"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>3. Đơn giá điện nước mặc định</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Đơn giá điện (đ/kWh):</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={elecRate}
                    onChange={(e) => setElecRate(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Đơn giá nước (đ/m3):</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={waterRate}
                    onChange={(e) => setWaterRate(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg p-2 text-white font-bold"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium">Hạn thu tiền phòng mặc định:</span>
                <p className="font-bold text-white">Ngày 10 hằng tháng</p>
                <span className="text-slate-400 text-[11px] block">
                  (Theo quy định chuẩn phù hợp lịch trả lương của công nhân tại Việt Nam)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex justify-between items-center">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="py-2 px-3 rounded-lg bg-slate-800 disabled:opacity-40 text-slate-300 font-semibold text-xs flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs flex items-center gap-1"
            >
              <span>Tiếp tục</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinish}
              className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Hoàn Tất Thiết Lập'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
