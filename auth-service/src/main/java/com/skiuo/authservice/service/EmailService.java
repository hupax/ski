package com.skiuo.authservice.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final RedisService redisService;

    @Value("${MAIL_FROM:noreply@skiuo.com}")
    private String fromEmail;

    @Value("${MAIL_ENABLED:true}")
    private boolean mailEnabled;

    public EmailService(RedisService redisService, @Autowired(required = false) JavaMailSender mailSender) {
        this.redisService = redisService;
        this.mailSender = mailSender;
    }

    public void sendVerificationCode(String toEmail) {
        if (redisService.isVerificationCodeInCooldown(toEmail)) {
            throw new IllegalStateException("Please wait 1 minute before requesting another code");
        }

        String code = generateCode();
        redisService.saveVerificationCode(toEmail, code);
        redisService.setVerificationCodeCooldown(toEmail);

        if (!mailEnabled || mailSender == null) {
            log.warn("=".repeat(60));
            log.warn("Mail is DISABLED. Verification code for {}: {}", toEmail, code);
            log.warn("=".repeat(60));
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("SKI Verification Code");
            message.setText("Your verification code is: " + code + "\n\nThis code will expire in 5 minutes.");

            mailSender.send(message);
            log.info("Verification code sent to: {}", toEmail);
        } catch (Exception e) {
            // Don't throw exception, just log and print code to console
            log.error("Failed to send email to {}: {}", toEmail, e.getMessage());
            log.warn("=".repeat(60));
            log.warn("Email failed. Verification code for {}: {}", toEmail, code);
            log.warn("=".repeat(60));
            // Still successful - code is saved in Redis
        }
    }

    private String generateCode() {
        return String.format("%06d", new Random().nextInt(1000000));
    }
}
