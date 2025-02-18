// services/caseService.js
const pool = require('../config/db');
const { generateMD5 } = require('../utils/hash');
const mysql = require('mysql2');

class CaseService {
    statusMap = {
        'count_to_submit': '待提交',
        'count_to_audit': '待审核',
        'count_audited': '已审核',
        'count_accepted': '已受理',
        'count_underway': '维权中',
        'count_success': '维权成功',
        'count_failed': '维权失败',
        'count_closed': '已结案',
    }
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
                primary_id,
                claimant_name,
            } = caseData;

            const urlHash = generateMD5(goods_url);
            // if (urlHash) { // 本人提交主案件商品链接不能重复
            //     const [existing] = await conn.query(
            //         'SELECT id FROM cases WHERE url_hash = ? AND user_id = ?',
            //         [urlHash, user_id]
            //     );
                
            //     if (existing.length > 0) {
            //         throw new Error('该商品链接已存在');
            //     }
            // }

            if (is_sub) { 
                await conn.query(
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
                    phone, problem_desc, is_sub, primary_id, buy_date, claimant_name, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [caseId, user_id, goods_name, goods_url, urlHash, manufacturer, 
                 phone, problem_desc, is_sub, primary_id, buy_date, claimant_name, '待审核']
            );

            await conn.query(
                `INSERT INTO case_status_log (
                    case_id, approver_id, operation_type, from_status, to_status, reason
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [caseId, user_id, 'submit', '待提交', '待审核', '']
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

            // 更新用户信息
            const values = [];
            phone && values.push(phone);
            claimant_name && values.push(claimant_name);
    
            await conn.query(
                `UPDATE users SET 
                ${phone ? 'phone = ?,' : ''}
                ${claimant_name ? 'claimant_name = ?,' : ''}
                updated_at = NOW() WHERE id = ?`,
                values.concat([user_id])
            );

            return { case_id: caseId };
        } catch (error) {
            console.error('Error in createCase:', error);
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async updateCase(caseData) {
        const conn = await pool.getConnection();
        try {
            const {
                id,
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
                primary_id,
                claimant_name,
            } = caseData;

            const urlHash = generateMD5(goods_url);

            // 准备 SQL 语句
            const caseSql = `
            SELECT c.*, u.nick_name, u.avatar_url 
            FROM cases c 
            LEFT JOIN users u ON c.user_id = u.id 
            WHERE c.id = ? AND c.is_alive = 1`;

            // 打印完整 SQL
            console.log('Case SQL:', mysql.format(caseSql, [id]));

            // 获取案件基本信息
            const [caseInfo] = await conn.query(caseSql, [id]);
        
            if (caseInfo.length === 0) {
                throw new Error('案件不存在');
            }

            await conn.beginTransaction();
            await conn.query(
                `UPDATE cases SET
                    user_id =?, goods_name =?, goods_url =?, url_hash =?, manufacturer =?,
                    phone =?, problem_desc =?, is_sub =?, primary_id =?, buy_date =?, claimant_name=?, status =? 
                    WHERE id =?`,
                [user_id, goods_name, goods_url, urlHash, manufacturer, 
                 phone, problem_desc, is_sub, primary_id, buy_date, claimant_name, '待审核', id]
            );

            await conn.query(
                `INSERT INTO case_status_log (
                    case_id, approver_id, operation_type, from_status, to_status, reason
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [id, user_id, 'submit', '待提交', '待审核', '']
            );

            // 插入商品图片
            for (const pic of goods_pics) {
                await conn.query(
                    'UPDATE goods_pics SET url =?, type =? WHERE case_id =?',
                    [ pic.url, pic.type || 'image', id]
                );
            }

            // 插入检测报告
            for (const report of test_reports) {
                await conn.query(
                    'UPDATE test_reports SET url =?, type =? WHERE case_id =?',
                    [report.url, report.type || 'image', id]
                );
            }

            // 插入购买凭证
            for (const proof of buy_proofs) {
                await conn.query(
                    'UPDATE buy_proofs SET url =?, type =? WHERE case_id =?',
                    [proof.url, proof.type || 'image', id]
                );
            }

            await conn.commit();

            // 更新用户信息
            const values = [];
            phone && values.push(phone);
            claimant_name && values.push(claimant_name);
    
            await conn.query(
                `UPDATE users SET 
                ${phone ? 'phone = ?,' : ''}
                ${claimant_name ? 'claimant_name = ?,' : ''}
                updated_at = NOW() WHERE id = ?`,
                values.concat([user_id])
            );
            
            return { success: true, case_id: id };
        } catch (error) {
            console.error('Error in updateCase:', error);
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async getCaseById(caseId) {
        const conn = await pool.getConnection();
        try {
            // 准备 SQL 语句
            const caseSql = `
            SELECT c.*, u.nick_name, u.avatar_url 
            FROM cases c 
            LEFT JOIN users u ON c.user_id = u.id 
            WHERE c.id = ? AND c.is_alive = 1`;

            // 打印完整 SQL
            console.log('Case SQL:', mysql.format(caseSql, [caseId]));

            // 获取案件基本信息
            const [caseInfo] = await conn.query(caseSql, [caseId]);
        
            if (caseInfo.length === 0) {
                throw new Error('案件不存在');
            }

            // 获取相关图片和数据
            const [goods_pics] = await conn.query('SELECT * FROM goods_pics WHERE case_id = ?', [caseId]);
            const [test_reports] = await conn.query('SELECT * FROM test_reports WHERE case_id = ?', [caseId]);
            const [buy_proofs] = await conn.query('SELECT * FROM buy_proofs WHERE case_id = ?', [caseId]);

            // 如果是主案件，获取子案件
            let subCases = [];
            if (!caseInfo[0].is_sub) {
                [subCases] = await conn.query('SELECT * FROM cases WHERE primary_id = ? AND is_alive = 1', [caseId]);
            }

            return {
                ...caseInfo[0],
                goods_pics,
                test_reports,
                buy_proofs,
                sub_cases: subCases
            };
        } catch (error) {
            console.error('Error in getCaseById:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    async updateCaseStatus(params) {
        const { case_id, approver_id, status, operation_type, reason } = params
        const from_status = status;
        let to_status = status;

        switch (status) {
            case '待提交':
                // 由createCase 处理提交逻辑
                break;
            case '待审核':
                if (operation_type === 'accept') {
                    to_status = '已审核';
                } else if (operation_type === 'reject') {
                    to_status = '待提交';
                }

                break;
            case '已审核':
                if (operation_type === 'accept') {
                    to_status = '已受理';
                } else if (operation_type === 'reject') {
                    to_status = '待审核';
                }
                
                break;
            case '已受理':
                if (operation_type === 'accept') {
                    to_status = '维权中';
                } else if (operation_type === 'reject') {
                    to_status = '待提交';
                }
                
                break;
            case '维权中':
                if (operation_type === 'accept') {
                    to_status = '维权成功';
                } else if (operation_type === 'reject') {
                    to_status = '维权失败';
                }
                
                break;
            case '已结案':
                to_status = '已结案';
                break;
            default:
                throw new Error('无效的状态');
        }

        const conn = await pool.getConnection();
        try {
            const [existing] = await conn.query('SELECT id FROM cases WHERE id = ? AND is_alive = 1', [case_id]);
        
            if (existing.length === 0) {
                throw new Error('案件不存在');
            }

            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO case_status_log (
                    case_id, approver_id, operation_type, from_status, to_status, reason
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [case_id, approver_id, operation_type, from_status, to_status, reason]
            );

            if (to_status === '维权成功' || to_status === '维权失败' || to_status === '已结案') {
                await conn.query(
                    'UPDATE cases SET status = ?, result=?, updated_at = NOW(), finish_at = NOW() WHERE id = ?',
                    [to_status, reason, case_id]
                );
            } else {
                await conn.query(
                    'UPDATE cases SET status = ?, updated_at = NOW() WHERE id = ?',
                    [to_status, case_id]
                );
            }

            console.log('to_status:', to_status);
            await conn.commit();
            return { success: true, status: to_status };
        } catch (error) {
            console.error('Error in updateCaseStatus:', error);
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        } 
    }
    
    async getCaseStatusLog(caseId) {
        const conn = await pool.getConnection();
        try {
            const [list] = await conn.query('SELECT * FROM case_status_log WHERE case_id =?', [caseId]);
            return list;
        } catch (error) {
            console.error('Error in getCaseStatusLog:', error);
            throw error;
        } finally {
            conn.release();
        }
    }
    
    async getWishCases(keyword, page_num, page_size) {
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
            page_num,
            page_size
        });
    }

    async getRecentCases(keyword, page_num, page_size) {
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
            page_num,
            page_size
        });
    }

    async getLastChosenCase() {
        return this.searchCases({
            filters: [
                { field: 'status', condition: 'notin', values: ['待提交', '待审核', '已审核'] },
                { field: 'created_at', condition: 'date', values: [], order: 'desc' },
                {
                  field: 'is_sub',
                  condition: 'eq',
                  values: [0],
                }
              ],
              page_num: 1,
              page_size: 1,
        });
    }

    async getGoingCases(keyword, page_num, page_size) {
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
            page_num,
            page_size
        });
    }

    async getFinishedCases(keyword, page_num, page_size) {
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
            page_num,
            page_size
        });
    }

    async readCases(userId, caseIds) {
        const conn = await pool.getConnection();
        try {
            const query = `
                UPDATE cases SET is_read = 1 WHERE user_id=(?) AND id IN (?)   
            `;
            const values = [userId, caseIds];
            await conn.query(query, values);

            return { success: true };
        } catch (error) {
            console.error('Error in readCases:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    async getMyUnreadCasesCount(userId) {
        const conn = await pool.getConnection();
        try {
            let query = `
                SELECT 
                    COUNT(CASE WHEN status = '待提交' THEN 1 END) AS count_to_submit,
                    COUNT(CASE WHEN status = '待审核' THEN 1 END) AS count_to_audit,
                    COUNT(CASE WHEN status = '已审核' THEN 1 END) AS count_audited,
                    COUNT(CASE WHEN status = '已受理' THEN 1 END) AS count_accepted,
                    COUNT(CASE WHEN status = '维权中' THEN 1 END) AS count_underway,
                    COUNT(CASE WHEN status = '维权成功' THEN 1 END) AS count_success,
                    COUNT(CASE WHEN status = '维权失败' THEN 1 END) AS count_failed,
                    COUNT(CASE WHEN status = '已结案' THEN 1 END) AS count_closed
                FROM cases 
                WHERE user_id = ? AND is_alive = 1 AND is_read = 0
            `;
            const [list] = await conn.query(query, [userId]);
            console.log('getMyUnreadCasesCount SQL:', mysql.format(query, [userId]));
            // [{count_to_submit: 1, count_to_audit: 1, count_audited: 1, count_accepted: 1, count_underway: 1, count_success: 1, count_failed: 1, count_closed: 1}]
            console.log('unread list:', list);
            let newList = [];
            Object.keys(list[0]).forEach(key => {
                let newObj = {};
                newObj.status = this.statusMap[key];
                newObj.count = list[0][key] || 0;
                if (key === 'count_closed') {
                    newObj.count = list[0]['count_success'] + list[0]['count_failed'] + newObj.count;
                }
                newList.push(newObj);
            });

            return newList;
        } catch (error) {
            console.error('Error in getMyUnreadCasesCount:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    async getMyAuditCasesCount(userId) {
        const conn = await pool.getConnection();
        try {
            let query = `
                SELECT 
                    COUNT(CASE WHEN status = '待审核' THEN 1 END) AS count_to_audit,
                    COUNT(CASE WHEN status = '已审核' THEN 1 END) AS count_audited,
                    COUNT(CASE WHEN status = '已受理' THEN 1 END) AS count_accepted,
                    COUNT(CASE WHEN status = '维权中' THEN 1 END) AS count_underway,
                    COUNT(CASE WHEN status = '维权成功' THEN 1 END) AS count_success,
                    COUNT(CASE WHEN status = '维权失败' THEN 1 END) AS count_failed,
                    COUNT(CASE WHEN status = '已结案' THEN 1 END) AS count_closed
                FROM cases 
                WHERE is_alive = 1
            `;
            const [list] = await conn.query(query);
            console.log('list:', list);
            // [{count_to_submit: 1, count_to_audit: 1, count_audited: 1, count_accepted: 1, count_underway: 1, count_success: 1, count_failed: 1, count_closed: 1}]

            let newList = [];
            Object.keys(list[0]).forEach(key => {
                let newObj = {};
                newObj.status = this.statusMap[key];
                newObj.count = list[0][key] || 0;
                if (key === 'count_closed') {
                    newObj.count = list[0]['count_success'] + list[0]['count_failed'] + newObj.count;
                }
                newList.push(newObj);
            });

            return newList;
        } catch (error) {
            console.error('Error in getMyCasesUnread:', error);
            throw error;
        } finally {
            conn.release();
        }
        
    }

    getMyCases(userId, status, page_num, page_size) {
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
            page_num,
            page_size
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

    getAuditCases(userId, status, page_num, page_size) {
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
                },
                {
                field: 'is_sub',
                condition: 'eq',
                values: [0],
                }
            ],
            page_num,
            page_size
        };
        if (status === '已结案') {
            params.filters.push({ field: 'status', condition: 'in', values: ['维权成功', '维权失败', '已结案'] });
        }
        else if (status === '全部') {
            params.filters.push({ field: 'status', condition: 'in', values: ['待审核', '已审核', '已受理', '维权中'] });
        } else {
            params.filters.push({ field: 'status', condition: 'eq', values: [status] });
        }

        return this.searchCases(params);
    }

    getSuccessCasesResult() {
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
            page_num: 1,
            page_size: 50
        };
        return this.searchCases(params);
    }

    async searchCases({ filters = [], page_num = 1, page_size = 30 }) {
        let query = `
            SELECT c.*, u.nick_name, u.avatar_url 
            FROM cases c 
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.is_alive = 1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM cases c WHERE c.is_alive = 1';
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
        params.push(parseInt(page_size), (page_num - 1) * page_size);

        const conn = await pool.getConnection();
        try {
            // 执行查询
            const [cases] = await conn.query(query, params);
            console.log('searchCases: ', query, params);
            const [totalResult] = await conn.query(countQuery, params.slice(0, -2));
            console.log('searchCases total: ', countQuery, params.slice(0, -2));

            // 获取每个案件的相关图片和数据
            for (let caseItem of cases) {
                const [goods_pics] = await conn.query('SELECT * FROM goods_pics WHERE case_id = ?', [caseItem.id]);
                const [test_reports] = await conn.query('SELECT * FROM test_reports WHERE case_id = ?', [caseItem.id]);
                const [buy_proofs] = await conn.query('SELECT * FROM buy_proofs WHERE case_id = ?', [caseItem.id]);

                caseItem.goods_pics = goods_pics;
                caseItem.test_reports = test_reports;
                caseItem.buy_proofs = buy_proofs;
            }

            return {
                page_num: parseInt(page_num),
                page_size: parseInt(page_size),
                total: totalResult[0].total,
                list: cases,
                algId: 0
            };
        } catch (error) {
            console.error('Error in searchCases:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

}

module.exports = new CaseService();