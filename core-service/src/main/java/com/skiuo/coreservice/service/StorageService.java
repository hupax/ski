package com.skiuo.coreservice.service;

/**
 * Storage service interface for abstracting different storage backends (MinIO, OSS, etc.)
 */
public interface StorageService {

    /**
     * Upload file to storage
     *
     * @param localFilePath Local file path
     * @param objectName    Object name/key in storage
     * @return Object path/key
     */
    String uploadFile(String localFilePath, String objectName);

    /**
     * Generate public URL for accessing the object
     *
     * @param objectName Object name/key
     * @return Public access URL
     */
    String generatePublicUrl(String objectName);

    /**
     * Delete object from storage
     *
     * @param objectName Object name/key
     */
    void deleteObject(String objectName);

    /**
     * Ensure storage is ready (bucket exists, etc.)
     */
    void ensureStorageReady();
}
