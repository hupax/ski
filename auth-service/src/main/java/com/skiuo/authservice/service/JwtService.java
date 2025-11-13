package com.skiuo.authservice.service;

import com.skiuo.authservice.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * JWT服务
 * 负责Token的生成、验证、刷新
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class JwtService {

    private final RedisService redisService;

    @Value("${JWT_SECRET}")
    private String secretKey;

    @Value("${JWT_ACCESS_TOKEN_EXPIRATION:7200000}")  // 默认2小时
    private long accessTokenExpiration;

    @Value("${JWT_REFRESH_TOKEN_EXPIRATION:2592000000}")  // 默认30天
    private long refreshTokenExpiration;

    /**
     * 生成Access Token
     */
    public String generateAccessToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId());
        claims.put("email", user.getEmail());
        claims.put("username", user.getUsername());
        claims.put("avatarUrl", user.getAvatarUrl());
        claims.put("roles", user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList()));

        String tokenId = UUID.randomUUID().toString();
        claims.put("jti", tokenId);  // JWT ID，用于黑名单

        Date now = new Date();
        Date expiration = new Date(now.getTime() + accessTokenExpiration);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(user.getEmail())
                .setIssuedAt(now)
                .setExpiration(expiration)
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * 生成Refresh Token
     */
    public String generateRefreshToken(User user) {
        String tokenId = UUID.randomUUID().toString();

        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId());
        claims.put("email", user.getEmail());
        claims.put("jti", tokenId);
        claims.put("type", "refresh");

        Date now = new Date();
        Date expiration = new Date(now.getTime() + refreshTokenExpiration);

        // 保存到Redis
        redisService.saveRefreshToken(tokenId, user.getId(), user.getEmail());

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(user.getEmail())
                .setIssuedAt(now)
                .setExpiration(expiration)
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * 从Token中提取Claims
     */
    public Claims extractClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            log.warn("Token已过期: {}", e.getMessage());
            throw new RuntimeException("Token已过期");
        } catch (JwtException e) {
            log.error("Token解析失败: {}", e.getMessage());
            throw new RuntimeException("无效的Token");
        }
    }

    /**
     * 从Token中提取用户邮箱
     */
    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    /**
     * 从Token中提取用户ID
     */
    public Long extractUserId(String token) {
        Claims claims = extractClaims(token);
        Object userId = claims.get("userId");
        if (userId instanceof Integer) {
            return ((Integer) userId).longValue();
        }
        return (Long) userId;
    }

    /**
     * 从Token中提取Token ID（JWT ID）
     */
    public String extractTokenId(String token) {
        return extractClaims(token).get("jti", String.class);
    }

    /**
     * 验证Token是否有效
     */
    public boolean validateToken(String token, User user) {
        try {
            String email = extractEmail(token);
            String tokenId = extractTokenId(token);

            // 检查Token是否在黑名单中
            if (redisService.isBlacklisted(tokenId)) {
                log.warn("Token在黑名单中: tokenId={}", tokenId);
                return false;
            }

            // 检查邮箱是否匹配
            boolean emailMatches = email.equals(user.getEmail());

            // 检查Token是否过期
            boolean notExpired = !isTokenExpired(token);

            return emailMatches && notExpired;
        } catch (Exception e) {
            log.error("Token验证失败: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 检查Token是否过期
     */
    public boolean isTokenExpired(String token) {
        try {
            Date expiration = extractClaims(token).getExpiration();
            return expiration.before(new Date());
        } catch (ExpiredJwtException e) {
            return true;
        }
    }

    /**
     * 将Token加入黑名单（登出时调用）
     */
    public void revokeToken(String token) {
        try {
            String tokenId = extractTokenId(token);
            Claims claims = extractClaims(token);
            Date expiration = claims.getExpiration();
            long remainingTime = expiration.getTime() - System.currentTimeMillis();

            if (remainingTime > 0) {
                redisService.addToBlacklist(tokenId, remainingTime);
                log.info("Token已撤销: tokenId={}", tokenId);
            }
        } catch (Exception e) {
            log.error("撤销Token失败: {}", e.getMessage());
        }
    }

    /**
     * 刷新Access Token
     */
    public String refreshAccessToken(String refreshToken, User user) {
        try {
            Claims claims = extractClaims(refreshToken);
            String type = claims.get("type", String.class);

            if (!"refresh".equals(type)) {
                throw new RuntimeException("不是有效的Refresh Token");
            }

            String tokenId = claims.get("jti", String.class);

            // 检查Refresh Token是否在Redis中存在
            String stored = redisService.getRefreshToken(tokenId);
            if (stored == null) {
                throw new RuntimeException("Refresh Token已失效");
            }

            // 生成新的Access Token
            return generateAccessToken(user);
        } catch (Exception e) {
            log.error("刷新Token失败: {}", e.getMessage());
            throw new RuntimeException("刷新Token失败");
        }
    }

    /**
     * 删除Refresh Token
     */
    public void revokeRefreshToken(String refreshToken) {
        try {
            String tokenId = extractTokenId(refreshToken);
            redisService.deleteRefreshToken(tokenId);
            log.info("Refresh Token已删除: tokenId={}", tokenId);
        } catch (Exception e) {
            log.error("删除Refresh Token失败: {}", e.getMessage());
        }
    }

    /**
     * 获取签名密钥
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
