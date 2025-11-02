package com.skiuo.coreservice.service;

import com.skiuo.coreservice.config.VideoConfig;
import com.skiuo.coreservice.entity.AnalysisRecord;
import com.skiuo.coreservice.entity.Session;
import com.skiuo.coreservice.entity.VideoChunk;
import com.skiuo.coreservice.exception.VideoProcessingException;
import com.skiuo.coreservice.repository.VideoChunkRepository;
import com.skiuo.grpc.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final com.skiuo.coreservice.repository.SessionRepository sessionRepository;
    
    
    /**
     * Process video chunk asynchronously
     *
     * @param session   Session entity
     * @param chunk     Video chunk entity
     * @param localPath Local file path
     */
    @Async("videoTaskExecutor")
    public CompletableFuture<Void> processVideoChunk(Session session, VideoChunk chunk, String localPath, Boolean isLastChunk) {
        Long sessionId = session.getId();
        Long chunkId = chunk.getId();

        try {
            log.info("Starting video processing: sessionId={}, chunkId={}, mode={}, isLastChunk={}",
                    sessionId, chunkId, session.getAnalysisMode(), isLastChunk);

            // Update session status to ANALYZING
            videoUploadService.updateSessionStatus(sessionId, Session.SessionStatus.ANALYZING);

            if (session.getAnalysisMode() == Session.AnalysisMode.FULL) {
                // Full analysis mode
                processFullAnalysisMode(session, chunk, localPath, isLastChunk);
            } else {
                // Sliding window mode
                processSlidingWindowMode(session, chunk, localPath, isLastChunk);
            }

            log.info("Video processing completed: sessionId={}, chunkId={}",
                    sessionId, chunkId);

            // Cleanup
            cleanupService.cleanupAfterProcessing(session, chunk, localPath);

            return CompletableFuture.completedFuture(null);

        } catch (Exception e) {
            log.error("Video processing failed: sessionId={}, chunkId={}, error={}",
                    sessionId, chunkId, e.getMessage());
            videoUploadService.updateSessionStatus(sessionId, Session.SessionStatus.FAILED);
            throw new VideoProcessingException("Video processing failed", e);
        }
    }
    
    
    /**
     * Full analysis mode: append to master video, analyze when isLastChunk=true
     */
    private void processFullAnalysisMode(Session session, VideoChunk chunk, String localPath, Boolean isLastChunk) {
        log.info("Processing in FULL mode: sessionId={}, isLastChunk={}", session.getId(), isLastChunk);

        // Step 1: Append chunk to master video
        appendToMasterVideo(session, localPath, chunk.getDuration());

        log.info("FULL mode: appended chunk to master video, total length={}s",
                session.getCurrentVideoLength());

        // Step 2: If this is the last chunk, analyze the complete master video
        if (isLastChunk) {
            log.info("Last chunk received, analyzing complete master video for session {}", session.getId());
            analyzeFullMasterVideo(session);

            // Mark session as completed
            videoUploadService.updateSessionStatus(session.getId(), Session.SessionStatus.COMPLETED);
            log.info("FULL mode: session {} marked as COMPLETED", session.getId());
        }
    }
    
    
    /**
     * Analyze the complete master video in FULL mode
     *
     * @param session Session entity
     */
    private void analyzeFullMasterVideo(Session session) {
        log.info("Analyzing full master video for session {}, length={}s",
                session.getId(), session.getCurrentVideoLength());
        
        StorageService storageService = storageServiceFactory.getStorageService(session.getStorageType());
        
        try {
            // 1. Upload master video to storage
            String storagePath = "sessions/" + session.getId() + "/full_video.webm";
            storageService.uploadFile(session.getMasterVideoPath(), storagePath);
            log.info("Uploaded master video to storage: {}", storagePath);
            
            // 2. Generate public URL
            String videoUrl = storageService.generatePublicUrl(storagePath);
            log.info("🎥 Generated URL for full video: {}", videoUrl);
            
            // 3. Analyze complete video
            String result = grpcClientService.analyzeVideoSync(
                    session.getId().toString(),
                    0,  // window index 0 for full analysis
                    videoUrl,
                    session.getAiModel(),
                    "",  // no context for full analysis
                    0.0,
                    session.getCurrentVideoLength(),
                    "full",  // IMPORTANT: pass "full" mode to use correct prompt
                    content -> analysisService.sendStreamingResult(session.getId(), 0, content)
            );
            
            // 4. Save analysis result
            analysisService.saveAnalysisRecord(
                    session.getId(),
                    null,
                    0,
                    result,
                    0.0,
                    session.getCurrentVideoLength(),
                    storagePath
            );
            
            log.info("Full video analysis completed: length={}", result.length());
            
            // 5. Delete from storage if not keeping videos
            if (!session.getKeepVideo()) {
                storageService.deleteObject(storagePath);
                log.info("Deleted full video from storage (keepVideo=false)");
            }
            
        } catch (Exception e) {
            log.error("Failed to analyze full master video: {}", e.getMessage(), e);
            throw new VideoProcessingException("Failed to analyze full master video", e);
        }
    }
    
    /**
     * Sliding window mode: append to master video and trigger sliding window analysis
     */
    private void processSlidingWindowMode(Session session, VideoChunk chunk, String localPath, Boolean isLastChunk) {
        log.info("Processing in SLIDING_WINDOW mode (NEW): sessionId={}, isLastChunk={}", session.getId(), isLastChunk);

        // Step 1: Append chunk to master video
        appendToMasterVideo(session, localPath, chunk.getDuration());

        // Step 2: Check trigger condition and analyze windows
        checkAndAnalyzeWindows(session, isLastChunk);

        log.info("Sliding window mode processing completed: sessionId={}, masterLength={}s",
                session.getId(), session.getCurrentVideoLength());
    }
    
    /**
     * Append chunk to master video
     *
     * @param session       Session entity
     * @param chunkPath     Local path to chunk file
     * @param chunkDuration Duration of chunk in seconds
     */
    private void appendToMasterVideo(Session session, String chunkPath, Double chunkDuration) {
        try {
            if (session.getMasterVideoPath() == null) {
                // First chunk: copy as master video
                String masterPath = videoConfig.getTempPath() + "/" + session.getId() + "/master_video.webm";
                java.nio.file.Path sessionDir = java.nio.file.Paths.get(videoConfig.getTempPath(), session.getId().toString());
                if (!java.nio.file.Files.exists(sessionDir)) {
                    java.nio.file.Files.createDirectories(sessionDir);
                }
                
                java.nio.file.Files.copy(
                        java.nio.file.Paths.get(chunkPath),
                        java.nio.file.Paths.get(masterPath),
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING
                );
                
                session.setMasterVideoPath(masterPath);

                // Get actual video duration from FFmpeg
                Double actualDuration = grpcClientService.getVideoDuration(masterPath);
                session.setCurrentVideoLength(actualDuration);
                session.setLastWindowStartTime((double) -videoConfig.getWindowStep());

                log.info("Created master video: path={}, length={}s (actual from FFmpeg)", masterPath, actualDuration);
            } else {
                // Subsequent chunks: concatenate to master video
                String tempOutput = videoConfig.getTempPath() + "/" + session.getId() + "/master_temp.webm";
                
                grpcClientService.concatVideos(
                        List.of(session.getMasterVideoPath(), chunkPath),
                        tempOutput
                );
                
                // Replace old master video
                java.nio.file.Files.delete(java.nio.file.Paths.get(session.getMasterVideoPath()));
                java.nio.file.Files.move(
                        java.nio.file.Paths.get(tempOutput),
                        java.nio.file.Paths.get(session.getMasterVideoPath()),
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING
                );

                // Get actual video duration from FFmpeg after concatenation
                Double actualDuration = grpcClientService.getVideoDuration(session.getMasterVideoPath());
                session.setCurrentVideoLength(actualDuration);

                log.info("Appended to master video: new length={}s (actual from FFmpeg)", actualDuration);
            }
            
            sessionRepository.save(session);
            
        } catch (Exception e) {
            log.error("Failed to append to master video: {}", e.getMessage(), e);
            throw new VideoProcessingException("Failed to append to master video", e);
        }
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
     * Check and analyze windows based on sliding window trigger logic
     *
     * @param session Session entity
     * @param isLastChunk Whether this is the last chunk
     */
    private void checkAndAnalyzeWindows(Session session, Boolean isLastChunk) {
        log.info("Checking window analysis trigger for session {}: masterLength={}s, lastWindowStart={}s, isLastChunk={}",
                session.getId(), session.getCurrentVideoLength(), session.getLastWindowStartTime(), isLastChunk);

        StorageService storageService = storageServiceFactory.getStorageService(session.getStorageType());
        Double windowSize = (double) videoConfig.getWindowSize();
        Double windowStep = (double) videoConfig.getWindowStep();
        Double minWindowSize = 5.0; // Minimum 5 seconds for a window

        // Get current global window index
        int globalWindowIndex = (int) analysisService.countAnalyzedWindows(session.getId());

        // Get context from last window
        String previousContext = "";
        if (globalWindowIndex > 0) {
            AnalysisRecord lastRecord = analysisService.getLastAnalysisRecord(session.getId());
            if (lastRecord != null && lastRecord.getContent() != null) {
                previousContext = summarizeForContext(lastRecord.getContent());
            }
        }

        // Loop: check trigger condition and analyze windows
        while (true) {
            Double nextWindowStart = session.getLastWindowStartTime() + windowStep;
            Double nextWindowEnd = nextWindowStart + windowSize;

            // Normal trigger condition: currentLength >= nextWindowEnd
            boolean normalTrigger = session.getCurrentVideoLength() >= nextWindowEnd;

            // Last chunk trigger condition: isLastChunk=true and enough remaining video
            Double remainingLength = session.getCurrentVideoLength() - nextWindowStart;
            boolean lastChunkTrigger = isLastChunk && remainingLength >= minWindowSize;

            if (!normalTrigger && !lastChunkTrigger) {
                if (isLastChunk) {
                    log.info("Last chunk: not enough remaining video for final window: remaining={}s < minWindowSize={}s",
                            remainingLength, minWindowSize);
                } else {
                    log.info("Not enough video length for next window: current={}s, needed={}s",
                            session.getCurrentVideoLength(), nextWindowEnd);
                }
                break;
            }

            // IMPORTANT: Clamp window end to video length to avoid exceeding actual duration
            Double clampedWindowEnd = Math.min(nextWindowEnd, session.getCurrentVideoLength());

            log.info("Trigger condition met (normalTrigger={}, lastChunkTrigger={}): analyzing window {}, range=[{}, {}]s (clamped from {}s), currentVideoLength={}s",
                    normalTrigger, lastChunkTrigger, globalWindowIndex, nextWindowStart, clampedWindowEnd, nextWindowEnd,
                    session.getCurrentVideoLength());

            // Extract and analyze window
            String result = extractAndAnalyzeWindow(
                    session,
                    globalWindowIndex,
                    nextWindowStart,
                    clampedWindowEnd,  // Use clamped value
                    previousContext,
                    storageService
            );

            // Update session state
            session.setLastWindowStartTime(nextWindowStart);
            sessionRepository.save(session);

            // Update context and index for next iteration
            previousContext = summarizeForContext(result);
            globalWindowIndex++;

            // If this was the last chunk and we just analyzed the final window, break
            if (lastChunkTrigger && !normalTrigger) {
                log.info("Last chunk: final window analyzed, stopping");
                break;
            }
        }

        // Mark session as completed if this is the last chunk
        if (isLastChunk) {
            videoUploadService.updateSessionStatus(session.getId(), Session.SessionStatus.COMPLETED);
            log.info("Last chunk processed, session {} marked as COMPLETED", session.getId());
        }

        log.info("Window analysis batch completed for session {}", session.getId());
    }
    
    /**
     * Extract and analyze a single window from master video
     *
     * @param session           Session entity
     * @param globalWindowIndex Global window index
     * @param startTime         Start time in seconds
     * @param endTime           End time in seconds
     * @param context           Context from previous window
     * @param storageService    Storage service instance
     * @return Analysis result
     */
    private String extractAndAnalyzeWindow(
            Session session,
            int globalWindowIndex,
            Double startTime,
            Double endTime,
            String context,
            StorageService storageService) {
        
        log.info("Extracting and analyzing window {}: [{}, {}]s", globalWindowIndex, startTime, endTime);
        
        try {
            // 1. Extract window segment from master video
            String windowPath = videoConfig.getTempPath() + "/" + session.getId() +
                    "/window_" + globalWindowIndex + ".webm";
            grpcClientService.extractSegment(
                    session.getMasterVideoPath(),
                    windowPath,
                    startTime,
                    endTime
            );
            
            // 2. Upload to storage service
            String storagePath = String.format("sessions/%d/windows/w%d_%.0f-%.0fs.webm",
                    session.getId(), globalWindowIndex, startTime, endTime);
            storageService.uploadFile(windowPath, storagePath);
            
            // 3. Generate public URL
            String videoUrl = storageService.generatePublicUrl(storagePath);
            log.info("🎥 Generated URL for window {}: {}", globalWindowIndex, videoUrl);
            
            // 4. Call AI analysis
            String result = grpcClientService.analyzeVideoSync(
                    session.getId().toString(),
                    globalWindowIndex,
                    videoUrl,
                    session.getAiModel(),
                    context,
                    startTime,
                    endTime,
                    "sliding_window",  // Pass sliding_window mode
                    content -> analysisService.sendStreamingResult(session.getId(), globalWindowIndex, content)
            );
            
            // 5. Save analysis result
            analysisService.saveAnalysisRecord(
                    session.getId(),
                    null,  // chunkId not important anymore
                    globalWindowIndex,
                    result,
                    startTime,
                    endTime,
                    storagePath
            );
            
            // 6. Cleanup local window file
            cleanupService.deleteLocalFile(windowPath);
            
            // 7. Delete from storage if not keeping videos
            if (!session.getKeepVideo()) {
                storageService.deleteObject(storagePath);
            }
            
            log.info("Window {} analysis completed, result length={}", globalWindowIndex, result.length());
            return result;
            
        } catch (Exception e) {
            log.error("Failed to extract/analyze window {}: {}", globalWindowIndex, e.getMessage(), e);
            throw new VideoProcessingException("Failed to extract/analyze window", e);
        }
    }
}
