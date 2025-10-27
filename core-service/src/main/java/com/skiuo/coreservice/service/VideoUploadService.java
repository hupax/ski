package com.skiuo.coreservice.service;

import com.skiuo.coreservice.config.VideoConfig;
import com.skiuo.coreservice.entity.Session;
import com.skiuo.coreservice.entity.VideoChunk;
import com.skiuo.coreservice.exception.StorageException;
import com.skiuo.coreservice.repository.SessionRepository;
import com.skiuo.coreservice.repository.VideoChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;

@Service
@Slf4j
@RequiredArgsConstructor
public class VideoUploadService {

    private final VideoConfig videoConfig;
    private final SessionRepository sessionRepository;
    private final VideoChunkRepository videoChunkRepository;

    /**
     * Save uploaded video to temporary directory
     *
     * @param sessionId  Session ID
     * @param chunkIndex Chunk index
     * @param file       Uploaded file
     * @return Local file path
     */
    public String saveTemporaryFile(Long sessionId, Integer chunkIndex, MultipartFile file) {
        try {
            // Ensure temp directory exists
            Path tempDir = Paths.get(videoConfig.getTempPath());
            if (!Files.exists(tempDir)) {
                Files.createDirectories(tempDir);
                log.info("Created temp directory: {}", tempDir);
            }

            // Create session-specific subdirectory
            Path sessionDir = tempDir.resolve(sessionId.toString());
            if (!Files.exists(sessionDir)) {
                Files.createDirectories(sessionDir);
            }

            // Generate filename
            String timestamp = String.valueOf(System.currentTimeMillis());
            String filename = String.format("chunk_%d_%s.webm", chunkIndex, timestamp);
            Path filePath = sessionDir.resolve(filename);

            // Save file
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            log.info("Saved temporary file: sessionId={}, chunkIndex={}, path={}",
                    sessionId, chunkIndex, filePath);

            return filePath.toString();

        } catch (IOException e) {
            log.error("Failed to save temporary file: {}", e.getMessage());
            throw new StorageException("Failed to save temporary file", e);
        }
    }

    /**
     * Create or update session
     */
    @Transactional
    public Session createOrUpdateSession(Long sessionId, Long userId, String aiModel,
                                          Session.AnalysisMode analysisMode, Boolean keepVideo, String storageType) {
        Session session;

        if (sessionId != null) {
            session = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));
        } else {
            session = Session.builder()
                    .userId(userId)
                    .aiModel(aiModel)
                    .analysisMode(analysisMode)
                    .keepVideo(keepVideo)
                    .storageType(storageType)
                    .status(Session.SessionStatus.RECORDING)
                    .startTime(LocalDateTime.now())
                    .build();
            session = sessionRepository.save(session);
            log.info("Created new session: id={}, userId={}, storageType={}", session.getId(), userId, storageType);
        }

        return session;
    }

    /**
     * Create video chunk record
     */
    @Transactional
    public VideoChunk createVideoChunk(Long sessionId, Integer chunkIndex, String minioPath, Integer duration) {
        VideoChunk chunk = VideoChunk.builder()
                .sessionId(sessionId)
                .chunkIndex(chunkIndex)
                .minioPath(minioPath)
                .duration(duration)
                .status(VideoChunk.ChunkStatus.UPLOADED)
                .build();

        chunk = videoChunkRepository.save(chunk);
        log.info("Created video chunk: sessionId={}, chunkIndex={}, id={}",
                sessionId, chunkIndex, chunk.getId());

        return chunk;
    }

    /**
     * Update session status
     */
    @Transactional
    public void updateSessionStatus(Long sessionId, Session.SessionStatus status) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        session.setStatus(status);

        if (status == Session.SessionStatus.COMPLETED || status == Session.SessionStatus.FAILED) {
            session.setEndTime(LocalDateTime.now());
        }

        sessionRepository.save(session);
        log.info("Updated session status: sessionId={}, status={}", sessionId, status);
    }
}
