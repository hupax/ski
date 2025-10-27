package com.skiuo.coreservice.config;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@Slf4j
public class GrpcConfig {

    @Value("${grpc.ai-service.host:localhost}")
    private String aiServiceHost;

    @Value("${grpc.ai-service.port:50051}")
    private int aiServicePort;

    @Value("${grpc.ai-service.max-inbound-message-size:104857600}")
    private int maxInboundMessageSize;

    @Bean
    public ManagedChannel aiServiceChannel() {
        log.info("Creating gRPC channel to ai-service: {}:{}", aiServiceHost, aiServicePort);

        return ManagedChannelBuilder
                .forAddress(aiServiceHost, aiServicePort)
                .usePlaintext()
                .maxInboundMessageSize(maxInboundMessageSize)
                .keepAliveTime(30, TimeUnit.SECONDS)
                .keepAliveTimeout(10, TimeUnit.SECONDS)
                .build();
    }
}
