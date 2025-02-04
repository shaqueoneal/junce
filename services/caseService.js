// services/caseService.js
const pool = require('../config/db');
const { generateMD5 } = require('../utils/hash');
const mysql = require('mysql2');

class CaseService {
    async createCase(caseData) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            
            const {
                user_id,
                goods_name,
                goods_url,
                goods_pics,
                manufacturer,
                phone,
                problem_desc,
                test_reports,
                buy_proofs,
                buy_date,
                is_sub,
                primary_id
            } = caseData;

            const urlHash = generateMD5(goods_url);
            // if (urlHash) { // 本人提交主案件商品链接不能重复
            //     const [existing] = await pool.query(
            //         'SELECT id FROM cases WHERE url_hash = ? AND user_id = ?',
            //         [urlHash, user_id]
            //     );
                
            //     if (existing.length > 0) {
            //         throw new Error('该商品链接已存在');
            //     }
            // }

            if (is_sub) { 
                await pool.query(
                    'UPDATE cases SET claimant_count = claimant_count + 1 WHERE id = ?',
                    [primary_id]
                );
            }

            // 生成案件ID
            const caseId = 'case_' + Date.now() + Math.floor(Math.random() * 1000);

            // 插入案件基本信息
            await conn.query(
                `INSERT INTO cases (
                    id, user_id, goods_name, goods_url, url_hash, manufacturer, 
                    phone, problem_desc, is_sub, primary_id, buy_date, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [caseId, user_id, goods_name, goods_url, urlHash, manufacturer, 
                 phone, JSON.stringify(problem_desc), is_sub, primary_id, buy_date, '待审核']
            );

            // 插入商品图片
            for (const pic of goods_pics) {
                await conn.query(
                    'INSERT INTO goods_pics (case_id, url, type) VALUES (?, ?, ?)',
                    [caseId, pic.url, pic.type || 'image']
                );
            }

            // 插入检测报告
            for (const report of test_reports) {
                await conn.query(
                    'INSERT INTO test_reports (case_id, url, type) VALUES (?, ?, ?)',
                    [caseId, report.url, report.type || 'image']
                );
            }

            // 插入购买凭证
            for (const proof of buy_proofs) {
                await conn.query(
                    'INSERT INTO buy_proofs (case_id, url, type) VALUES (?, ?, ?)',
                    [caseId, proof.url, proof.type || 'image']
                );
            }

            await conn.commit();
            return { case_id: caseId };
        } catch (error) {
            console.error('Error in createCase:', error);
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async getCaseById(caseId) {
        try {
            // 准备 SQL 语句
            const caseSql = `
            SELECT c.*, u.nickname, u.avatar_url 
            FROM cases c 
            LEFT JOIN users u ON c.user_id = u.id 
            WHERE c.id = ?`;

            // 打印完整 SQL
            console.log('Case SQL:', mysql.format(caseSql, [caseId]));

            // 获取案件基本信息
            const [caseInfo] = await pool.query(caseSql, [caseId]);
        
            if (caseInfo.length === 0) {
                throw new Error('案件不存在');
            }

            // 获取相关图片和数据
            const [goods_pics] = await pool.query('SELECT * FROM goods_pics WHERE case_id = ?', [caseId]);
            const [test_reports] = await pool.query('SELECT * FROM test_reports WHERE case_id = ?', [caseId]);
            const [buy_proofs] = await pool.query('SELECT * FROM buy_proofs WHERE case_id = ?', [caseId]);

            // 如果是主案件，获取子案件
            let subCases = [];
            if (!caseInfo[0].is_sub) {
                [subCases] = await pool.query('SELECT * FROM cases WHERE primary_id = ?', [caseId]);
            }

            return {
                ...caseInfo[0],
                goods_pics,
                test_reports,
                buy_proofs,
                problem_desc: JSON.parse(caseInfo[0].problem_desc),
                sub_cases: subCases
            };
        } catch (error) {
            console.error('Error in getCaseById:', error);
            throw error;
        }
    }

    async updateCaseStatus(caseId, status) {
        const [existing] = await pool.query('SELECT id FROM cases WHERE id = ?', [caseId]);
        
        if (existing.length === 0) {
            throw new Error('案件不存在');
        }

        await pool.query(
            'UPDATE cases SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, caseId]
        );

        if (status === '已受理') {
            await pool.query(
                'UPDATE cases SET accept_at = NOW() WHERE id = ?',
                [caseId]
            );
        } else if (status === '已结案') {
            await pool.query(
                'UPDATE cases SET finish_at = NOW() WHERE id = ?',
                [caseId]
            );
        }

        return { success: true };
    }
     
    async getWishCases(keyword, pageNum, pageSize) {
        return this.searchCases({
            filters: [{
                field: 'status',
                condition: 'eq',
                values: ['待审核'],
              },
              {
                field: 'goods_name',
                condition: 'contains',
                values: [keyword],
              },
              {
                field: 'claimant_count',
                values: [],
                order: 'desc',
              },
              {
                field: 'is_sub',
                condition: 'eq',
                values: [0],
              }
            ],
            pageNum,
            pageSize
        });
    }

    async getRecentCases(keyword, pageNum, pageSize) {
        return this.searchCases({
            filters: [
                {
                field: 'status',
                condition: 'in',
                values: ['待审核'],
                },
                {
                field: 'goods_name',
                condition: 'contains',
                values: [keyword],
                },
                {
                field: 'created_at',
                condition: 'date',
                values: [],
                order: 'desc',
                },
                {
                field: 'is_sub',
                condition: 'eq',
                values: [0],
                }
            ],
            pageNum,
            pageSize
        });
    }

    async getLastChosenCase() {
        return this.searchCases({
            filters: [
                { field: 'status', condition: 'neq', values: ['待审核'] },
                { field: 'created_at', condition: 'date', values: [], order: 'desc' },
                {
                  field: 'is_sub',
                  condition: 'eq',
                  values: [0],
                }
              ],
              pageNum: 1,
              pageSize: 1,
        });
    }

    async getGoingCases(keyword, pageNum, pageSize) {
        return this.searchCases({
            filters: [{
                field: 'status',
                condition: 'in',
                values: ['已受理', '维权中'],
              },
              {
                field: 'goods_name',
                condition: 'contains',
                values: [keyword],
              },
              {
                field: 'created_at',
                condition: 'date',
                values: [],
                order: 'desc',
              },
              {
                field: 'is_sub',
                condition: 'eq',
                values: [0],
              }
            ],
            pageNum,
            pageSize
        });
    }

    async getFinishedCases(keyword, pageNum, pageSize) {
        return this.searchCases({
            filters: [{
                field: 'status',
                condition: 'in',
                values: ['维权成功', '维权失败', '已结案'],
              },
              {
                field: 'goods_name',
                condition: 'contains',
                values: [keyword],
              },
              {
                field: 'created_at',
                condition: 'date',
                values: [],
                order: 'desc',
              },
              {
                field: 'is_sub',
                condition: 'eq',
                values: [0],
              }
            ],
            pageNum,
            pageSize
        });
    }

    getMyCases(userId, status, pageNum, pageSize) {
        let params = {
            filters: [{
                field: 'user_id',
                condition: 'eq',
                values: [userId],
                },
                {
                field: 'created_at',
                condition: 'date',
                values: [],
                order: 'desc',
                }
            ],
            pageNum,
            pageSize
        };

        if (status != '全部') {
            if (status === '已结案') {
              params.filters.push({ field: 'status', condition: 'in', values: ['维权成功', '维权失败', '已结案'] });
            } else {
              params.filters.push({ field: 'status', condition: 'eq', values: [status] });
            }
          }
        return this.searchCases(params);
    }

    getSuccessResults() {
        let params = {
            filters: [
                { 
                    field: 'status', 
                    condition: 'in', 
                    values: ['维权成功'] 
                },
                {
                field: 'created_at',
                condition: 'date',
                values: [],
                order: 'desc',
                }
            ],
            pageNum: 1,
            pageSize: 50
        };
        return this.searchCases(params);
    }

    async searchCases({ filters = [], pageNum = 1, pageSize = 30 }) {
        let query = `
            SELECT c.*, u.nickname, u.avatar_url 
            FROM cases c 
            LEFT JOIN users u ON c.user_id = u.id
            WHERE 1=1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM cases c WHERE 1=1';
        let params = [];
        let orderClause = '';

        // 处理过滤条件
        for (const filter of filters) {
            const { field, condition, values, order } = filter;

            // 处理排序
            if (order) {
                orderClause = ` ORDER BY ${field} ${order.toUpperCase()}`;
            }

            // 处理过滤条件
            switch (condition) {
                case 'date':
                    if (values.length === 2) {
                        query += ` AND c.${field} BETWEEN ? AND ?`;
                        countQuery += ` AND c.${field} BETWEEN ? AND ?`;
                        params.push(values[0], values[1]);
                    } else if (values.length === 1) {
                        query += ` AND DATE(c.${field}) = DATE(?)`;
                        countQuery += ` AND DATE(c.${field}) = DATE(?)`;
                        params.push(values[0]);
                    }
                    break;

                case 'contains':
                    const likeConditions = values.map(value => {
                        params.push(`%${value}%`);
                        return `c.${field} LIKE ?`;
                    }).join(' AND ');
                    query += ` AND (${likeConditions})`;
                    countQuery += ` AND (${likeConditions})`;
                    break;

                case 'in':
                    query += ` AND c.${field} IN (?)`;
                    countQuery += ` AND c.${field} IN (?)`;
                    params.push(values);
                    break;

                case 'notin':
                    query += ` AND c.${field} NOT IN (?)`;
                    countQuery += ` AND c.${field} NOT IN (?)`;
                    params.push(values);
                    break;

                case 'eq':
                    query += ` AND c.${field} = ?`;
                    countQuery += ` AND c.${field} = ?`;
                    params.push(values[0]);
                    break;

                case 'neq':
                    query += ` AND c.${field} != ?`;
                    countQuery += ` AND c.${field} != ?`;
                    params.push(values[0]);
                    break;

                default:
                    break;
            }
        }

        // 添加排序和分页
        query += orderClause;
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(pageSize), (pageNum - 1) * pageSize);

        console.log('searchCases', query, params);

        try {
            // 执行查询
            const [cases] = await pool.query(query, params);
            const [totalResult] = await pool.query(countQuery, params.slice(0, -2));

            // 获取每个案件的相关图片和数据
            for (let caseItem of cases) {
                const [goods_pics] = await pool.query('SELECT * FROM goods_pics WHERE case_id = ?', [caseItem.id]);
                const [test_reports] = await pool.query('SELECT * FROM test_reports WHERE case_id = ?', [caseItem.id]);
                const [buy_proofs] = await pool.query('SELECT * FROM buy_proofs WHERE case_id = ?', [caseItem.id]);

                caseItem.goods_pics = goods_pics;
                caseItem.test_reports = test_reports;
                caseItem.buy_proofs = buy_proofs;
                caseItem.problem_desc = JSON.parse(caseItem.problem_desc);
            }

            return {
                pageNum: parseInt(pageNum),
                pageSize: parseInt(pageSize),
                total: totalResult[0].total,
                list: cases,
                algId: 0
            };
        } catch (error) {
            console.error('Error in searchCases:', error);
            throw error;
        }
    }

}

module.exports = new CaseService();