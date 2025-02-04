// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { checkAdmin, checkSuperAdmin } = require('../middlewares/auth');

// 创建用户
router.post('/users', async (req, res) => {
    try {
        const result = await userService.createUser(req.body);
        res.status(201).json({
            success: true,
            message: '用户创建成功',
            user_id: result.id
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取用户列表
router.get('/users', async (req, res) => {
    try {
        const result = await userService.getUserList(req.query.page, req.query.limit);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取登录用户信息
router.get('/users/info', async (req, res) => {
    try {   
        const userId = req.headers['x-wx-openid'];
        const user = await userService.getUserById(userId);
        res.json(user);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// 获取单个用户信息
router.get('/users/:id', async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json(user);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});


// 更新用户信息
router.put('/users/:id', async (req, res) => {
    try {
        await userService.updateUser(req.params.id, req.body);
        res.json({
            success: true,
            message: '用户信息更新成功'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 删除用户
router.delete('/users/:id', checkAdmin, async (req, res) => {
    try {
        await userService.deleteUser(req.params.id);
        res.json({
            success: true,
            message: '用户删除成功'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 设置/取消管理员权限
router.patch('/users/:id/admin', checkSuperAdmin, async (req, res) => {
    try {
        const { is_admin } = req.body;
        await userService.updateAdminStatus(req.params.id, is_admin);
        res.json({
            success: true,
            message: `${is_admin ? '设置' : '取消'}管理员权限成功`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;