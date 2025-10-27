package com.skiuo.coreservice.service;

import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.aliyun.oss.model.PutObjectRequest;
import com.skiuo.coreservice.config.OssConfig;
import com.skiuo.coreservice.exception.StorageException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.File;
import java.net.URL;
import java.util.Date;

@Service
@Slf4j
@RequiredArgsConstructor
public class OssService implements StorageService {

    private final OSS ossClient;
    private final OssConfig ossConfig;

    @Override
    public void ensureStorageReady() {
        try {
            if (!ossClient.doesBucketExist(ossConfig.getBucketName())) {
                throw new StorageException("OSS bucket does not exist: " + ossConfig.getBucketName());
            }
            log.info("OSS bucket verified: {}", ossConfig.getBucketName());
        } catch (OSSException e) {
            log.error("Failed to verify OSS bucket: {}", e.getMessage());
            throw new StorageException("Failed to verify OSS bucket", e);
        }
    }

    @Override
    public String uploadFile(String localFilePath, String objectName) {
        try {
            ensureStorageReady();

            File file = new File(localFilePath);
            if (!file.exists()) {
                throw new StorageException("File not found: " + localFilePath);
            }

            // Create put request
            PutObjectRequest putObjectRequest = new PutObjectRequest(
                    ossConfig.getBucketName(),
                    objectName,
                    file
            );

            // Upload file (no need to set object ACL, will use presigned URL)
            ossClient.putObject(putObjectRequest);

            log.info("Uploaded file to OSS: {} -> {}", localFilePath, objectName);
            return objectName;

        } catch (OSSException e) {
            log.error("Failed to upload file to OSS: {}", e.getMessage());
            throw new StorageException("Failed to upload file to OSS", e);
        } catch (Exception e) {
            log.error("Unexpected error during OSS upload: {}", e.getMessage());
            throw new StorageException("Unexpected error during OSS upload", e);
        }
    }

    @Override
    public String generatePublicUrl(String objectName) {
        try {
            // Generate presigned URL valid for 1 hour (same as MinIO presigned URLs)
            Date expiration = new Date(new Date().getTime() + 3600 * 1000L);

            // Create request object (required for proper V4 signature)
            GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(
                    ossConfig.getBucketName(),
                    objectName,
                    HttpMethod.GET
            );
            request.setExpiration(expiration);

            // Generate presigned URL
            URL url = ossClient.generatePresignedUrl(request);

            log.debug("Generated presigned URL for: {} (expires in 1 hour)", objectName);
            return url.toString();

        } catch (Exception e) {
            log.error("Failed to generate presigned URL: {}", e.getMessage());
            throw new StorageException("Failed to generate presigned URL", e);
        }
    }

    @Override
    public void deleteObject(String objectName) {
        try {
            ossClient.deleteObject(ossConfig.getBucketName(), objectName);
            log.info("Deleted object from OSS: {}", objectName);

        } catch (OSSException e) {
            log.error("Failed to delete object from OSS: {}", e.getMessage());
            throw new StorageException("Failed to delete object from OSS", e);
        }
    }
}
