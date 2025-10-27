package com.skiuo.coreservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "video")
@Data
public class VideoConfig {

    private String tempPath = "/Users/hupax/ski/temp";
    private Integer windowSize = 30;
    private Integer windowStep = 20;
}
