// config/db.js
const mysql = require('mysql2/promise');

// 从环境变量中读取数据库配置
const { MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_ADDRESS = "" } = process.env;

const [host, port] = MYSQL_ADDRESS.split(":");

// 数据库连接配置
const pool = mysql.createPool({
  host, // '10.2.106.5'
  port, // 3306
  user: MYSQL_USERNAME,
  password: MYSQL_PASSWORD,
  database: 'junce',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;