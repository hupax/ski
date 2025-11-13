package com.skiuo.authservice.controller;

import com.skiuo.authservice.dto.*;
import com.skiuo.authservice.service.AuthService;
import com.skiuo.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/login/email")
    public ApiResponse<AuthResponse> loginWithPassword(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.loginWithPassword(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/code/send")
    public ApiResponse<String> sendCode(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        authService.sendVerificationCode(email);
        return ApiResponse.success("Verification code sent");
    }

    @PostMapping("/login/code")
    public ApiResponse<AuthResponse> loginWithCode(@Valid @RequestBody CodeLoginRequest request) {
        AuthResponse response = authService.loginWithCode(request);
        return ApiResponse.success(response);
    }

    @PostMapping("/logout")
    public ApiResponse<String> logout(@RequestHeader("Authorization") String authorization) {
        String token = authorization.replace("Bearer ", "");
        authService.logout(token);
        return ApiResponse.success("Logged out successfully");
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");
        AuthResponse response = authService.refreshToken(refreshToken);
        return ApiResponse.success(response);
    }

    /**
     * 开发测试用：删除所有用户数据
     * 生产环境应该移除此接口或添加严格的权限控制
     */
    @PostMapping("/dev/clear-all-users")
    public ApiResponse<String> clearAllUsers() {
        authService.clearAllUsers();
        return ApiResponse.success("All users cleared");
    }
}
