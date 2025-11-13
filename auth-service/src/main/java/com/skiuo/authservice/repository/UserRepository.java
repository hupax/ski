package com.skiuo.authservice.repository;

import com.skiuo.authservice.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 用户Repository
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * 根据邮箱查找用户
     */
    Optional<User> findByEmail(String email);

    /**
     * 根据用户名查找用户
     */
    Optional<User> findByUsername(String username);

    /**
     * 根据邮箱或用户名查找用户
     */
    Optional<User> findByEmailOrUsername(String email, String username);

    /**
     * 根据第三方登录提供商和第三方用户ID查找用户
     */
    Optional<User> findByProviderAndProviderId(User.AuthProvider provider, String providerId);

    /**
     * 检查邮箱是否已存在
     */
    boolean existsByEmail(String email);

    /**
     * 检查用户名是否已存在
     */
    boolean existsByUsername(String username);

    /**
     * 检查第三方用户是否已绑定
     */
    boolean existsByProviderAndProviderId(User.AuthProvider provider, String providerId);
}
