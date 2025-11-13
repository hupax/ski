package com.skiuo.coreservice.repository;

import com.skiuo.coreservice.entity.UserMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserMemoryRepository extends JpaRepository<UserMemory, Long> {

    /**
     * Find user memory by user ID
     *
     * @param userId User ID
     * @return Optional UserMemory
     */
    Optional<UserMemory> findByUserId(Long userId);

    /**
     * Delete user memory by user ID
     *
     * @param userId User ID
     */
    void deleteByUserId(Long userId);

    /**
     * Check if user memory exists for user ID
     *
     * @param userId User ID
     * @return true if exists
     */
    boolean existsByUserId(Long userId);
}
