package com.skiuo.authservice.controller;

import com.skiuo.authservice.dto.AuthResponse;
import com.skiuo.authservice.service.OAuthService;
import com.skiuo.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

/**
 * OAuth authentication controller
 * Handles Google, GitHub, and WeChat OAuth flows
 */
@RestController
@RequestMapping("/api/auth/oauth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class OAuthController {

    private final OAuthService oAuthService;

    /**
     * Initiate Google OAuth login
     * Redirects user to Google authorization page
     */
    @GetMapping("/google")
    public RedirectView googleLogin() {
        String authUrl = oAuthService.getGoogleAuthUrl();
        log.info("Redirecting to Google OAuth: {}", authUrl);
        return new RedirectView(authUrl);
    }

    /**
     * Google OAuth callback
     * Exchanges authorization code for user info and creates/logs in user
     */
    @GetMapping("/google/callback")
    public RedirectView googleCallback(@RequestParam String code, @RequestParam(required = false) String error) {
        if (error != null) {
            log.error("Google OAuth error: {}", error);
            return new RedirectView("http://localhost:5173?error=" + error);
        }

        try {
            AuthResponse response = oAuthService.handleGoogleCallback(code);
            log.info("Google OAuth success for user: {}", response.getUserInfo().getEmail());

            // Redirect to frontend with tokens (root path, not /oauth/callback)
            String redirectUrl = String.format("http://localhost:5173?access_token=%s&refresh_token=%s",
                    response.getAccessToken(), response.getRefreshToken());
            return new RedirectView(redirectUrl);
        } catch (Exception e) {
            log.error("Google OAuth callback failed: {}", e.getMessage(), e);
            return new RedirectView("http://localhost:5173?error=google_auth_failed");
        }
    }

    /**
     * Initiate GitHub OAuth login
     * Redirects user to GitHub authorization page
     */
    @GetMapping("/github")
    public RedirectView githubLogin() {
        String authUrl = oAuthService.getGithubAuthUrl();
        log.info("Redirecting to GitHub OAuth: {}", authUrl);
        return new RedirectView(authUrl);
    }

    /**
     * GitHub OAuth callback
     * Exchanges authorization code for user info and creates/logs in user
     */
    @GetMapping("/github/callback")
    public RedirectView githubCallback(@RequestParam String code, @RequestParam(required = false) String error) {
        if (error != null) {
            log.error("GitHub OAuth error: {}", error);
            return new RedirectView("http://localhost:5173?error=" + error);
        }

        try {
            AuthResponse response = oAuthService.handleGithubCallback(code);
            log.info("GitHub OAuth success for user: {}", response.getUserInfo().getEmail());

            // Redirect to frontend with tokens (root path, not /oauth/callback)
            String redirectUrl = String.format("http://localhost:5173?access_token=%s&refresh_token=%s",
                    response.getAccessToken(), response.getRefreshToken());
            return new RedirectView(redirectUrl);
        } catch (Exception e) {
            log.error("GitHub OAuth callback failed: {}", e.getMessage(), e);
            return new RedirectView("http://localhost:5173?error=github_auth_failed");
        }
    }

    /**
     * Initiate WeChat OAuth login
     * Redirects user to WeChat authorization page
     */
    @GetMapping("/wechat")
    public RedirectView wechatLogin() {
        String authUrl = oAuthService.getWechatAuthUrl();
        log.info("Redirecting to WeChat OAuth: {}", authUrl);
        return new RedirectView(authUrl);
    }

    /**
     * WeChat OAuth callback
     * Exchanges authorization code for user info and creates/logs in user
     */
    @GetMapping("/wechat/callback")
    public RedirectView wechatCallback(@RequestParam String code, @RequestParam(required = false) String error) {
        if (error != null) {
            log.error("WeChat OAuth error: {}", error);
            return new RedirectView("http://localhost:5173?error=" + error);
        }

        try {
            AuthResponse response = oAuthService.handleWechatCallback(code);
            log.info("WeChat OAuth success for user: {}", response.getUserInfo().getUsername());

            // Redirect to frontend with tokens (root path, not /oauth/callback)
            String redirectUrl = String.format("http://localhost:5173?access_token=%s&refresh_token=%s",
                    response.getAccessToken(), response.getRefreshToken());
            return new RedirectView(redirectUrl);
        } catch (Exception e) {
            log.error("WeChat OAuth callback failed: {}", e.getMessage(), e);
            return new RedirectView("http://localhost:5173?error=wechat_auth_failed");
        }
    }
}
