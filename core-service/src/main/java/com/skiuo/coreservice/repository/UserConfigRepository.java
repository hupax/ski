package com.skiuo.coreservice.repository;

import com.skiuo.coreservice.entity.UserConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserConfigRepository extends JpaRepository<UserConfig, Long> {
}
