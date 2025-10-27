package com.skiuo.coreservice.config;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.ClientBuilderConfiguration;
import com.aliyun.oss.common.auth.CredentialsProvider;
import com.aliyun.oss.common.auth.DefaultCredentialProvider;
import com.aliyun.oss.common.comm.SignVersion;
import lombok.Data;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "oss")
@Data
public class OssConfig {

    private String endpoint;
    private String accessKeyId;
    private String accessKeySecret;
    private String bucketName;
    private String region;

    @Bean
    public OSS ossClient() {
        // Configure client with V4 signature version (required for presigned URLs)
        ClientBuilderConfiguration clientBuilderConfiguration = new ClientBuilderConfiguration();
        clientBuilderConfiguration.setSignatureVersion(SignVersion.V4);

        // Create credentials provider
        CredentialsProvider credentialsProvider = new DefaultCredentialProvider(accessKeyId, accessKeySecret);

        // Ensure endpoint uses HTTPS (required for V4 signature)
        String httpsEndpoint = endpoint;
        if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
            httpsEndpoint = "https://" + endpoint;
        } else if (endpoint.startsWith("http://")) {
            httpsEndpoint = endpoint.replace("http://", "https://");
        }

        // Build OSS client with region and signature version
        return OSSClientBuilder.create()
                .endpoint(httpsEndpoint)
                .credentialsProvider(credentialsProvider)
                .clientConfiguration(clientBuilderConfiguration)
                .region(region)
                .build();
    }
}
