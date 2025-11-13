package com.skiuo.authservice.repository;

import com.skiuo.authservice.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 密码重置令牌Repository
 */
@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /**
     * 根据令牌查找
     */
    Optional<PasswordResetToken> findByToken(String token);

    /**
     * 删除用户的所有重置令牌
     */
    void deleteByUserId(Long userId);

    /**
     * 删除过期的令牌（定时任务清理）
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < ?1")
    void deleteExpiredTokens(LocalDateTime now);
}
