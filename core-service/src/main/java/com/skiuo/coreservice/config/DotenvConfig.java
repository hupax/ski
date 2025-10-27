package com.skiuo.coreservice.config;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;

public class DotenvConfig implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        try {
            Dotenv dotenv = Dotenv.configure()
                    .directory("/Users/hupax/ski")
                    .ignoreIfMissing()
                    .load();

            Map<String, Object> envMap = new HashMap<>();
            dotenv.entries().forEach(entry -> envMap.put(entry.getKey(), entry.getValue()));

            environment.getPropertySources().addFirst(new MapPropertySource("dotenvProperties", envMap));

            System.out.println("✓ Loaded " + envMap.size() + " variables from .env");

        } catch (Exception e) {
            System.err.println("⚠ Error loading .env: " + e.getMessage());
        }
    }
}
