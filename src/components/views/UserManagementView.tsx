import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { userRepo } from '../../database/repositories/userRepo';
import { auditRepo } from '../../database/repositories/auditRepo';
import { User, RoleName } from '../../types';
import { formatTimestampDisplay } from '../../services/dateUtils';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Key,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Lock
} from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const { currentUser, addToast, showConfirm } = useApp();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<RoleName>('Data Entry Operator');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const loadUsers = () => {
    const list = userRepo.getAll();
    setUsers(list);
    setRoles(userRepo.getRoles());
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newUsername.trim()) { setCreateError('Username is required.'); return; }
    if (!newFullName.trim()) { setCreateError('Full name is required.'); return; }
    if (!newPassword || newPassword.length < 6) { setCreateError('Password must be at least 6 characters.'); return; }
    if (newPassword !== newConfirmPassword) { setCreateError('Passwords do not match.'); return; }

    try {
      const created = userRepo.create({
        username: newUsername.trim(),
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        role: newRole,
        password: newPassword
      });

      auditRepo.log('USER_MANAGEMENT', 'Users', created.id, `Created user "${created.username}" with role "${created.role}"`, currentUser || undefined);
      addToast(`User account "${created.username}" created successfully.`, 'success');

      setIsCreateOpen(false);
      setNewUsername('');
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewConfirmPassword('');
      loadUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Error creating user account.');
    }
  };

  const handleToggleActive = (target: User) => {
    if (target.id === currentUser?.id) {
      addToast('You cannot deactivate your own currently active account.', 'warning');
      return;
    }

    const nextActive = target.is_active ? 0 : 1;
    userRepo.update(target.id, { is_active: nextActive });
    auditRepo.log('USER_MANAGEMENT', 'Users', target.id, `${nextActive ? 'Activated' : 'Deactivated'} user account "${target.username}"`, currentUser || undefined);
    addToast(`User ${target.username} ${nextActive ? 'activated' : 'deactivated'}.`, 'info');
    loadUsers();
  };

  const handleDeleteUser = (target: User) => {
    if (target.id === currentUser?.id) {
      addToast('You cannot delete your own account.', 'warning');
      return;
    }

    showConfirm({
      title: 'Delete User Account?',
      message: `Are you sure you want to delete user "${target.username}" (${target.full_name})? This action cannot be undone and will be logged.`,
      confirmLabel: 'Delete User',
      isDestructive: true,
      onConfirm: () => {
        try {
          const ok = userRepo.delete(target.id);
          if (ok) {
            auditRepo.log('USER_MANAGEMENT', 'Users', target.id, `Deleted user account "${target.username}"`, currentUser || undefined);
            addToast(`User ${target.username} deleted.`, 'success');
            loadUsers();
          }
        } catch (err: any) {
          addToast(err.message || 'Failed to delete user.', 'error');
        }
      }
    });
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      addToast('New password must be at least 6 characters.', 'warning');
      return;
    }

    userRepo.changePassword(resetTargetUser.id, resetPasswordVal);
    auditRepo.log('USER_MANAGEMENT', 'Users', resetTargetUser.id, `Password reset for user "${resetTargetUser.username}"`, currentUser || undefined);
    addToast(`Password updated for ${resetTargetUser.username}.`, 'success');
    setResetTargetUser(null);
    setResetPasswordVal('');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0f3a5d]" />
            Local User Accounts & Role-Based Authorization
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage administrative personnel, operators, and review roles with salted bcrypt hashing
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-3.5 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add New User Account
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0f3a5d] text-white font-semibold">
                <th className="py-2.5 px-3 w-12 text-center">ID</th>
                <th className="py-2.5 px-3 font-mono">Username</th>
                <th className="py-2.5 px-3">Full Name</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Created</th>
                <th className="py-2.5 px-3 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                    {u.id}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    @{u.username}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    {u.full_name}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-teal-900">
                    {u.role}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {u.email || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {u.is_active ? (
                      <span className="text-emerald-700 font-semibold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                      </span>
                    ) : (
                      <span className="text-rose-700 font-semibold flex items-center justify-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                    {formatTimestampDisplay(u.created_at)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setResetTargetUser(u)}
                        className="p-1 text-slate-500 hover:text-amber-700 hover:bg-slate-100 rounded"
                        title="Reset Password"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`p-1 rounded ${u.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        title={u.is_active ? 'Deactivate User' : 'Activate User'}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-md w-full p-6 animate-in zoom-in-95 duration-100 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h2 className="text-sm font-bold text-slate-900">Create Court User Account</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mb-3 p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role *</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as RoleName)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                >
                  <option value="Super Administrator">Super Administrator</option>
                  <option value="Administrator">Administrator</option>
                  <option value="Data Entry Operator">Data Entry Operator</option>
                  <option value="Reviewer">Reviewer</option>
                  <option value="Read-Only User">Read-Only User</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    value={newConfirmPassword}
                    onChange={e => setNewConfirmPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0f3a5d] hover:bg-[#164a75] text-white font-semibold rounded"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-sm w-full p-5 animate-in zoom-in-95 duration-100 text-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-1">
              Reset Password for @{resetTargetUser.username}
            </h2>
            <p className="text-slate-500 mb-3">
              Sets a new salted bcrypt hash for this account.
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password (Min 6 chars)</label>
                <input
                  type="password"
                  value={resetPasswordVal}
                  onChange={e => setResetPasswordVal(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
