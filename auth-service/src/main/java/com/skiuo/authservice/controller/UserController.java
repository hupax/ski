package com.skiuo.authservice.controller;

import com.skiuo.authservice.dto.AuthResponse;
import com.skiuo.authservice.entity.User;
import com.skiuo.authservice.service.UserService;
import com.skiuo.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ApiResponse<AuthResponse.UserInfo> getCurrentUser(@AuthenticationPrincipal User user) {
        AuthResponse.UserInfo userInfo = AuthResponse.UserInfo.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .avatarUrl(user.getAvatarUrl())
                .build();
        return ApiResponse.success(userInfo);
    }
}
