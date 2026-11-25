import React from 'react';
import { CheckSquare, Loader2, Shield, Square, X } from 'lucide-react';
import {
  ADMIN_PERMISSION_MODULES,
  ALL_GRANULAR_PERMISSION_KEYS,
} from '../services/adminPermissionsService';
import { AdminStaffUserRecord } from '../types/matrimony';

interface PermissionMatrixEditorProps {
  selectedKeys: string[];
  onChange: (nextKeys: string[]) => void;
  availablePermissionKeys?: string[];
  disabled?: boolean;
}

export const PermissionMatrixEditor: React.FC<PermissionMatrixEditorProps> = ({
  selectedKeys,
  onChange,
  availablePermissionKeys,
  disabled = false,
}) => {
  const selectedSet = new Set(selectedKeys);
  const hasCatalogSnapshot = Array.isArray(availablePermissionKeys) && availablePermissionKeys.length > 0;
  const availableSet = hasCatalogSnapshot ? new Set(availablePermissionKeys) : null;

  const togglePermissionKey = (key: string) => {
    if (disabled) return;
    if (selectedSet.has(key)) {
      onChange(selectedKeys.filter((k) => k !== key));
    } else {
      onChange([...selectedKeys, key]);
    }
  };

  const toggleModuleAll = (moduleKeys: string[]) => {
    if (disabled) return;
    const allSelected = moduleKeys.every((k) => selectedSet.has(k));
    if (allSelected) {
      const removeSet = new Set(moduleKeys);
      onChange(selectedKeys.filter((k) => !removeSet.has(k)));
    } else {
      const merged = new Set([...selectedKeys, ...moduleKeys]);
      onChange(Array.from(merged));
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChange([...ALL_GRANULAR_PERMISSION_KEYS]);
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline bg-canvas px-4 py-3">
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-brand tabular-nums">{selectedKeys.length}</span> of{' '}
          <span className="font-semibold tabular-nums">
            {ALL_GRANULAR_PERMISSION_KEYS.length}
          </span>{' '}
          granular permissions selected
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={handleSelectAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:border-brand disabled:opacity-50"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Select All</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ADMIN_PERMISSION_MODULES.map((mod) => {
          const moduleKeys = mod.actions.map((a) => a.permissionKey);
          const selectedCount = moduleKeys.filter((k) => selectedSet.has(k)).length;
          const allSelected = selectedCount === moduleKeys.length && moduleKeys.length > 0;

          return (
            <div
              key={mod.moduleKey}
              className="rounded-xl border border-hairline bg-white p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2 border-b border-hairline pb-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand">{mod.moduleLabel}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{mod.description}</p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleModuleAll(moduleKeys)}
                  className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                    allSelected
                      ? 'border-brand bg-brand text-white'
                      : 'border-hairline bg-canvas text-slate-700 hover:border-brand'
                  }`}
                >
                  {allSelected ? 'Uncheck Module' : `All (${selectedCount}/${moduleKeys.length})`}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {mod.actions.map((act) => {
                  const checked = selectedSet.has(act.permissionKey);
                  const missingInDb = availableSet !== null && !availableSet.has(act.permissionKey);
                  return (
                    <label
                      key={act.permissionKey}
                      title={`${act.permissionKey} — ${act.description}`}
                      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'border-brand bg-tint/60 font-semibold text-brand'
                          : 'border-hairline bg-canvas/40 text-slate-700 hover:border-brand/50'
                      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => togglePermissionKey(act.permissionKey)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-field-border text-brand focus:ring-brand"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{act.label}</span>
                        <span className="block truncate font-mono text-[10px] font-normal text-slate-500">
                          {act.permissionKey}
                          {missingInDb ? ' · sync on save' : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface PermissionAssignmentModalProps {
  user: AdminStaffUserRecord | null;
  selectedKeys: string[];
  availablePermissionKeys?: string[];
  saving: boolean;
  error: string | null;
  onChangeKeys: (nextKeys: string[]) => void;
  onSave: () => Promise<void> | void;
  onClose: () => void;
}

export const PermissionAssignmentModal: React.FC<PermissionAssignmentModalProps> = ({
  user,
  selectedKeys,
  availablePermissionKeys,
  saving,
  error,
  onChangeKeys,
  onSave,
  onClose,
}) => {
  if (!user) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="permission-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-footer-bg/65 p-3 sm:p-6 backdrop-blur-xs"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-hairline bg-canvas px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-accent-deep">
              <Shield className="h-3.5 w-3.5" />
              <span>Granular Module Permissions</span>
            </div>
            <h3
              id="permission-modal-title"
              className="mt-1 truncate font-display text-2xl font-semibold text-brand"
            >
              {user.fullName}
            </h3>
            <p className="text-xs text-slate-600">
              {user.email} · Role: <span className="font-mono font-semibold">{user.role}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Close permission assignment dialog"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-ink hover:bg-tint disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {user.role === 'super_admin' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Super Admin accounts inherently retain full system access across all modules, including
              Profile Reports, Profile Analytics, and Admin &amp; Staff Management.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
            >
              {error}
            </div>
          )}

          <PermissionMatrixEditor
            selectedKeys={selectedKeys}
            onChange={onChangeKeys}
            availablePermissionKeys={availablePermissionKeys}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-hairline bg-canvas px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-hairline bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-brand disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Save Permissions</span>
          </button>
        </div>
      </div>
    </div>
  );
};
