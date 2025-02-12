// middlewares/auth.js
const pool = require('../config/db');

const authMiddleware = async (req, res, next) => {
    try {
        const userId = req.headers['x-wx-openid'];

        if (!userId) {
            return res.status(401).json({ message: '未授权的访问' });
        }

        // 检查用户是否存在，不存在则创建
        const [existing] = await pool.query(
            'SELECT id, nickname, avatar_url FROM users WHERE id = ?',
            [userId]
        );

        if (existing.length === 0) {
            // 创建新用户
            await pool.query(
                'INSERT INTO users (id, nickname, created_at) VALUES (?, ?, NOW())',
                [userId, `用户${userId.slice(-6)}`] // 使用ID后6位作为默认昵称
            );
        }

        // 记录请求日志
        await pool.query(
            'INSERT INTO request_logs (user_id, path, method) VALUES (?, ?, ?)',
            [userId, req.path, req.method]
        );

        // 将用户信息添加到请求对象中
        req.user = existing[0] || { id: userId };
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
};

const checkAudit = async (req, res, next) => {
    try {
        const userId = req.headers['x-wx-openid'];
        const [audit] = await pool.query(
            'SELECT is_audit FROM users WHERE id = ? AND is_audit = true OR is_audit = true',
            [userId]
        );

        console.log('audit:', audit);

        if (audit.length === 0) {
            return res.status(403).json({ message: '需要审核员权限' });
        }
        next();
    } catch (error) {
        console.log('checkAudit:', error);
        res.status(500).json({ message: error.message });
    }
};

const checkAdmin = async (req, res, next) => {
    try {
        const adminId = req.headers['admin-id'];
        const [admin] = await pool.query(
            'SELECT is_admin FROM users WHERE id = ? AND is_admin = true',
            [adminId]
        );

        if (admin.length === 0) {
            return res.status(403).json({ message: '需要管理员权限' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    checkAudit,
    checkAdmin,
    authMiddleware
};