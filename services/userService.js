// services/userService.js
const pool = require('../config/db');

class UserService {
    async createUser(userData) {
        const { id, nickname, avatar_url, phone, is_admin, is_audit } = userData;
        const conn = await pool.getConnection();
        try {
            // 检查用户ID是否已存在
            const [existing] = await conn.query(
                'SELECT id FROM users WHERE id = ?',
                [id]
            );

            if (existing.length > 0) {
                throw new Error('用户ID已存在');
            }

            // 插入新用户
            await conn.query(
                'INSERT INTO users (id, nickname, avatar_url, phone, is_admin, is_audit) VALUES (?, ?, ?, ?, ?, ?)',
                [id, nickname, avatar_url, phone, is_admin || false, is_audit || false]
            );

            return { id };
        } catch (error) {
            throw error;
        } finally {
            conn.release();
        }  
    }

    async getUserList(page = 1, limit = 10) {
        const conn = await pool.getConnection();
        const offset = (page - 1) * limit;
        try {
            const [users] = await conn.query(
                'SELECT id, nickname, avatar_url, phone, is_admin, is_audit, created_at, updated_at FROM users WHERE is_alive=1 LIMIT ? OFFSET ?',
                [parseInt(limit), offset]
            );
    
            const [total] = await conn.query('SELECT COUNT(*) as total FROM users WHERE is_alive=1');
    
            return {
                users,
                total: total[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            };
        } catch (error) {
            throw error;
        } finally {
            conn.release();
        }
        
    }

    async getUserById(id) {
        const conn = await pool.getConnection();
        try {
            const [user] = await conn.query(
                'SELECT id, nickname, avatar_url, phone, is_admin, is_audit, created_at, updated_at FROM users WHERE id = ? AND is_alive = 1',
                [id]
            );
    
            if (user.length === 0) {
                throw new Error('用户不存在');
            }
    
            return user[0];
        } catch (error) {
            throw error;
        } finally {
            conn.release();
        }
    }

    async updateUser(id, userData) {
        const { nickname, avatar_url, phone } = userData;
        const conn = await pool.getConnection();
        try {
            await conn.query(
                'UPDATE users SET nickname = ?, avatar_url = ?, phone = ?, updated_at = NOW() WHERE id = ?',
                [nickname, avatar_url, phone, id]
            );
    
            return { success: true };
        } catch (error) {
            throw error;
        } finally {
            conn.release();
        }
    }

    async deleteUser(id) {
        const conn = await pool.getConnection();
        try {
            const [existing] = await conn.query(
                'SELECT id FROM users WHERE id = ?',
                [id]
            );

            if (existing.length === 0) {
                throw new Error('用户不存在');
            }

            await conn.query(
                'UPDATE users SET is_alive = 0 WHERE id = ?',[id]
            );
            return { success: true };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async updateAdminStatus(id, isAdmin, isAudit) {
        const conn = await pool.getConnection();
        try {
            await conn.query(
                'UPDATE users SET is_admin = ?, is_audit = ?, updated_at = NOW() WHERE id = ?',
                [isAdmin, isAudit, id]
            );
            return { success: true };
        } catch (error) {
            throw error;
        } finally {
            conn.release();
        }   
    }
}

module.exports = new UserService();