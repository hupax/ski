package com.skiuo.coreservice.client;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@Slf4j
public class AuthServiceClient {

    @Value("${AUTH_SERVICE_URL:http://localhost:8081}")
    private String authServiceUrl;

    @Value("${INTERNAL_API_KEY}")
    private String internalApiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public UserInfo validateToken(String token) {
        String url = authServiceUrl + "/api/internal/users/validate-token";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.set("X-Internal-Api-Key", internalApiKey);

        HttpEntity<?> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<ApiResponse<UserInfo>> response = restTemplate.exchange(
                url, HttpMethod.GET, entity,
                new org.springframework.core.ParameterizedTypeReference<ApiResponse<UserInfo>>() {}
            );

            if (response.getBody() != null && response.getBody().getCode() == 200) {
                return response.getBody().getData();
            }

            return null;
        } catch (Exception e) {
            log.error("Token validation failed: {}", e.getMessage());
            return null;
        }
    }

    public UserInfo getUserById(Long userId) {
        String url = authServiceUrl + "/api/internal/users/" + userId;

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Internal-Api-Key", internalApiKey);

        HttpEntity<?> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<ApiResponse<UserInfo>> response = restTemplate.exchange(
                url, HttpMethod.GET, entity,
                new org.springframework.core.ParameterizedTypeReference<ApiResponse<UserInfo>>() {}
            );

            if (response.getBody() != null && response.getBody().getCode() == 200) {
                return response.getBody().getData();
            }

            return null;
        } catch (Exception e) {
            log.error("Get user failed: {}", e.getMessage());
            return null;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserInfo {
        private Long id;
        private String email;
        private String username;
        private String avatarUrl;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApiResponse<T> {
        private Integer code;
        private String message;
        private T data;
    }
}
