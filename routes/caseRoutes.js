// routes/caseRoutes.js
const express = require('express');
const router = express.Router();
const caseService = require('../services/caseService');
const { checkAdmin } = require('../middlewares/auth');

// 搜索案件
router.post('/cases/search', async (req, res) => {
    try {
        const result = await caseService.searchCases(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取心愿清单
router.post('/cases/wish', async (req, res) => {
    try {
        const { keyword, pageNum, pageSize } = req.body;
        const result = await caseService.getWishCases(keyword, pageNum, pageSize);
        console.log('result:', result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取最新提交
router.post('/cases/recent', async (req, res) => {
    try {
        const { keyword, pageNum, pageSize } = req.body;
        const result = await caseService.getRecentCases(keyword, pageNum, pageSize);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取最近选中案件
router.post('/cases/last_chosen', async (req, res) => {
    try {
        const result = await caseService.getLastChosenCase();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取进行中案件
router.post('/cases/going', async (req, res) => {
    try {
        const { keyword, pageNum, pageSize } = req.body;
        const result = await caseService.getGoingCases(keyword, pageNum, pageSize);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取已完成案件
router.post('/cases/finished', async (req, res) => {
    try {
        const { keyword, pageNum, pageSize } = req.body;
        const result = await caseService.getFinishedCases(keyword, pageNum, pageSize);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取我的案件
router.post('/cases/my', async (req, res) => {
    try {
        const user_id = req.headers['x-wx-openid'];
        const { status, pageNum, pageSize } = req.body;
        const result = await caseService.getMyCases(user_id, status, pageNum, pageSize);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 成功维权案件结果列表
router.get('/cases/results', async (req, res) => {
    try {
        const result = await caseService.getSuccessResults(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取案件详情
router.get('/cases/:id', async (req, res) => {
    try {
        console.log('case_id:', req.params.id);
        const caseData = await caseService.getCaseById(req.params.id);
        res.json(caseData);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// 更新案件状态（仅管理员）
router.patch('/cases/:id/status', checkAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        await caseService.updateCaseStatus(req.params.id, status);
        res.json({
            success: true,
            message: '案件状态更新成功'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 创建案件
router.post('/cases', async (req, res) => {
    try {
        const user_id = req.headers['x-wx-openid'];
        const result = await caseService.createCase({...req.body, user_id});
        res.status(201).json({
            success: true,
            case_id: result.case_id
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;