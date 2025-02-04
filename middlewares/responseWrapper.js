// middlewares/responseWrapper.js
const responseWrapper = (req, res, next) => {
    // 保存原始的 res.json 方法
    const originalJson = res.json;

    // 重写 json 方法
    res.json = function(data) {
        const userId = req.headers['x-wx-openid'];
        const wrappedData = {
            data,
            userId,  // 在响应中添加用户ID
            timestamp: Date.now()
        };
        
        return originalJson.call(this, wrappedData);
    };

    next();
};

module.exports = responseWrapper;