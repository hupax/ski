# Redis Docker 配置

## 启动 Redis

使用 Docker 运行 Redis 容器:

```bash
docker run -d \
  --name skiuo-redis \
  -p 6379:6379 \
  redis:7-alpine
```

## 带密码启动 Redis (可选)

如果需要设置密码:

```bash
docker run -d \
  --name skiuo-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --requirepass your_password
```

然后在 `.env` 中配置密码:

```env
REDIS_PASSWORD=your_password
```

## 验证 Redis 连接

```bash
# 无密码连接
docker exec -it skiuo-redis redis-cli ping

# 有密码连接
docker exec -it skiuo-redis redis-cli -a your_password ping

# 应该返回: PONG
```

## 停止和删除 Redis 容器

```bash
# 停止容器
docker stop skiuo-redis

# 删除容器
docker rm skiuo-redis
```

## 持久化数据 (可选)

如果需要持久化 Redis 数据:

```bash
docker run -d \
  --name skiuo-redis \
  -p 6379:6379 \
  -v skiuo-redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes
```

## Redis 在项目中的用途

- **验证码存储**: 邮箱验证码，过期时间 5 分钟
- **Token 黑名单**: 用户登出后的 token 黑名单
- **限流控制**: 防止验证码频繁发送（1 分钟冷却）
- **Session 管理**: 用户会话信息缓存

## 查看 Redis 数据

```bash
# 进入 Redis CLI
docker exec -it skiuo-redis redis-cli

# 查看所有 key
KEYS *

# 查看某个 key 的值
GET verification:code:user@example.com

# 查看 key 的过期时间（秒）
TTL verification:code:user@example.com
```
