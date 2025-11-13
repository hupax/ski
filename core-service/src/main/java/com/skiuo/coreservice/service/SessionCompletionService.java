package com.skiuo.coreservice.service;

import com.skiuo.coreservice.entity.Session;
import com.skiuo.coreservice.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Service for handling session completion tasks:
 * - Title generation
 * - User memory extraction and update
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SessionCompletionService {

    private final SessionRepository sessionRepository;
    private final AnalysisService analysisService;
    private final GrpcClientService grpcClientService;
    private final UserMemoryService userMemoryService;

    /**
     * Complete session: generate title and extract user memory
     *
     * @param sessionId Session ID
     */
    @Async("videoTaskExecutor")
    public CompletableFuture<Void> completeSession(Long sessionId) {
        try {
            log.info("Starting session completion: sessionId={}", sessionId);

            Session session = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));

            // Get all refined analysis results
            List<String> refinedResults = analysisService.getAllRefinedResults(sessionId);

            if (refinedResults.isEmpty()) {
                log.warn("No analysis results found for session {}, skipping completion tasks", sessionId);
                return CompletableFuture.completedFuture(null);
            }

            log.info("Found {} analysis results for session {}", refinedResults.size(), sessionId);

            // Get user memory
            String userMemory = userMemoryService.getUserMemory(session.getUserId());

            // Task 1: Generate title
            String title = generateSessionTitle(session, refinedResults, userMemory);
            if (title != null && !title.isEmpty()) {
                session.setTitle(title);
                log.info("Generated session title: {}", title);
            }

            // Task 2: Extract and update user memory
            extractAndUpdateUserMemory(session, refinedResults, userMemory);

            // Update session end time and save
            session.setEndTime(LocalDateTime.now());
            sessionRepository.save(session);

            log.info("Session completion finished: sessionId={}, title={}", sessionId, title);

            return CompletableFuture.completedFuture(null);

        } catch (Exception e) {
            log.error("Session completion failed: sessionId={}, error={}", sessionId, e.getMessage(), e);
            return CompletableFuture.failedFuture(e);
        }
    }

    /**
     * Generate session title using AI
     */
    private String generateSessionTitle(Session session, List<String> refinedResults, String userMemory) {
        try {
            log.info("Generating title for session {}", session.getId());

            String title = grpcClientService.generateTitle(
                    session.getId().toString(),
                    refinedResults,
                    userMemory,
                    session.getAiModel()
            );

            // Ensure title is not too long (<=10 chars as per requirement, but allow some buffer)
            if (title.length() > 50) {
                title = title.substring(0, 50);
            }

            return title;

        } catch (Exception e) {
            log.error("Failed to generate title for session {}: {}", session.getId(), e.getMessage());
            // Return default title on failure
            return "视频分析";
        }
    }

    /**
     * Extract user memory from analysis results and update
     */
    private void extractAndUpdateUserMemory(Session session, List<String> refinedResults, String currentMemory) {
        try {
            log.info("Extracting user memory for session {}", session.getId());

            String newMemoryJson = grpcClientService.extractUserMemory(
                    session.getId().toString(),
                    refinedResults,
                    currentMemory,
                    session.getAiModel()
            );

            // Update user memory (merge with existing)
            userMemoryService.updateUserMemory(session.getUserId(), newMemoryJson);

            log.info("User memory updated for userId={}", session.getUserId());

        } catch (Exception e) {
            log.error("Failed to extract/update user memory for session {}: {}",
                    session.getId(), e.getMessage());
            // Don't throw - memory extraction failure shouldn't block session completion
        }
    }
}
