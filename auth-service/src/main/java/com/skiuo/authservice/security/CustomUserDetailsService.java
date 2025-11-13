package com.skiuo.authservice.security;

import com.skiuo.authservice.entity.User;
import com.skiuo.authservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * 自定义UserDetailsService
 * Spring Security用于加载用户信息
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        log.debug("加载用户: email={}", email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在: " + email));

        log.debug("用户加载成功: id={}, email={}, roles={}",
                user.getId(), user.getEmail(), user.getRoles());

        return user;  // User实体已实现UserDetails接口
    }

    /**
     * 根据用户ID加载用户
     */
    public UserDetails loadUserById(Long userId) {
        log.debug("根据ID加载用户: userId={}", userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在: ID=" + userId));

        return user;
    }
}
