package com.skiuo.authservice.repository;

import com.skiuo.authservice.entity.OAuthConnection;
import com.skiuo.authservice.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * OAuth绑定Repository
 */
@Repository
public interface OAuthConnectionRepository extends JpaRepository<OAuthConnection, Long> {

    /**
     * 根据用户ID查找所有OAuth绑定
     */
    List<OAuthConnection> findByUserId(Long userId);

    /**
     * 根据用户ID和提供商查找OAuth绑定
     */
    Optional<OAuthConnection> findByUserIdAndProvider(Long userId, User.AuthProvider provider);

    /**
     * 根据提供商和第三方用户ID查找OAuth绑定
     */
    Optional<OAuthConnection> findByProviderAndProviderUserId(User.AuthProvider provider, String providerUserId);

    /**
     * 检查用户是否已绑定某个提供商
     */
    boolean existsByUserIdAndProvider(Long userId, User.AuthProvider provider);

    /**
     * 检查第三方用户是否已被其他用户绑定
     */
    boolean existsByProviderAndProviderUserId(User.AuthProvider provider, String providerUserId);

    /**
     * 删除用户的某个OAuth绑定
     */
    void deleteByUserIdAndProvider(Long userId, User.AuthProvider provider);
}
