// routes/caseRoutes.js
const express = require('express');
const router = express.Router();
const caseService = require('../services/caseService');
const { checkAudit } = require('../middlewares/auth');

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
        const { keyword, page_num, page_size } = req.body;
        const result = await caseService.getWishCases(keyword, page_num, page_size);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取最新提交
router.post('/cases/recent', async (req, res) => {
    try {
        const { keyword, page_num, page_size } = req.body;
        const result = await caseService.getRecentCases(keyword, page_num, page_size);
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
        const { keyword, page_num, page_size } = req.body;
        const result = await caseService.getGoingCases(keyword, page_num, page_size);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取已完成案件
router.post('/cases/finished', async (req, res) => {
    try {
        const { keyword, page_num, page_size } = req.body;
        const result = await caseService.getFinishedCases(keyword, page_num, page_size);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取我的案件
router.post('/cases/my', async (req, res) => {
    try {
        const user_id = req.headers['x-wx-openid'];
        const { status, page_num, page_size } = req.body;
        const result = await caseService.getMyCases(user_id, status, page_num, page_size);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取审核案件列表
router.post('/cases/audit', async (req, res) => {
    try {
        const user_id = req.headers['x-wx-openid'];
        const { status, page_num, page_size } = req.body;
        const result = await caseService.getAuditCases(user_id, status, page_num, page_size);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 成功维权案件结果列表
router.get('/cases/results', async (req, res) => {
    try {
        const result = await caseService.getSuccessCasesResult(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 更新案件状态
router.post('/cases/:case_id/status', checkAudit, async (req, res) => {
    try {
        const result = await caseService.updateCaseStatus(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取案件流转记录状态
router.get('/cases/:case_id/status_log', async (req, res) => {
    try {
        const result = await caseService.getCaseStatusLog(req.params.case_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 获取案件详情
router.get('/cases/:case_id', async (req, res) => {
    try {
        console.log('case_id:', req.params.case_id);
        const caseData = await caseService.getCaseById(req.params.case_id);
        res.json(caseData);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// 创建案件
router.post('/cases', async (req, res) => {
    try {
        const user_id = req.headers['x-wx-openid'];
        const result = await caseService.createCase({...req.body, user_id});
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 更新案件
router.put('/cases/:case_id', async (req, res) => {
    try {
        const user_id = req.headers['x-wx-openid'];
        const result = await caseService.updateCase({...req.body, user_id});
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;