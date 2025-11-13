package com.skiuo.authservice.controller;

import com.skiuo.authservice.dto.AuthResponse;
import com.skiuo.authservice.entity.User;
import com.skiuo.authservice.service.JwtService;
import com.skiuo.authservice.service.UserService;
import com.skiuo.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/internal/users")
@RequiredArgsConstructor
public class InternalUserController {

    private final UserService userService;
    private final JwtService jwtService;

    @Value("${INTERNAL_API_KEY:}")
    private String internalApiKey;

    @GetMapping("/validate-token")
    public ApiResponse<AuthResponse.UserInfo> validateToken(
            @RequestHeader("Authorization") String authorization,
            @RequestHeader("X-Internal-Api-Key") String apiKey) {

        if (!internalApiKey.equals(apiKey)) {
            return ApiResponse.forbidden("Invalid API key");
        }

        try {
            String token = authorization.replace("Bearer ", "");
            String email = jwtService.extractEmail(token);

            User user = userService.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if (!jwtService.validateToken(token, user)) {
                return ApiResponse.unauthorized("Invalid token");
            }

            AuthResponse.UserInfo userInfo = AuthResponse.UserInfo.builder()
                    .id(user.getId())
                    .email(user.getEmail())
                    .username(user.getUsername())
                    .avatarUrl(user.getAvatarUrl())
                    .build();

            return ApiResponse.success(userInfo);
        } catch (Exception e) {
            return ApiResponse.unauthorized("Token validation failed");
        }
    }

    @GetMapping("/{id}")
    public ApiResponse<AuthResponse.UserInfo> getUserById(
            @PathVariable Long id,
            @RequestHeader("X-Internal-Api-Key") String apiKey) {

        if (!internalApiKey.equals(apiKey)) {
            return ApiResponse.forbidden("Invalid API key");
        }

        User user = userService.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        AuthResponse.UserInfo userInfo = AuthResponse.UserInfo.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .avatarUrl(user.getAvatarUrl())
                .build();

        return ApiResponse.success(userInfo);
    }
}
