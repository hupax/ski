# 登录流程说明

## 概述

系统实现了 **邮箱验证码登录/注册** 功能，用户无需填写用户名和密码，只需验证邮箱即可。

## 登录流程

### 1. 前端界面

**登录方式选择页面**：
- Continue with Google（UI完成，后端待实现）
- Continue with GitHub（UI完成，后端待实现）
- Continue with WeChat（UI完成，后端待实现）
- Continue with verification code（已实现）
- Email address 输入框 + Continue 按钮

### 2. 邮箱验证码登录流程

```
1. 用户输入邮箱
2. 点击 "Send code"
3. 后端生成 6 位数字验证码
4. 发送邮件（或打印到控制台）
5. 用户输入验证码
6. 后端验证验证码
7. 检查邮箱是否已注册：
   - 已注册：直接登录
   - 未注册：自动创建账号并登录
8. 返回 JWT Token
```

### 3. 自动注册逻辑

**用户名生成规则**：
- 从邮箱中提取用户名部分（@之前）
- 例如：`user@example.com` → `user`
- 如果用户名已存在，自动添加数字后缀
- 例如：`user` → `user1` → `user2`

**用户信息**：
```java
User {
  email: "user@example.com",      // 用户输入的邮箱
  username: "user",                // 自动生成
  password: null,                  // 验证码登录无密码
  provider: EMAIL,                 // 登录方式
  emailVerified: true,             // 验证码验证过
  enabled: true,
  locked: false,
  roles: [ROLE_USER]
}
```

## OAuth 登录流程（待实现）

### 预留接口

前端已经实现了 OAuth 登录按钮，后端需要实现以下功能：

#### 1. Google OAuth

```java
@GetMapping("/oauth/google")
public void googleLogin() {
    // 重定向到 Google OAuth 授权页面
}

@GetMapping("/oauth/google/callback")
public ResponseEntity<?> googleCallback(@RequestParam String code) {
    // 1. 用 code 换取 access_token
    // 2. 用 access_token 获取用户信息
    // 3. 检查邮箱是否已注册
    // 4. 未注册：自动创建账号（用户名从 Google 获取）
    // 5. 生成 JWT Token 返回
}
```

#### 2. GitHub OAuth

```java
@GetMapping("/oauth/github")
public void githubLogin() {
    // 重定向到 GitHub OAuth 授权页面
}

@GetMapping("/oauth/github/callback")
public ResponseEntity<?> githubCallback(@RequestParam String code) {
    // 1. 用 code 换取 access_token
    // 2. 用 access_token 获取用户信息
    // 3. 检查邮箱是否已注册
    // 4. 未注册：自动创建账号（用户名从 GitHub 获取）
    // 5. 生成 JWT Token 返回
}
```

#### 3. WeChat OAuth

```java
@GetMapping("/oauth/wechat")
public void wechatLogin() {
    // 重定向到微信开放平台授权页面
}

@GetMapping("/oauth/wechat/callback")
public ResponseEntity<?> wechatCallback(@RequestParam String code) {
    // 1. 用 code 换取 access_token
    // 2. 用 access_token 获取用户信息
    // 3. 检查 openid 是否已绑定
    // 4. 未绑定：自动创建账号（用户名从微信昵称获取）
    // 5. 生成 JWT Token 返回
}
```

### OAuth 用户创建

```java
// UserService.java 已实现
public User createOrUpdateOAuthUser(String email, String username, User.AuthProvider provider) {
    // 1. 检查邮箱是否已存在
    // 2. 已存在：更新最后登录时间
    // 3. 不存在：创建新用户
    //    - email: 从 OAuth 获取
    //    - username: 从 OAuth 获取（或生成）
    //    - password: null（OAuth 用户无密码）
    //    - provider: GOOGLE/GITHUB/WECHAT
    //    - emailVerified: true
}
```

## 数据库表

