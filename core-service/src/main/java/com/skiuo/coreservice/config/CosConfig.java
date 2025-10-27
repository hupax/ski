package com.skiuo.coreservice.config;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSCredentials;
import com.qcloud.cos.region.Region;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "cos")
@Data
public class CosConfig {

    private String secretId;
    private String secretKey;
    private String region;
    private String bucketName;

    @Bean
    public COSClient cosClient() {
        // Create credentials
        COSCredentials credentials = new BasicCOSCredentials(secretId, secretKey);

        // Create client configuration with region
        Region cosRegion = new Region(region);
        ClientConfig clientConfig = new ClientConfig(cosRegion);

        // Set HTTPS protocol (recommended for production)
        clientConfig.setHttpProtocol(com.qcloud.cos.http.HttpProtocol.https);

        // Build COS client
        return new COSClient(credentials, clientConfig);
    }
}
