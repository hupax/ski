package com.skiuo.coreservice.service;

import com.skiuo.coreservice.config.VideoConfig;
import com.skiuo.coreservice.entity.AnalysisRecord;
import com.skiuo.coreservice.entity.Session;
import com.skiuo.coreservice.entity.VideoChunk;
import com.skiuo.coreservice.exception.VideoProcessingException;
import com.skiuo.coreservice.repository.VideoChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
@RequiredArgsConstructor
public class VideoProcessingService {

    private final VideoConfig videoConfig;
    private final GrpcClientService grpcClientService;
    private final StorageServiceFactory storageServiceFactory;
    private final AnalysisService analysisService;
    private final CleanupService cleanupService;
    private final VideoUploadService videoUploadService;
    private final VideoChunkRepository videoChunkRepository;

    /**
     * Process video chunk asynchronously
     *
     * @param session   Session entity
     * @param chunk     Video chunk entity
     * @param localPath Local file path
     */
    @Async("videoTaskExecutor")
    public CompletableFuture<Void> processVideoChunk(Session session, VideoChunk chunk, String localPath) {
        try {
            log.info("Starting video processing: sessionId={}, chunkId={}, mode={}",
                    session.getId(), chunk.getId(), session.getAnalysisMode());

            // Update session status to ANALYZING
            videoUploadService.updateSessionStatus(session.getId(), Session.SessionStatus.ANALYZING);

            if (session.getAnalysisMode() == Session.AnalysisMode.FULL) {
                // Full analysis mode
                processFullAnalysisMode(session, chunk, localPath);
            } else {
                // Sliding window mode
                processSlidingWindowMode(session, chunk, localPath);
            }

            log.info("Video processing completed: sessionId={}, chunkId={}",
                    session.getId(), chunk.getId());

            // Cleanup
            cleanupService.cleanupAfterProcessing(session, chunk, localPath);

            return CompletableFuture.completedFuture(null);

        } catch (Exception e) {
            log.error("Video processing failed: sessionId={}, chunkId={}, error={}",
                    session.getId(), chunk.getId(), e.getMessage());
            videoUploadService.updateSessionStatus(session.getId(), Session.SessionStatus.FAILED);
            throw new VideoProcessingException("Video processing failed", e);
        }
    }

    /**
     * Full analysis mode: upload original video and analyze once
     */
    private void processFullAnalysisMode(Session session, VideoChunk chunk, String localPath) {
        log.info("Processing in FULL mode: sessionId={}", session.getId());

        // Get storage service based on session's storage type
        StorageService storageService = storageServiceFactory.getStorageService(session.getStorageType());

        // Step 1: Upload original video to storage
        String minioPath = buildMinioPath(session.getId(), chunk.getChunkIndex(), "full");
        storageService.uploadFile(localPath, minioPath);
        log.info("Uploaded original video to storage: {}", minioPath);

        // Step 2: Generate public URL
        String videoUrl = storageService.generatePublicUrl(minioPath);

        // Step 3: Analyze video
        int startOffset = calculateAccumulatedDuration(session, chunk);
        int endOffset = startOffset + (chunk.getDuration() != null ? chunk.getDuration() : 30);

        String result = grpcClientService.analyzeVideoSync(
                session.getId().toString(),
                0, // window index 0 for full analysis
                videoUrl,
                session.getAiModel(),
                "", // no context for full analysis
                startOffset,
                endOffset,
                content -> {
                    // Stream result to WebSocket
                    analysisService.sendStreamingResult(session.getId(), 0, content);
                }
        );

        // Step 4: Save analysis result
        analysisService.saveAnalysisRecord(session.getId(), chunk.getId(), 0, result, startOffset, endOffset, minioPath);

        log.info("Full analysis completed: sessionId={}, result length={}",
                session.getId(), result.length());
    }

