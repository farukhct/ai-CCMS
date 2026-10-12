import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDialog: React.FC = () => {
  const { confirmDialog, closeConfirm } = useApp();

  if (!confirmDialog) return null;

  const handleConfirm = () => {
    confirmDialog.onConfirm();
    closeConfirm();
  };

  const handleCancel = () => {
    if (confirmDialog.onCancel) confirmDialog.onCancel();
    closeConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-md w-full p-5 overflow-hidden animate-in zoom-in-95 duration-100">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full shrink-0 ${confirmDialog.isDestructive ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">
              {confirmDialog.title}
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {confirmDialog.message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
          >
            {confirmDialog.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-3 py-1.5 text-xs font-semibold rounded text-white transition-colors ${
              confirmDialog.isDestructive
                ? 'bg-rose-700 hover:bg-rose-800'
                : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {confirmDialog.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
