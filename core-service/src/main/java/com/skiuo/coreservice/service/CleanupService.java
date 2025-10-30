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
     * @param localPath Local file path (uploaded chunk)
     */
    public void cleanupAfterProcessing(Session session, VideoChunk chunk, String localPath) {
        try {
            // Always delete uploaded chunk file (already appended to master video)
            deleteLocalFile(localPath);

            // Check if session is finished
            boolean sessionFinished = session.getStatus() == Session.SessionStatus.COMPLETED ||
                                    session.getStatus() == Session.SessionStatus.FAILED;

            if (sessionFinished) {
                // Session ended: cleanup master video
                cleanupMasterVideo(session);
            }

            // Update chunk status
            if (chunk != null) {
                chunk.setStatus(VideoChunk.ChunkStatus.ANALYZED);
                chunk.setAnalyzedAt(LocalDateTime.now());
                videoChunkRepository.save(chunk);
            }

            log.info("Cleanup completed: sessionId={}, chunkId={}, sessionFinished={}, keepVideo={}",
                    session.getId(), chunk != null ? chunk.getId() : "null", sessionFinished, session.getKeepVideo());

        } catch (Exception e) {
            log.error("Cleanup failed: sessionId={}, error={}", session.getId(), e.getMessage());
            // Don't throw - cleanup failures shouldn't break the flow
        }
    }

    /**
     * Cleanup master video
     * Called when session ends
     *
     * @param session Session entity
     */
    public void cleanupMasterVideo(Session session) {
        try {
            if (session.getMasterVideoPath() != null) {
                // If keepVideo=true, upload master video to storage before deleting local copy
                if (session.getKeepVideo()) {
                    try {
                        StorageService storageService = storageServiceFactory.getStorageService(session.getStorageType());
                        String storagePath = "sessions/" + session.getId() + "/master_video_final.webm";
                        storageService.uploadFile(session.getMasterVideoPath(), storagePath);
                        log.info("Uploaded final master video to storage: {}", storagePath);
                    } catch (Exception e) {
                        log.error("Failed to upload master video to storage: {}", e.getMessage());
                    }
                }

                // Always delete local master video
                deleteLocalFile(session.getMasterVideoPath());
                log.info("Deleted local master video: {}", session.getMasterVideoPath());

                // Clear master video path in session
                session.setMasterVideoPath(null);
                sessionRepository.save(session);
            }
        } catch (Exception e) {
            log.error("Failed to cleanup master video for session {}: {}", session.getId(), e.getMessage());
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

}
