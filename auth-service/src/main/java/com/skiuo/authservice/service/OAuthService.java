package com.skiuo.authservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skiuo.authservice.dto.AuthResponse;
import com.skiuo.authservice.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
@Slf4j
@RequiredArgsConstructor
public class OAuthService {

    private final UserService userService;
    private final JwtService jwtService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${OAUTH2_GOOGLE_CLIENT_ID}")
    private String googleClientId;

    @Value("${OAUTH2_GOOGLE_CLIENT_SECRET}")
    private String googleClientSecret;

    @Value("${OAUTH2_GOOGLE_REDIRECT_URI}")
    private String googleRedirectUri;

    @Value("${OAUTH2_GITHUB_CLIENT_ID}")
    private String githubClientId;

    @Value("${OAUTH2_GITHUB_CLIENT_SECRET}")
    private String githubClientSecret;

    @Value("${OAUTH2_GITHUB_REDIRECT_URI}")
    private String githubRedirectUri;

    @Value("${OAUTH2_WECHAT_APP_ID}")
    private String wechatAppId;

    @Value("${OAUTH2_WECHAT_APP_SECRET}")
    private String wechatAppSecret;

    @Value("${OAUTH2_WECHAT_REDIRECT_URI}")
    private String wechatRedirectUri;

    /**
     * Generate Google OAuth authorization URL
     */
    public String getGoogleAuthUrl() {
        String scope = URLEncoder.encode("profile email", StandardCharsets.UTF_8);
        return "https://accounts.google.com/o/oauth2/v2/auth?" +
                "client_id=" + googleClientId +
                "&redirect_uri=" + URLEncoder.encode(googleRedirectUri, StandardCharsets.UTF_8) +
                "&response_type=code" +
                "&scope=" + scope +
                "&access_type=offline" +
                "&prompt=consent";
    }

    /**
     * Handle Google OAuth callback
     */
    public AuthResponse handleGoogleCallback(String code) {
        try {
            // Exchange code for access token
            String tokenUrl = "https://oauth2.googleapis.com/token";
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("code", code);
            params.add("client_id", googleClientId);
            params.add("client_secret", googleClientSecret);
            params.add("redirect_uri", googleRedirectUri);
            params.add("grant_type", "authorization_code");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(tokenUrl, request, String.class);
            JsonNode tokenResponse = objectMapper.readTree(response.getBody());
            String accessToken = tokenResponse.get("access_token").asText();

            // Get user info
            String userInfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
            HttpHeaders userInfoHeaders = new HttpHeaders();
            userInfoHeaders.setBearerAuth(accessToken);
            HttpEntity<?> userInfoRequest = new HttpEntity<>(userInfoHeaders);

            ResponseEntity<String> userInfoResponse = restTemplate.exchange(
                    userInfoUrl, HttpMethod.GET, userInfoRequest, String.class);
            JsonNode userInfo = objectMapper.readTree(userInfoResponse.getBody());

            String email = userInfo.get("email").asText();
            String name = userInfo.has("name") ? userInfo.get("name").asText() : email.split("@")[0];
            String avatarUrl = userInfo.has("picture") ? userInfo.get("picture").asText() : null;
            String providerId = userInfo.get("id").asText();

            // Create or update user
            User user = userService.createOrUpdateOAuthUser(email, name, User.AuthProvider.GOOGLE, providerId, avatarUrl);

            // Generate JWT tokens
            String jwtAccessToken = jwtService.generateAccessToken(user);
            String refreshToken = jwtService.generateRefreshToken(user);

            userService.updateLastLogin(user.getId());

            return buildAuthResponse(user, jwtAccessToken, refreshToken);

        } catch (Exception e) {
            log.error("Google OAuth failed: {}", e.getMessage(), e);
            throw new RuntimeException("Google authentication failed: " + e.getMessage());
        }
    }

    /**
     * Generate GitHub OAuth authorization URL
     */
    public String getGithubAuthUrl() {
        String scope = URLEncoder.encode("read:user user:email", StandardCharsets.UTF_8);
        return "https://github.com/login/oauth/authorize?" +
                "client_id=" + githubClientId +
                "&redirect_uri=" + URLEncoder.encode(githubRedirectUri, StandardCharsets.UTF_8) +
                "&scope=" + scope;
    }

