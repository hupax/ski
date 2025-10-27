package com.skiuo.coreservice.service;

import com.skiuo.coreservice.config.MinioConfig;
import com.skiuo.coreservice.exception.StorageException;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class MinioService implements StorageService {

    private final MinioClient minioClient;
    private final MinioConfig minioConfig;

    /**
     * Ensure storage is ready (bucket exists, create if not)
     */
    @Override
    public void ensureStorageReady() {
        try {
            boolean exists = minioClient.bucketExists(
                    BucketExistsArgs.builder()
                            .bucket(minioConfig.getBucketName())
                            .build()
            );

            if (!exists) {
                minioClient.makeBucket(
                        MakeBucketArgs.builder()
                                .bucket(minioConfig.getBucketName())
                                .build()
                );
                log.info("Created MinIO bucket: {}", minioConfig.getBucketName());
            }
        } catch (Exception e) {
            log.error("Failed to ensure bucket exists: {}", e.getMessage());
            throw new StorageException("Failed to ensure bucket exists", e);
        }
    }

    /**
     * Upload file from local path to MinIO
     *
     * @param localFilePath Local file path
     * @param objectName    Object name in MinIO
     * @return MinIO object path
     */
    @Override
    public String uploadFile(String localFilePath, String objectName) {
        try {
            ensureStorageReady();

            Path path = Paths.get(localFilePath);
            long fileSize = Files.size(path);

            try (InputStream inputStream = Files.newInputStream(path)) {
                minioClient.putObject(
                        PutObjectArgs.builder()
                                .bucket(minioConfig.getBucketName())
                                .object(objectName)
                                .stream(inputStream, fileSize, -1)
                                .contentType("video/webm")
                                .build()
                );
            }

            log.info("Uploaded file to MinIO: {} -> {}", localFilePath, objectName);
            return objectName;

        } catch (Exception e) {
            log.error("Failed to upload file to MinIO: {}", e.getMessage());
            throw new StorageException("Failed to upload file to MinIO", e);
        }
    }

    /**
     * Generate public URL for object (for public bucket)
     *
     * @param objectName Object name
     * @return Public URL
     */
    @Override
    public String generatePublicUrl(String objectName) {
        try {
            // For public bucket, use direct URL without signature
            // Format: {endpoint}/{bucket}/{object}
            String url = String.format("%s/%s/%s",
                    minioConfig.getEndpoint(),
                    minioConfig.getBucketName(),
                    objectName);

            log.debug("Generated public URL for: {}", objectName);
            return url;

        } catch (Exception e) {
            log.error("Failed to generate public URL: {}", e.getMessage());
            throw new StorageException("Failed to generate public URL", e);
        }
    }

    /**
     * Delete object from MinIO
     *
     * @param objectName Object name
     */
    @Override
    public void deleteObject(String objectName) {
        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(minioConfig.getBucketName())
                            .object(objectName)
                            .build()
            );

            log.info("Deleted object from MinIO: {}", objectName);

        } catch (Exception e) {
            log.error("Failed to delete object from MinIO: {}", e.getMessage());
            throw new StorageException("Failed to delete object from MinIO", e);
        }
    }

    /**
     * Check if object exists
     *
     * @param objectName Object name
     * @return true if exists
     */
    public boolean objectExists(String objectName) {
        try {
            minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(minioConfig.getBucketName())
                            .object(objectName)
                            .build()
            );
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
