package com.skiuo.coreservice.service;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.exception.CosClientException;
import com.qcloud.cos.exception.CosServiceException;
import com.qcloud.cos.http.HttpMethodName;
import com.qcloud.cos.model.PutObjectRequest;
import com.qcloud.cos.model.GeneratePresignedUrlRequest;
import com.skiuo.coreservice.config.CosConfig;
import com.skiuo.coreservice.exception.StorageException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.net.URL;
import java.util.Date;

@Service
@Slf4j
@RequiredArgsConstructor
public class CosService implements StorageService {

    private final COSClient cosClient;
    private final CosConfig cosConfig;

    @Override
    public void ensureStorageReady() {
        try {
            if (!cosClient.doesBucketExist(cosConfig.getBucketName())) {
                throw new StorageException("COS bucket does not exist: " + cosConfig.getBucketName());
            }
            log.info("COS bucket verified: {}", cosConfig.getBucketName());
        } catch (CosServiceException e) {
            log.error("Failed to verify COS bucket: {}", e.getMessage());
            throw new StorageException("Failed to verify COS bucket", e);
        } catch (CosClientException e) {
            log.error("Failed to connect to COS: {}", e.getMessage());
            throw new StorageException("Failed to connect to COS", e);
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
                    cosConfig.getBucketName(),
                    objectName,
                    file
            );

            // Upload file
            cosClient.putObject(putObjectRequest);

            log.info("Uploaded file to COS: {} -> {}", localFilePath, objectName);
            return objectName;

        } catch (CosServiceException e) {
            log.error("Failed to upload file to COS: {}", e.getMessage());
            throw new StorageException("Failed to upload file to COS", e);
        } catch (CosClientException e) {
            log.error("Failed to connect to COS during upload: {}", e.getMessage());
            throw new StorageException("Failed to connect to COS during upload", e);
        } catch (Exception e) {
            log.error("Unexpected error during COS upload: {}", e.getMessage());
            throw new StorageException("Unexpected error during COS upload", e);
        }
    }

    @Override
    public String generatePublicUrl(String objectName) {
        try {
            // Generate presigned URL valid for 1 hour (same as MinIO/OSS)
            Date expiration = new Date(System.currentTimeMillis() + 3600 * 1000L);

            // Create presigned URL request
            GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(
                    cosConfig.getBucketName(),
                    objectName,
                    HttpMethodName.GET
            );
            request.setExpiration(expiration);

            // Generate presigned URL
            URL url = cosClient.generatePresignedUrl(request);

            log.debug("Generated presigned URL for: {} (expires in 1 hour)", objectName);
            return url.toString();

        } catch (CosClientException e) {
            log.error("Failed to generate presigned URL: {}", e.getMessage());
            throw new StorageException("Failed to generate presigned URL", e);
        }
    }

    @Override
    public void deleteObject(String objectName) {
        try {
            cosClient.deleteObject(cosConfig.getBucketName(), objectName);
            log.info("Deleted object from COS: {}", objectName);

        } catch (CosServiceException e) {
            log.error("Failed to delete object from COS: {}", e.getMessage());
            throw new StorageException("Failed to delete object from COS", e);
        } catch (CosClientException e) {
            log.error("Failed to connect to COS during deletion: {}", e.getMessage());
            throw new StorageException("Failed to connect to COS during deletion", e);
        }
    }
}
