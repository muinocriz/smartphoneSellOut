import { createRemoteJWKSet, jwtVerify } from 'jose';

// Access 策略决定邮箱白名单。Worker 额外验证 Access 签名、签发方、AUD 和过期时间。
// 不信任客户端的邮箱/登录标记；未配置或校验失败时关闭整个受保护目录。
const publicPaths = new Set(['/index.html', '/data.csv', '/studio-ui.css', '/iso-sales-week.js']);
const studioPaths = new Set([
  '/studio/market-share.html', '/studio/market-share.csv', '/studio/market-share-data.js',
  '/studio/market-share-import.js', '/studio/market-share.css', '/studio/sales-estimator.html',
  '/studio/sales-estimates.csv', '/studio/sales-estimate-archive.js', '/studio/poster-themes.js',
  '/studio/studio-ui.css', '/studio/iso-sales-week.js'
]);
let cachedIssuer, cachedKeys;
const privateHeaders = {'Cache-Control':'private, no-store', 'CDN-Cache-Control':'no-store', 'Cloudflare-CDN-Cache-Control':'no-store'};
function reply(body, status, extra = {}) {
  return new Response(body, {status, headers:{...privateHeaders, 'Content-Type':'text/plain; charset=utf-8', ...extra}});
}
async function authenticate(request, env) {
  const issuer = String(env.CF_ACCESS_TEAM_DOMAIN || '').trim().replace(/\/$/, '');
  const audience = String(env.CF_ACCESS_AUD || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer) || !audience) return {status:503};
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return {status:401};
  try {
    if (issuer !== cachedIssuer || !cachedKeys) {
      cachedKeys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
      cachedIssuer = issuer;
    }
    const { payload } = await jwtVerify(token, cachedKeys, {
      issuer, audience, algorithms:['RS256'], requiredClaims:['exp','email']
    });
    if (typeof payload.email !== 'string' || !payload.email.trim()) return {status:403};
    return {status:200};
  } catch (_) {
    return {status:403};
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method !== 'GET' && request.method !== 'HEAD') return reply('Method not allowed', 405, {Allow:'GET, HEAD'});
    if (path === '/') {
      url.pathname = '/index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (publicPaths.has(path)) return env.ASSETS.fetch(request);
    const isLogin = path === '/studio/login';
    const isSession = path === '/studio/session.json';
    if (!studioPaths.has(path) && !isLogin && !isSession) return reply('Not found', 404);
    const auth = await authenticate(request, env);
    if (auth.status !== 200) {
      return reply(auth.status === 503 ? '工作台访问控制尚未配置完成，请联系维护者。' : 'Access denied. 请先使用已授权邮箱登录。', auth.status);
    }
    if (isSession) return reply(request.method === 'HEAD' ? null : JSON.stringify({authorized:true}), 200, {'Content-Type':'application/json; charset=utf-8'});
    if (isLogin) {
      const hash = url.searchParams.get('module') === 'estimator' ? '#sales-estimator' : '#market-share';
      return reply(null, 303, {Location:'/' + hash});
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    for (const [key, value] of Object.entries(privateHeaders)) headers.set(key, value);
    return new Response(asset.body, {status:asset.status, statusText:asset.statusText, headers});
  }
};
