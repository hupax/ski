package com.skiuo.authservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 用户实体
 * 实现 Spring Security 的 UserDetails 接口
 */
@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password", length = 255)
    private String password;  // BCrypt加密，OAuth用户可为null

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "provider", nullable = false, length = 20)
    @Convert(converter = AuthProviderConverter.class)
    private AuthProvider provider;

    @Column(name = "provider_id", length = 100)
    private String providerId;  // 第三方平台用户ID

    @Column(name = "email_verified", nullable = false)
    private Boolean emailVerified;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "locked", nullable = false)
    private Boolean locked;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    /**
     * 用户角色集合
     * 使用 @ElementCollection 存储角色枚举
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role")
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Set<UserRole> roles = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (emailVerified == null) {
            emailVerified = false;
        }
        if (enabled == null) {
            enabled = true;
        }
        if (locked == null) {
            locked = false;
        }
        if (provider == null) {
            provider = AuthProvider.EMAIL;
        }
        if (roles.isEmpty()) {
            roles.add(UserRole.ROLE_USER);
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ==================== UserDetails 接口实现 ====================

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return roles.stream()
                .map(role -> new SimpleGrantedAuthority(role.name()))
                .collect(Collectors.toList());
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;  // 返回实际的用户名字段
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !locked;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    // ==================== 认证提供商枚举 ====================

    public enum AuthProvider {
        @com.fasterxml.jackson.annotation.JsonProperty("email")
        EMAIL("email"),

        @com.fasterxml.jackson.annotation.JsonProperty("google")
        GOOGLE("google"),

        @com.fasterxml.jackson.annotation.JsonProperty("github")
        GITHUB("github"),

        @com.fasterxml.jackson.annotation.JsonProperty("wechat")
        WECHAT("wechat");

        private final String value;

        AuthProvider(String value) {
            this.value = value;
        }

        @Override
        public String toString() {
            return value;
        }
    }

    // ==================== 用户角色枚举 ====================

    public enum UserRole {
        ROLE_USER,   // 普通用户
        ROLE_VIP,    // VIP用户
        ROLE_ADMIN   // 管理员
    }
}
