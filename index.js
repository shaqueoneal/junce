const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter, pool } = require("./db");
const router = express.Router();


const { authMiddleware } = require('./middlewares/auth');
const responseWrapper = require('./middlewares/responseWrapper');
const userRoutes = require('./routes/userRoutes');
const caseRoutes = require('./routes/caseRoutes');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

const { LOG_LEVEL } = process.env;
if (LOG_LEVEL === 'debug') {
  app.use((req, res, next) => {
    const oldJson = res.json;
    res.json = function(body) {
      res.responseBody = JSON.stringify(body);
      return oldJson.apply(res, arguments);
    };
    next();
  });
  
  // 自定义 morgan 格式
  morgan.token('request-body', (req) => JSON.stringify(req.body));
  morgan.token('response-body', (req, res) => res.responseBody);
  // morgan.token('response-body', (req, res) => JSON.stringify(res.body));
  
  // 创建详细的日志格式
  const logger = morgan((tokens, req, res) => {
      return [
          `\nMethod: ${tokens.method(req, res)}`,
          `URL: ${tokens.url(req, res)}`,
          `Status: ${tokens.status(req, res)}`,
          `Request Body: ${tokens['request-body'](req, res)}`,
          `Response Body: ${tokens['response-body'](req, res)}`,
          `Time: ${tokens['response-time'](req, res)} ms\n`
      ].join('\n');
  });
  app.use(logger);
}

// 中间件
app.use(authMiddleware);
// app.use(responseWrapper);

// 路由
app.use('/api', userRoutes);
app.use('/api', caseRoutes);

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误' });
});

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 首页
app.get("/api", async (req, res) => {
  res.send({
    header: req.headers,
    get:req.query
  })
});

// 更新计数
app.post("/api/count", async (req, res) => {
  const { action } = req.body;
  if (action === "inc") {
    await Counter.create();
  } else if (action === "clear") {
    await Counter.destroy({
      truncate: true,
    });
  }
  res.send({
    code: 0,
    data: await Counter.count(),
  });
});

// 获取计数
app.get("/api/count", async (req, res) => {
  const result = await Counter.count();
  res.send({
    code: 0,
    data: result,
  });
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

const port = process.env.PORT || 80;

async function bootstrap() {
  await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
