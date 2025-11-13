package com.skiuo.authservice.repository;

import com.skiuo.authservice.entity.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 邮箱验证令牌Repository
 */
@Repository
public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    /**
     * 根据令牌查找
     */
    Optional<EmailVerificationToken> findByToken(String token);

    /**
     * 根据用户ID查找未验证的令牌
     */
    Optional<EmailVerificationToken> findByUserIdAndVerifiedFalse(Long userId);

    /**
     * 删除用户的所有令牌
     */
    void deleteByUserId(Long userId);

    /**
     * 删除过期的令牌（定时任务清理）
     */
    @Modifying
    @Query("DELETE FROM EmailVerificationToken t WHERE t.expiresAt < ?1")
    void deleteExpiredTokens(LocalDateTime now);
}