    /**
     * Handle GitHub OAuth callback
     */
    public AuthResponse handleGithubCallback(String code) {
        try {
            // Exchange code for access token
            String tokenUrl = "https://github.com/login/oauth/access_token";
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("code", code);
            params.add("client_id", githubClientId);
            params.add("client_secret", githubClientSecret);
            params.add("redirect_uri", githubRedirectUri);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setAccept(java.util.Collections.singletonList(MediaType.APPLICATION_JSON));
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(tokenUrl, request, String.class);
            JsonNode tokenResponse = objectMapper.readTree(response.getBody());
            String accessToken = tokenResponse.get("access_token").asText();

            // Get user info
            String userInfoUrl = "https://api.github.com/user";
            HttpHeaders userInfoHeaders = new HttpHeaders();
            userInfoHeaders.setBearerAuth(accessToken);
            userInfoHeaders.set("Accept", "application/vnd.github.v3+json");
            HttpEntity<?> userInfoRequest = new HttpEntity<>(userInfoHeaders);

            ResponseEntity<String> userInfoResponse = restTemplate.exchange(
                    userInfoUrl, HttpMethod.GET, userInfoRequest, String.class);
            JsonNode userInfo = objectMapper.readTree(userInfoResponse.getBody());

            String email = userInfo.has("email") && !userInfo.get("email").isNull()
                    ? userInfo.get("email").asText()
                    : null;

            // If email is null, fetch from emails endpoint
            if (email == null) {
                String emailsUrl = "https://api.github.com/user/emails";
                ResponseEntity<String> emailsResponse = restTemplate.exchange(
                        emailsUrl, HttpMethod.GET, userInfoRequest, String.class);
                JsonNode emails = objectMapper.readTree(emailsResponse.getBody());

                for (JsonNode emailNode : emails) {
                    if (emailNode.get("primary").asBoolean() && emailNode.get("verified").asBoolean()) {
                        email = emailNode.get("email").asText();
                        break;
                    }
                }
            }

            if (email == null) {
                throw new RuntimeException("Cannot get verified email from GitHub");
            }

            String username = userInfo.has("login") ? userInfo.get("login").asText() : email.split("@")[0];
            String avatarUrl = userInfo.has("avatar_url") ? userInfo.get("avatar_url").asText() : null;
            String providerId = userInfo.get("id").asText();

            // Create or update user
            User user = userService.createOrUpdateOAuthUser(email, username, User.AuthProvider.GITHUB, providerId, avatarUrl);

            // Generate JWT tokens
            String jwtAccessToken = jwtService.generateAccessToken(user);
            String refreshToken = jwtService.generateRefreshToken(user);

            userService.updateLastLogin(user.getId());

            return buildAuthResponse(user, jwtAccessToken, refreshToken);

        } catch (Exception e) {
            log.error("GitHub OAuth failed: {}", e.getMessage(), e);
            throw new RuntimeException("GitHub authentication failed: " + e.getMessage());
        }
    }

    /**
     * Generate WeChat OAuth authorization URL
     */
    public String getWechatAuthUrl() {
        return "https://open.weixin.qq.com/connect/qrconnect?" +
                "appid=" + wechatAppId +
                "&redirect_uri=" + URLEncoder.encode(wechatRedirectUri, StandardCharsets.UTF_8) +
                "&response_type=code" +
                "&scope=snsapi_login" +
                "&state=STATE#wechat_redirect";
    }

    /**
     * Handle WeChat OAuth callback
     */
    public AuthResponse handleWechatCallback(String code) {
        try {
            // Exchange code for access token
            String tokenUrl = "https://api.weixin.qq.com/sns/oauth2/access_token?" +
                    "appid=" + wechatAppId +
                    "&secret=" + wechatAppSecret +
                    "&code=" + code +
                    "&grant_type=authorization_code";

            ResponseEntity<String> response = restTemplate.getForEntity(tokenUrl, String.class);
            JsonNode tokenResponse = objectMapper.readTree(response.getBody());

            if (tokenResponse.has("errcode")) {
                throw new RuntimeException("WeChat API error: " + tokenResponse.get("errmsg").asText());
            }

            String accessToken = tokenResponse.get("access_token").asText();
            String openid = tokenResponse.get("openid").asText();

            // Get user info
            String userInfoUrl = "https://api.weixin.qq.com/sns/userinfo?" +
                    "access_token=" + accessToken +
                    "&openid=" + openid +
                    "&lang=zh_CN";

            ResponseEntity<String> userInfoResponse = restTemplate.getForEntity(userInfoUrl, String.class);
            JsonNode userInfo = objectMapper.readTree(userInfoResponse.getBody());

            if (userInfo.has("errcode")) {
                throw new RuntimeException("WeChat API error: " + userInfo.get("errmsg").asText());
            }

            String nickname = userInfo.get("nickname").asText();
            String avatarUrl = userInfo.has("headimgurl") ? userInfo.get("headimgurl").asText() : null;

            // WeChat doesn't provide email, use openid as email placeholder
            String email = "wechat_" + openid + "@wechat.placeholder";
            String username = nickname;

            // Create or update user
            User user = userService.createOrUpdateOAuthUser(email, username, User.AuthProvider.WECHAT, openid, avatarUrl);

            // Generate JWT tokens
            String jwtAccessToken = jwtService.generateAccessToken(user);
            String refreshToken = jwtService.generateRefreshToken(user);

            userService.updateLastLogin(user.getId());

            return buildAuthResponse(user, jwtAccessToken, refreshToken);

        } catch (Exception e) {
            log.error("WeChat OAuth failed: {}", e.getMessage(), e);
            throw new RuntimeException("WeChat authentication failed: " + e.getMessage());
        }
    }

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(7200L)
                .userInfo(AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .username(user.getUsername())
                        .avatarUrl(user.getAvatarUrl())
                        .build())
                .build();
    }
}
