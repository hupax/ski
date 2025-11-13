package com.skiuo.authservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Redis服务
 * 封装Redis操作
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RedisService {

    private final RedisTemplate<String, Object> redisTemplate;

    // ==================== 验证码相关 ====================

    /**
     * 保存验证码（5分钟过期）
     */
    public void saveVerificationCode(String email, String code) {
        String key = "email:code:" + email;
        set(key, code, Duration.ofMinutes(5));
        log.debug("保存验证码: email={}, code={}", email, code);
    }

    /**
     * 获取验证码
     */
    public String getVerificationCode(String email) {
        String key = "email:code:" + email;
        Object value = get(key);
        return value != null ? value.toString() : null;
    }

    /**
     * 删除验证码
     */
    public void deleteVerificationCode(String email) {
        String key = "email:code:" + email;
        delete(key);
    }

    /**
     * 检查验证码是否在冷却期（1分钟内不能重复发送）
     */
    public boolean isVerificationCodeInCooldown(String email) {
        String key = "email:code:cooldown:" + email;
        return hasKey(key);
    }

    /**
     * 设置验证码冷却期（1分钟）
     */
    public void setVerificationCodeCooldown(String email) {
        String key = "email:code:cooldown:" + email;
        set(key, "1", Duration.ofMinutes(1));
    }

    // ==================== JWT黑名单 ====================

    /**
     * 将Token加入黑名单（直到Token过期）
     */
    public void addToBlacklist(String tokenId, long expirationMillis) {
        String key = "jwt:blacklist:" + tokenId;
        set(key, "1", Duration.ofMillis(expirationMillis));
        log.debug("Token已加入黑名单: tokenId={}", tokenId);
    }

    /**
     * 检查Token是否在黑名单中
     */
    public boolean isBlacklisted(String tokenId) {
        String key = "jwt:blacklist:" + tokenId;
        return hasKey(key);
    }

    // ==================== 登录失败计数 ====================

    /**
     * 增加登录失败次数
     */
    public long incrementLoginFailCount(String email) {
        String key = "login:fail:" + email;
        Long count = redisTemplate.opsForValue().increment(key);
        // 设置15分钟过期
        redisTemplate.expire(key, 15, TimeUnit.MINUTES);
        return count != null ? count : 0;
    }

    /**
     * 获取登录失败次数
     */
    public long getLoginFailCount(String email) {
        String key = "login:fail:" + email;
        Object value = get(key);
        return value != null ? Long.parseLong(value.toString()) : 0;
    }

    /**
     * 重置登录失败次数
     */
    public void resetLoginFailCount(String email) {
        String key = "login:fail:" + email;
        delete(key);
    }

    // ==================== OAuth State ====================

    /**
     * 保存OAuth状态（5分钟过期）
     */
    public void saveOAuthState(String state, String provider, String redirectUrl) {
        String key = "oauth:state:" + state;
        String value = provider + "|" + redirectUrl;
        set(key, value, Duration.ofMinutes(5));
    }

    /**
     * 获取并删除OAuth状态（一次性使用）
     */
    public String getAndDeleteOAuthState(String state) {
        String key = "oauth:state:" + state;
        Object value = get(key);
        if (value != null) {
            delete(key);
            return value.toString();
        }
        return null;
    }

    // ==================== Refresh Token ====================

    /**
     * 保存Refresh Token（30天过期）
     */
    public void saveRefreshToken(String tokenId, Long userId, String email) {
        String key = "refresh:token:" + tokenId;
        String value = userId + "|" + email;
        set(key, value, Duration.ofDays(30));
    }

    /**
     * 获取Refresh Token信息
     */
    public String getRefreshToken(String tokenId) {
        String key = "refresh:token:" + tokenId;
        Object value = get(key);
        return value != null ? value.toString() : null;
    }

    /**
     * 删除Refresh Token
     */
    public void deleteRefreshToken(String tokenId) {
        String key = "refresh:token:" + tokenId;
        delete(key);
    }

    // ==================== 通用Redis操作 ====================

    /**
     * 设置键值对
     */
    public void set(String key, Object value, Duration timeout) {
        redisTemplate.opsForValue().set(key, value, timeout);
    }

    /**
     * 获取值
     */
    public Object get(String key) {
        return redisTemplate.opsForValue().get(key);
    }

    /**
     * 删除键
     */
    public void delete(String key) {
        redisTemplate.delete(key);
    }

    /**
     * 检查键是否存在
     */
    public boolean hasKey(String key) {
        Boolean exists = redisTemplate.hasKey(key);
        return exists != null && exists;
    }

    /**
     * 设置过期时间
     */
    public void expire(String key, Duration timeout) {
        redisTemplate.expire(key, timeout);
    }

    /**
     * 清除所有数据（开发测试用）
     */
    public void clearAll() {
        // 清除所有 refresh token
        var refreshTokenKeys = redisTemplate.keys("refresh:token:*");
        if (refreshTokenKeys != null && !refreshTokenKeys.isEmpty()) {
            redisTemplate.delete(refreshTokenKeys);
        }

        // 清除所有黑名单
        var blacklistKeys = redisTemplate.keys("jwt:blacklist:*");
        if (blacklistKeys != null && !blacklistKeys.isEmpty()) {
            redisTemplate.delete(blacklistKeys);
        }

        // 清除所有验证码
        var codeKeys = redisTemplate.keys("email:code:*");
        if (codeKeys != null && !codeKeys.isEmpty()) {
            redisTemplate.delete(codeKeys);
        }

        // 清除所有登录失败计数
        var failKeys = redisTemplate.keys("login:fail:*");
        if (failKeys != null && !failKeys.isEmpty()) {
            redisTemplate.delete(failKeys);
        }

        // 清除所有 OAuth state
        var oauthKeys = redisTemplate.keys("oauth:state:*");
        if (oauthKeys != null && !oauthKeys.isEmpty()) {
            redisTemplate.delete(oauthKeys);
        }

        log.warn("All Redis data cleared (development testing)");
    }
}
