package com.skiuo.coreservice.service;

import com.skiuo.coreservice.config.VideoConfig;
import com.skiuo.coreservice.entity.Session;
import com.skiuo.coreservice.entity.VideoChunk;
import com.skiuo.coreservice.repository.SessionRepository;
import com.skiuo.coreservice.repository.VideoChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class CleanupService {

    private final VideoConfig videoConfig;
    private final StorageServiceFactory storageServiceFactory;
    private final SessionRepository sessionRepository;
    private final VideoChunkRepository videoChunkRepository;

    /**
     * Cleanup after video processing completes
     *
     * @param session   Session entity
     * @param chunk     Video chunk entity
     * @param localPath Local file path
     */
    public void cleanupAfterProcessing(Session session, VideoChunk chunk, String localPath) {
        try {
            // Always delete local temporary file
            deleteLocalFile(localPath);

            // Delete storage files if not keeping videos
            if (!session.getKeepVideo()) {
                deleteStorageFilesForChunk(session, chunk);
            }

            // Update chunk status
            chunk.setStatus(VideoChunk.ChunkStatus.DELETED);
            chunk.setAnalyzedAt(LocalDateTime.now());
            videoChunkRepository.save(chunk);

            log.info("Cleanup completed: sessionId={}, chunkId={}, keepVideo={}",
                    session.getId(), chunk.getId(), session.getKeepVideo());

        } catch (Exception e) {
            log.error("Cleanup failed: sessionId={}, error={}", session.getId(), e.getMessage());
            // Don't throw - cleanup failures shouldn't break the flow
        }
    }

    /**
     * Delete local file
     *
     * @param filePath File path
     */
    public void deleteLocalFile(String filePath) {
        try {
            Path path = Paths.get(filePath);
            if (Files.exists(path)) {
                Files.delete(path);
                log.info("Deleted local file: {}", filePath);
            }
        } catch (IOException e) {
            log.warn("Failed to delete local file: {}, error={}", filePath, e.getMessage());
        }
    }

    /**
     * Delete storage files for a chunk
     *
     * @param session Session entity
     * @param chunk Video chunk
     */
    private void deleteStorageFilesForChunk(Session session, VideoChunk chunk) {
        try {
            if (chunk.getMinioPath() != null && !chunk.getMinioPath().isEmpty()) {
                StorageService storageService = storageServiceFactory.getStorageService(session.getStorageType());
                storageService.deleteObject(chunk.getMinioPath());
            }
        } catch (Exception e) {
            log.warn("Failed to delete storage files for chunk {}: {}", chunk.getId(), e.getMessage());
        }
    }

    /**
     * Scheduled task: cleanup old temporary files
     * Runs every hour, deletes files older than 2 hours
     */
    @Scheduled(fixedRate = 3600000) // 1 hour
    public void cleanupOldTempFiles() {
        try {
            Path tempDir = Paths.get(videoConfig.getTempPath());
            if (!Files.exists(tempDir)) {
                return;
            }

            LocalDateTime twoHoursAgo = LocalDateTime.now().minusHours(2);

            Files.walk(tempDir)
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        try {
                            LocalDateTime fileTime = LocalDateTime.ofInstant(
                                    Files.getLastModifiedTime(path).toInstant(),
                                    java.time.ZoneId.systemDefault()
                            );
                            return fileTime.isBefore(twoHoursAgo);
                        } catch (IOException e) {
                            return false;
                        }
                    })
                    .forEach(path -> {
                        try {
                            Files.delete(path);
                            log.info("Cleaned up old temp file: {}", path);
                        } catch (IOException e) {
                            log.warn("Failed to delete old temp file: {}", path);
                        }
                    });

        } catch (Exception e) {
            log.error("Scheduled cleanup failed: {}", e.getMessage());
        }
    }

    /**
     * Scheduled task: cleanup orphaned storage files
     * Runs daily, deletes files without database records
     */
    @Scheduled(cron = "0 0 2 * * ?") // 2 AM daily
    public void cleanupOrphanedStorageFiles() {
        log.info("Starting orphaned storage files cleanup");

        try {
            // Find chunks marked as DELETED but still may have storage files
            List<VideoChunk> deletedChunks = videoChunkRepository.findByStatus(VideoChunk.ChunkStatus.DELETED);

            for (VideoChunk chunk : deletedChunks) {
                if (chunk.getMinioPath() != null && !chunk.getMinioPath().isEmpty()) {
                    try {
                        // Get session to determine storage type
                        Session session = sessionRepository.findById(chunk.getSessionId())
                                .orElse(null);

                        if (session != null) {
                            StorageService storageService = storageServiceFactory.getStorageService(session.getStorageType());
                            storageService.deleteObject(chunk.getMinioPath());
                            log.info("Deleted orphaned storage file: {}", chunk.getMinioPath());
                        } else {
                            log.warn("Session not found for chunk {}, skipping cleanup", chunk.getId());
                        }
                    } catch (Exception e) {
                        log.warn("Failed to delete orphaned storage file {}: {}", chunk.getMinioPath(), e.getMessage());
                    }
                }
            }

            log.info("Orphaned storage files cleanup completed");

        } catch (Exception e) {
            log.error("Orphaned files cleanup failed: {}", e.getMessage());
        }
    }
}