    /**
     * Sliding window mode: slice video and analyze each window with context
     */
    private void processSlidingWindowMode(Session session, VideoChunk chunk, String localPath) {
        log.info("Processing in SLIDING_WINDOW mode: sessionId={}", session.getId());

        // Get storage service based on session's storage type
        StorageService storageService = storageServiceFactory.getStorageService(session.getStorageType());

        // Calculate base time offset BEFORE any tail processing
        int baseOffset = calculateAccumulatedDuration(session, chunk);

        // Step 0: Check if we need to concatenate with previous chunk's tail
        String videoToProcess = localPath;
        boolean hasTailConcat = false;

        if (session.getLastChunkTailPath() != null && chunk.getChunkIndex() > 0) {
            log.info("Found previous chunk tail, concatenating: path={}, duration={}s",
                    session.getLastChunkTailPath(), session.getLastChunkTailDuration());

            try {
                // Download tail from storage to local
                String tailLocalPath = videoConfig.getTempPath() + "/" + session.getId() +
                        "/tail_" + (chunk.getChunkIndex() - 1) + ".webm";
                downloadFromStorage(session.getLastChunkTailPath(), tailLocalPath, storageService);

                // Concatenate: tail + current_chunk
                String concatPath = videoConfig.getTempPath() + "/" + session.getId() +
                        "/concat_" + chunk.getChunkIndex() + ".webm";
                videoToProcess = grpcClientService.concatVideos(
                        List.of(tailLocalPath, localPath),
                        concatPath
                );

                // Adjust baseOffset (subtract tail duration since it overlaps with previous chunk)
                baseOffset -= session.getLastChunkTailDuration();
                hasTailConcat = true;

                log.info("Concatenated tail + chunk: output={}, adjusted baseOffset={}s",
                        videoToProcess, baseOffset);

                // Cleanup local tail file
                cleanupService.deleteLocalFile(tailLocalPath);
            } catch (Exception e) {
                log.error("Failed to concatenate with tail, proceeding without it: {}", e.getMessage());
                videoToProcess = localPath; // Fallback to original
                baseOffset = calculateAccumulatedDuration(session, chunk); // Reset offset
            }
        }

        // Step 1: Call ProcessVideo to slice video
        List<String> windowPaths = grpcClientService.processVideo(
                session.getId().toString(),
                chunk.getId(),
                videoToProcess,
                "sliding_window",
                videoConfig.getWindowSize(),
                videoConfig.getWindowStep()
        );

        log.info("Video sliced into {} windows", windowPaths.size());

        // Step 2: Get context from last window and calculate global window index
        String previousContext = "";
        int globalWindowStartIndex = (int) analysisService.countAnalyzedWindows(session.getId());

        // Get context from the last analyzed window
        if (globalWindowStartIndex > 0) {
            AnalysisRecord lastRecord = analysisService.getLastAnalysisRecord(session.getId());
            if (lastRecord != null && lastRecord.getContent() != null) {
                previousContext = summarizeForContext(lastRecord.getContent());
                log.info("Retrieved context from previous window: windowIndex={}, contextLength={}",
                        lastRecord.getWindowIndex(), previousContext.length());
            }
        }

        // Note: baseOffset was already calculated and adjusted for tail concatenation above (line 124-149)
        log.info("Using base time offset for chunk {}: {} seconds", chunk.getChunkIndex(), baseOffset);

        // Step 3: Upload each window to storage and analyze
        for (int i = 0; i < windowPaths.size(); i++) {
            String windowPath = windowPaths.get(i);
            int globalWindowIndex = globalWindowStartIndex + i;

            // Upload window to storage
            String minioPath = buildMinioPath(session.getId(), chunk.getChunkIndex(), "window_" + i);
            storageService.uploadFile(windowPath, minioPath);

            // Generate public URL
            String videoUrl = storageService.generatePublicUrl(minioPath);
            log.info("🎥 [URL-TRACK] Generated public URL for session={}, chunk={}, window={}, globalIndex={}: {}",
                    session.getId(), chunk.getChunkIndex(), i, globalWindowIndex, videoUrl);

            // Calculate time offsets for this window (relative to session start)
            int startOffset = baseOffset + (i * videoConfig.getWindowStep());
            int endOffset = startOffset + videoConfig.getWindowSize();

            // Analyze window with context from previous window
            final String contextForAnalysis = previousContext;
            String result = grpcClientService.analyzeVideoSync(
                    session.getId().toString(),
                    globalWindowIndex,
                    videoUrl,
                    session.getAiModel(),
                    contextForAnalysis,
                    startOffset,
                    endOffset,
                    content -> {
                        // Stream result to WebSocket
                        analysisService.sendStreamingResult(session.getId(), globalWindowIndex, content);
                    }
            );

            // Save analysis result with global window index
            analysisService.saveAnalysisRecord(session.getId(), chunk.getId(), globalWindowIndex, result, startOffset, endOffset, minioPath);

            // Use this result as context for next window
            previousContext = summarizeForContext(result);

            log.info("Window {} (global index) analyzed: length={}", globalWindowIndex, result.length());

            // Delete temporary window file
            cleanupService.deleteLocalFile(windowPath);

            // Delete storage object if not keeping videos
            if (!session.getKeepVideo()) {
                storageService.deleteObject(minioPath);
            }
        }

        log.info("Sliding window analysis completed: sessionId={}, windows={}, globalIndexRange={}-{}",
                session.getId(), windowPaths.size(), globalWindowStartIndex, globalWindowStartIndex + windowPaths.size() - 1);

        // Step 4: Extract and save tail for next chunk (for cross-chunk windows)
        try {
            // Calculate tail duration: overlap between chunks
            int tailDuration = videoConfig.getWindowSize() - videoConfig.getWindowStep();

            // Extract tail from ORIGINAL chunk (not the concatenated one)
            String tailLocalPath = videoConfig.getTempPath() + "/" + session.getId() +
                    "/tail_" + chunk.getChunkIndex() + ".webm";
            grpcClientService.extractTail(localPath, tailLocalPath, tailDuration);

            // Upload tail to storage
            String tailStoragePath = "sessions/" + session.getId() + "/tail_" +
                    chunk.getChunkIndex() + "_" + System.currentTimeMillis() + ".webm";
            storageService.uploadFile(tailLocalPath, tailStoragePath);

            // Delete previous tail from storage if exists
            if (session.getLastChunkTailPath() != null) {
                try {
                    storageService.deleteObject(session.getLastChunkTailPath());
                    log.info("Deleted previous tail: {}", session.getLastChunkTailPath());
                } catch (Exception e) {
                    log.warn("Failed to delete previous tail: {}", e.getMessage());
                }
            }

            // Update session with new tail info
            session.setLastChunkTailPath(tailStoragePath);
            session.setLastChunkTailDuration(tailDuration);
            videoUploadService.updateSessionStatus(session.getId(), session.getStatus()); // Trigger save

            log.info("Saved chunk tail: duration={}s, path={}", tailDuration, tailStoragePath);

            // Cleanup local tail file
            cleanupService.deleteLocalFile(tailLocalPath);

        } catch (Exception e) {
            log.error("Failed to extract/save tail, continuing without it: {}", e.getMessage());
            // Not critical, continue processing
        }

        // Cleanup concatenated file if created
        if (hasTailConcat && !videoToProcess.equals(localPath)) {
            cleanupService.deleteLocalFile(videoToProcess);
        }
    }