### users 表

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255),              -- 可为 NULL（验证码/OAuth用户）
    provider VARCHAR(50) NOT NULL,      -- EMAIL/GOOGLE/GITHUB/WECHAT
    provider_id VARCHAR(255),           -- OAuth 用户的第三方 ID
    avatar_url VARCHAR(500),
    email_verified BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    locked BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### oauth_connections 表（预留）

```sql
CREATE TABLE oauth_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    provider VARCHAR(50) NOT NULL,      -- GOOGLE/GITHUB/WECHAT
    provider_id VARCHAR(255) NOT NULL,  -- 第三方用户 ID
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id)
);
```

## API 端点

### 邮箱验证码登录

**1. 发送验证码**
```
POST /api/auth/code/send
Content-Type: application/json

{
  "email": "user@example.com"
}

Response:
{
  "code": 200,
  "message": "操作成功",
  "data": "Verification code sent"
}
```

**2. 验证码登录**
```
POST /api/auth/login/code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}

Response:
{
  "code": 200,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "tokenType": "Bearer",
    "expiresIn": 7200000,
    "userInfo": {
      "id": 1,
      "email": "user@example.com",
      "username": "user",
      "avatarUrl": null
    }
  }
}
```

## 测试说明

### 1. 测试邮箱验证码登录

```bash
# 1. 发送验证码
curl -X POST http://localhost:8081/api/auth/code/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 2. 查看 auth-service 控制台获取验证码
# 输出类似：验证码: 123456

# 3. 使用验证码登录
curl -X POST http://localhost:8081/api/auth/login/code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'
```

### 2. 验证自动注册

第一次使用新邮箱登录时，系统会自动创建账号：

```sql
-- 登录前：users 表中没有该邮箱
SELECT * FROM users WHERE email = 'newuser@example.com';
-- 结果：0 rows

-- 使用验证码登录
-- ...

-- 登录后：自动创建了账号
SELECT * FROM users WHERE email = 'newuser@example.com';
-- 结果：
-- id | email                | username | password | provider | email_verified
-- 1  | newuser@example.com | newuser  | NULL     | EMAIL    | true
```

### 3. 验证用户名冲突处理

```sql
-- 已存在用户 test@a.com -> username: test
-- 新用户 test@b.com 登录 -> username: test1
-- 新用户 test@c.com 登录 -> username: test2
```

## 前端集成

### 1. 登录组件

```tsx
// EmailLoginForm.tsx
const handleLogin = async () => {
  // 1. 发送验证码
  await authClient.sendVerificationCode(email)

  // 2. 用户输入验证码
  // ...

  // 3. 提交验证码登录
  const response = await authClient.loginWithCode({ email, code })

  // 4. 保存 token 到 LocalStorage
  setAuth(response.accessToken, response.refreshToken, response.userInfo)

  // 5. 登录成功
}
```

### 2. Token 自动携带

```ts
// apiClient.ts
const token = useAuthStore.getState().accessToken
if (!token) {
  throw new Error('Not authenticated')
}

fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## 安全性

### 1. 验证码

- 6 位数字随机生成
- 5 分钟有效期
- 存储在 Redis
- 验证后立即删除
- 60 秒冷却时间（防止频繁发送）

### 2. JWT Token

- Access Token: 2 小时有效期
- Refresh Token: 30 天有效期
- 登出后加入黑名单（存储在 Redis）

### 3. 密码安全

- 验证码登录/OAuth 用户：password 字段为 NULL
- 密码登录用户：使用 BCrypt 加密（strength 12）

## 注意事项

1. **邮件配置**：
   - 如果 `MAIL_ENABLED=false`，验证码会打印在控制台
   - 生产环境务必配置真实的 SMTP 服务

2. **默认账号**：
   - `admin@skiuo.com` 是通过 SQL 初始化创建的
   - 有密码但无法用验证码登录
   - 建议测试时使用新邮箱

3. **用户名唯一性**：
   - 系统自动处理用户名冲突
   - 使用数字后缀确保唯一

4. **OAuth 集成**：
   - 前端 UI 已完成
   - 后端接口待实现
   - 数据库表已准备好
