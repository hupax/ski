package com.skiuo.coreservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "video")
@Data
public class VideoConfig {

    private String tempPath = "/tmp/skiuo";
    private Integer windowSize = 15;
    private Integer windowStep = 10;
}