    /**
     * Calculate start time offset for this chunk relative to session start
     * Based on accumulated duration of all previous chunks
     */
    private int calculateAccumulatedDuration(Session session, VideoChunk currentChunk) {
        // Get all chunks before the current one
        List<VideoChunk> previousChunks = videoChunkRepository.findBySessionIdOrderByChunkIndexAsc(session.getId())
                .stream()
                .filter(c -> c.getChunkIndex() < currentChunk.getChunkIndex())
                .toList();

        // Sum up durations of all previous chunks
        int accumulatedSeconds = 0;
        for (VideoChunk chunk : previousChunks) {
            if (chunk.getDuration() != null && chunk.getDuration() > 0) {
                accumulatedSeconds += chunk.getDuration();
            } else {
                // If duration not set, assume 30 seconds (default chunk duration)
                accumulatedSeconds += 30;
                log.warn("Chunk {} has no duration, assuming 30 seconds", chunk.getId());
            }
        }

        return accumulatedSeconds;
    }

    /**
     * Build MinIO object path
     */
    private String buildMinioPath(Long sessionId, Integer chunkIndex, String suffix) {
        long timestamp = System.currentTimeMillis();
        return String.format("sessions/%d/chunks/%d_%s_%d.webm",
                sessionId, timestamp, suffix, chunkIndex);
    }

    /**
     * Summarize result for use as context in next window
     * (Simple version: just truncate to last 500 chars)
     */
    private String summarizeForContext(String result) {
        if (result.length() <= 500) {
            return result;
        }
        return "..." + result.substring(result.length() - 500);
    }

    /**
     * Download file from storage to local path
     * This is a helper method since StorageService doesn't have a direct download method
     *
     * @param storagePath   Path in storage
     * @param localPath     Local file path to save
     * @param storageService Storage service instance
     */
    private void downloadFromStorage(String storagePath, String localPath, StorageService storageService) {
        try {
            // Generate a temporary URL and download using it
            // For MinIO/OSS/COS, we can use presigned URLs
            String url = storageService.generatePublicUrl(storagePath);

            // Use Java HTTP client to download
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .GET()
                    .build();

            java.net.http.HttpResponse<byte[]> response = client.send(request,
                    java.net.http.HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() != 200) {
                throw new VideoProcessingException("Failed to download from storage: HTTP " + response.statusCode());
            }

            // Ensure parent directory exists
            java.nio.file.Path path = java.nio.file.Paths.get(localPath);
            java.nio.file.Files.createDirectories(path.getParent());

            // Write to local file
            java.nio.file.Files.write(path, response.body());

            log.info("Downloaded from storage: {} -> {}", storagePath, localPath);

        } catch (Exception e) {
            log.error("Failed to download from storage: {}", e.getMessage());
            throw new VideoProcessingException("Failed to download from storage", e);
        }
    }
}
