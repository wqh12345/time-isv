import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import history from 'connect-history-api-fallback';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const APP_ID = "cli_a9572ba449785cc5";
// 密钥不再硬编码：真实值放本地 .env.server.local（不入库，模板见 .env.server.example），
// 用 `node --env-file=.env.server.local server.js` 启动
const APP_SECRET = process.env.FEISHU_APP_SECRET || "";
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "";
const MCP_KEY = process.env.MCP_KEY || "";
const PROJECT_ID = "6xxxxxxx";
const REDIRECT_URI = "http://192.168.110.91:8000/callback";
// 解析JSON请求体
app.use(express.json());

// 飞书token代理接口
app.post('/api/feishu/token', async (req, res) => {
  try {
    const { authorizationCode } = req.body;
    
    console.log('📥 收到飞书token请求, authorizationCode:', authorizationCode);
    
    // 调用飞书开放平台API获取token
    const feishuResponse = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
      {
        grant_type: "authorization_code",
        client_id: APP_ID,
        client_secret: APP_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI
      },
       {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log('📤 飞书token响应:', feishuResponse.data);
    
    // 将飞书的响应返回给前端
    res.json(feishuResponse.data);
  } catch (error) {
    console.error('❌ 飞书token代理错误:', error.message);
    console.error('错误详情:', error.response?.data || error);
    
    res.status(500).json({
      code: -1,
      msg: error.response?.data?.msg || '获取飞书token失败',
      data: null
    });
  }
});

// 支持 HTML5 History API 模式路由
// 这个中间件会将所有非静态资源的请求重写到 index.html
// 但不会影响 API 请求和静态文件请求
app.use(history({
  // 保留静态文件（如 .js, .css, .png 等）的正常访问
  rewrites: [
    {
      from: /^\/$/,// 根路径
      to: '/index.html'
    }
  ]
}));

// 静态文件服务 - 必须在 history 中间件之后
app.use(express.static(join(__dirname, 'dist')));

// 所有路由都返回 index.html（作为备用）
app.get('*', (req, res) => {
  // 只有当请求不是 API 或静态文件时才返回 index.html
  if (!req.path.startsWith('/api') && !req.path.includes('.')) {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on http://0.0.0.0:${PORT}`);
  console.log(`📍 Access locally: http://localhost:${PORT}`);
  console.log(`🌐 Access via network: http://192.168.110.91:${PORT}`);
  console.log(`\n📝 Available routes:`);
  console.log(`   - http://192.168.110.91:${PORT}/resource`);
  console.log(`   - http://192.168.110.91:${PORT}/log`);
  console.log(`   - http://192.168.110.91:${PORT}/approval`);
  console.log(`   - http://192.168.110.91:${PORT}/management`);
  console.log(`   - http://192.168.110.91:${PORT}/setting`);
  console.log(`   - http://192.168.110.91:${PORT}/pay`);
  console.log(`\n💡 All routes support direct access and page refresh!\n`);
});
