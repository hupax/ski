package com.skiuo.authservice.service;

import com.skiuo.authservice.dto.*;
import com.skiuo.authservice.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final JwtService jwtService;
    private final RedisService redisService;
    private final EmailService emailService;
    private final AuthenticationManager authenticationManager;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        User user = userService.createUser(
            request.getEmail(),
            request.getUsername(),
            request.getPassword()
        );

        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        userService.updateLastLogin(user.getId());

        return buildAuthResponse(user, accessToken, refreshToken);
    }

    public AuthResponse loginWithPassword(LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );

            User user = (User) authentication.getPrincipal();

            if (redisService.getLoginFailCount(request.getEmail()) >= 5) {
                throw new RuntimeException("Account locked due to too many failed attempts");
            }

            redisService.resetLoginFailCount(request.getEmail());

            String accessToken = jwtService.generateAccessToken(user);
            String refreshToken = jwtService.generateRefreshToken(user);

            userService.updateLastLogin(user.getId());

            return buildAuthResponse(user, accessToken, refreshToken);

        } catch (AuthenticationException e) {
            long failCount = redisService.incrementLoginFailCount(request.getEmail());
            log.warn("Login failed for {}, attempt: {}", request.getEmail(), failCount);
            throw new RuntimeException("Invalid email or password");
        }
    }

    public void sendVerificationCode(String email) {
        emailService.sendVerificationCode(email);
    }

    @Transactional
    public AuthResponse loginWithCode(CodeLoginRequest request) {
        String storedCode = redisService.getVerificationCode(request.getEmail());

        if (storedCode == null) {
            throw new RuntimeException("Verification code expired or invalid");
        }

        if (!storedCode.equals(request.getCode())) {
            throw new RuntimeException("Invalid verification code");
        }

        redisService.deleteVerificationCode(request.getEmail());

        // Find or create user
        User user = userService.findByEmail(request.getEmail())
                .orElseGet(() -> {
                    // Auto-register: generate username from email
                    String username = generateUsernameFromEmail(request.getEmail());
                    log.info("Auto-registering new user with email: {}", request.getEmail());
                    return userService.createUserWithoutPassword(request.getEmail(), username);
                });

        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        userService.updateLastLogin(user.getId());

        return buildAuthResponse(user, accessToken, refreshToken);
    }

    /**
     * Generate username from email
     * Example: user@example.com -> user
     * If username already exists, append random suffix
     */
    private String generateUsernameFromEmail(String email) {
        String baseUsername = email.split("@")[0];
        String username = baseUsername;

        // Check if username exists, if so append random number
        int suffix = 1;
        while (userService.findByUsername(username).isPresent()) {
            username = baseUsername + suffix;
            suffix++;
        }

        return username;
    }

    public void logout(String token) {
        jwtService.revokeToken(token);
    }

    public AuthResponse refreshToken(String refreshToken) {
        String email = jwtService.extractEmail(refreshToken);
        User user = userService.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String newAccessToken = jwtService.refreshAccessToken(refreshToken, user);

        return buildAuthResponse(user, newAccessToken, refreshToken);
    }

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(7200L)
                .userInfo(AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .username(user.getUsername())
                        .avatarUrl(user.getAvatarUrl())
                        .build())
                .build();
    }

    /**
     * 开发测试用：清除所有用户数据
     */
    @Transactional
    public void clearAllUsers() {
        userService.deleteAllUsers();
        // 清除 Redis 中所有的 refresh token 和黑名单
        redisService.clearAll();
        log.warn("All users and tokens have been deleted (development testing)");
    }
}
