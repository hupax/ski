package com.skiuo.coreservice.config;

import io.github.cdimascio.dotenv.Dotenv;
import io.github.cdimascio.dotenv.DotenvException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration class to load environment variables from .env file
 * This class loads .env from project root and makes variables available to Spring
 */
@Configuration
public class DotenvConfig {

    private static final Logger logger = LoggerFactory.getLogger(DotenvConfig.class);

    @PostConstruct
    public void loadDotenv() {
        try {
            // Load .env file from project root directory (parent of core-service)
            Dotenv dotenv = Dotenv.configure()
                    .directory("/Users/hupax/ski")  // Look for .env in parent directory (project root)
                    .ignoreIfMissing() // Don't fail if .env doesn't exist
                    .load();

            // Set all .env variables as system properties so Spring can access them
            dotenv.entries().forEach(entry -> {
                String key = entry.getKey();
                String value = entry.getValue();

                // Only set if not already defined in system properties
                if (System.getProperty(key) == null) {
                    System.setProperty(key, value);
                }
            });

            logger.info("✓ Loaded .env file successfully");
            logger.debug("Loaded {} environment variables from .env", dotenv.entries().size());

        } catch (DotenvException e) {
            logger.warn("⚠ .env file not found or couldn't be loaded: {}", e.getMessage());
            logger.info("Using system environment variables and application.yml defaults");
        } catch (Exception e) {
            logger.error("Error loading .env file: {}", e.getMessage(), e);
        }
    }
}
