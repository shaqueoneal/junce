// services/userService.js
const pool = require('../config/db');

class UserService {
    async createUser(userData) {
        const { id, nickname, avatar_url, phone, is_admin, is_audit } = userData;
        
        // 检查用户ID是否已存在
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE id = ?',
            [id]
        );

        if (existing.length > 0) {
            throw new Error('用户ID已存在');
        }

        // 插入新用户
        await pool.query(
            'INSERT INTO users (id, nickname, avatar_url, phone, is_admin, is_audit) VALUES (?, ?, ?, ?, ?, ?)',
            [id, nickname, avatar_url, phone, is_admin || false, is_audit || false]
        );

        return { id };
    }

    async getUserList(page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        
        const [users] = await pool.query(
            'SELECT id, nickname, avatar_url, phone, is_admin, is_audit, created_at, updated_at FROM users LIMIT ? OFFSET ?',
            [parseInt(limit), offset]
        );

        const [total] = await pool.query('SELECT COUNT(*) as total FROM users');

        return {
            users,
            total: total[0].total,
            page: parseInt(page),
            limit: parseInt(limit)
        };
    }

    async getUserById(id) {
        console.log('\n=== getUserById Start ===');
        console.log('Looking for user with ID:', id);
        const [user] = await pool.query(
            'SELECT id, nickname, avatar_url, phone, is_admin, is_audit, created_at, updated_at FROM users WHERE id = ?',
            [id]
        );

        if (user.length === 0) {
            throw new Error('用户不存在');
        }

        return user[0];
    }

    async updateUser(id, userData) {
        const { nickname, avatar_url, phone } = userData;
        
        await pool.query(
            'UPDATE users SET nickname = ?, avatar_url = ?, phone = ?, updated_at = NOW() WHERE id = ?',
            [nickname, avatar_url, phone, id]
        );

        return { success: true };
    }

    async deleteUser(id) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [existing] = await conn.query(
                'SELECT id FROM users WHERE id = ?',
                [id]
            );

            if (existing.length === 0) {
                throw new Error('用户不存在');
            }

            await conn.query('DELETE FROM cases WHERE user_id = ?', [id]);
            await conn.query('DELETE FROM users WHERE id = ?', [id]);

            await conn.commit();
            return { success: true };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async updateAdminStatus(id, isAdmin, isAudit) {
        await pool.query(
            'UPDATE users SET is_admin = ?, is_audit = ?, updated_at = NOW() WHERE id = ?',
            [isAdmin, isAudit, id]
        );
        return { success: true };
    }
}

module.exports = new UserService();