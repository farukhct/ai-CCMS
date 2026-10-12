/**
 * User & Role Repository
 * Manages user accounts, bcrypt password verification, and role assignments
 */

import bcrypt from 'bcryptjs';
import { query, get, run } from '../engine';
import { User, RoleDefinition, RoleName, Permission } from '../../types';

export const userRepo = {
  getAll(): User[] {
    return query<User>('SELECT id, username, password_hash, full_name, email, role, is_active, created_at, updated_at FROM Users ORDER BY id ASC');
  },

  getById(id: number): User | null {
    return get<User>('SELECT id, username, password_hash, full_name, email, role, is_active, created_at, updated_at FROM Users WHERE id = ?', [id]);
  },

  getByUsername(username: string): User | null {
    if (!username) return null;
    return get<User>('SELECT id, username, password_hash, full_name, email, role, is_active, created_at, updated_at FROM Users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
  },

  hasAnyUser(): boolean {
    const res = get<{ count: number }>('SELECT COUNT(*) as count FROM Users');
    return !!res && res.count > 0;
  },

  getRoles(): RoleDefinition[] {
    const rows = query<{ name: RoleName; description: string; permissions: string }>('SELECT name, description, permissions FROM Roles');
    return rows.map(r => ({
      name: r.name,
      description: r.description,
      permissions: JSON.parse(r.permissions) as Permission[]
    }));
  },

  getRolePermissions(roleName: RoleName): Permission[] {
    const row = get<{ permissions: string }>('SELECT permissions FROM Roles WHERE name = ?', [roleName]);
    if (!row) return [];
    try {
      return JSON.parse(row.permissions) as Permission[];
    } catch {
      return [];
    }
  },

  hashPassword(plaintext: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(plaintext, salt);
  },

  verifyPassword(plaintext: string, hash: string): boolean {
    try {
      return bcrypt.compareSync(plaintext, hash);
    } catch {
      return false;
    }
  },

  create(user: { username: string; password: string; full_name: string; email?: string; role: RoleName }): User {
    const existing = this.getByUsername(user.username);
    if (existing) {
      throw new Error(`Username "${user.username}" already exists.`);
    }

    const now = new Date().toISOString();
    const hash = this.hashPassword(user.password);

    const res = run(
      `INSERT INTO Users (username, password_hash, full_name, email, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [user.username.trim(), hash, user.full_name.trim(), user.email?.trim() || '', user.role, now, now]
    );

    return this.getById(res.lastInsertRowid)!;
  },

  update(id: number, data: { full_name?: string; email?: string; role?: RoleName; is_active?: number }): User {
    const now = new Date().toISOString();
    const existing = this.getById(id);
    if (!existing) throw new Error(`User #${id} not found`);

    run(
      `UPDATE Users SET
        full_name = ?, email = ?, role = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        data.full_name !== undefined ? data.full_name.trim() : existing.full_name,
        data.email !== undefined ? data.email.trim() : existing.email,
        data.role !== undefined ? data.role : existing.role,
        data.is_active !== undefined ? data.is_active : existing.is_active,
        now,
        id
      ]
    );

    return this.getById(id)!;
  },

  changePassword(id: number, newPlaintext: string): boolean {
    const now = new Date().toISOString();
    const hash = this.hashPassword(newPlaintext);
    const res = run('UPDATE Users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, now, id]);
    return res.changes > 0;
  },

  delete(id: number): boolean {
    const target = this.getById(id);
    if (!target) return false;

    // Check if last Super Admin
    if (target.role === 'Super Administrator') {
      const superAdminCount = get<{ count: number }>("SELECT COUNT(*) as count FROM Users WHERE role = 'Super Administrator'");
      if (superAdminCount && superAdminCount.count <= 1) {
        throw new Error('Cannot delete the last Super Administrator account.');
      }
    }

    const res = run('DELETE FROM Users WHERE id = ?', [id]);
    return res.changes > 0;
  }
};
