package com.skiuo.authservice.service;

import com.skiuo.authservice.entity.User;
import com.skiuo.authservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean existsByUsername(String username) {
        return userRepository.existsByUsername(username);
    }

    @Transactional
    public User createUser(String email, String username, String password) {
        if (existsByEmail(email)) {
            throw new IllegalArgumentException("Email already exists");
        }
        if (existsByUsername(username)) {
            throw new IllegalArgumentException("Username already exists");
        }

        User user = User.builder()
                .email(email)
                .username(username)
                .password(passwordEncoder.encode(password))
                .provider(User.AuthProvider.EMAIL)
                .emailVerified(false)
                .enabled(true)
                .locked(false)
                .build();

        user.getRoles().add(User.UserRole.ROLE_USER);
        return userRepository.save(user);
    }

    /**
     * Create user without password (for verification code login and OAuth)
     * Username is auto-generated from email or OAuth profile
     */
    @Transactional
    public User createUserWithoutPassword(String email, String username) {
        if (existsByEmail(email)) {
            throw new IllegalArgumentException("Email already exists");
        }

        User user = User.builder()
                .email(email)
                .username(username)
                .password(null) // No password for code login users
                .provider(User.AuthProvider.EMAIL)
                .emailVerified(true) // Email is verified by code
                .enabled(true)
                .locked(false)
                .build();

        user.getRoles().add(User.UserRole.ROLE_USER);

        User savedUser = userRepository.save(user);
        log.info("Created new user without password: {} ({})", username, email);
        return savedUser;
    }

    /**
     * Create or update OAuth user
     * For third-party logins (Google, GitHub, WeChat)
     */
    @Transactional
    public User createOrUpdateOAuthUser(String email, String username, User.AuthProvider provider, String providerId, String avatarUrl) {
        // First check by provider and providerId
        Optional<User> existingUser = userRepository.findByProviderAndProviderId(provider, providerId);

        if (existingUser.isPresent()) {
            User user = existingUser.get();
            // Update avatar if changed
            if (avatarUrl != null && !avatarUrl.equals(user.getAvatarUrl())) {
                user.setAvatarUrl(avatarUrl);
            }
            user.setLastLoginAt(LocalDateTime.now());
            return userRepository.save(user);
        }

        // Check by email (user might have registered with email before)
        existingUser = findByEmail(email);
        if (existingUser.isPresent()) {
            User user = existingUser.get();
            // Link OAuth provider to existing account
            user.setProvider(provider);
            user.setProviderId(providerId);
            if (avatarUrl != null) {
                user.setAvatarUrl(avatarUrl);
            }
            user.setLastLoginAt(LocalDateTime.now());
            return userRepository.save(user);
        }

        // Generate unique username if conflict
        String finalUsername = username;
        int suffix = 1;
        while (existsByUsername(finalUsername)) {
            finalUsername = username + suffix;
            suffix++;
        }

        // Create new OAuth user
        User user = User.builder()
                .email(email)
                .username(finalUsername)
                .password(null) // No password for OAuth users
                .provider(provider)
                .providerId(providerId)
                .avatarUrl(avatarUrl)
                .emailVerified(true) // OAuth providers verify email
                .enabled(true)
                .locked(false)
                .build();

        user.getRoles().add(User.UserRole.ROLE_USER);

        User savedUser = userRepository.save(user);
        log.info("Created new OAuth user: {} ({}) via {}", finalUsername, email, provider);
        return savedUser;
    }

    @Transactional
    public void updateLastLogin(Long userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);
        });
    }

    /**
     * 开发测试用：删除所有用户
     */
    @Transactional
    public void deleteAllUsers() {
        userRepository.deleteAll();
        log.warn("Deleted all users from database");
    }
}
