package com.skiuo.coreservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Factory for dynamically selecting storage service based on type
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class StorageServiceFactory {

    private final MinioService minioService;
    private final OssService ossService;
    private final CosService cosService;

    /**
     * Get storage service by type
     *
     * @param storageType Storage type: "minio", "oss", or "cos"
     * @return Corresponding StorageService implementation
     * @throws IllegalArgumentException if storageType is invalid
     */
    public StorageService getStorageService(String storageType) {
        if (storageType == null || storageType.isEmpty()) {
            log.warn("Storage type is null or empty, defaulting to COS");
            storageType = "cos";
        }

        switch (storageType.toLowerCase()) {
            case "minio":
                log.debug("Using MinIO storage service");
                return minioService;
            case "oss":
                log.debug("Using Alibaba Cloud OSS storage service");
                return ossService;
            case "cos":
                log.debug("Using Tencent Cloud COS storage service");
                return cosService;
            default:
                log.error("Invalid storage type: {}. Valid types are: minio, oss, cos", storageType);
                throw new IllegalArgumentException("Invalid storage type: " + storageType);
        }
    }
}
