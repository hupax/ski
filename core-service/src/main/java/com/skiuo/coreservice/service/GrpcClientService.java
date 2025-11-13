package com.skiuo.coreservice.service;

import com.skiuo.coreservice.exception.GrpcException;
import com.skiuo.grpc.*;
import io.grpc.ManagedChannel;
import io.grpc.stub.StreamObserver;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

@Service
@Slf4j
public class GrpcClientService {

    private final VideoAnalysisServiceGrpc.VideoAnalysisServiceBlockingStub blockingStub;
    private final VideoAnalysisServiceGrpc.VideoAnalysisServiceStub asyncStub;

    public GrpcClientService(ManagedChannel aiServiceChannel) {
        this.blockingStub = VideoAnalysisServiceGrpc.newBlockingStub(aiServiceChannel);
        this.asyncStub = VideoAnalysisServiceGrpc.newStub(aiServiceChannel);
        log.info("GrpcClientService initialized with channel: {}", aiServiceChannel);
    }

    /**
     * Call ProcessVideo RPC to slice video using FFmpeg
     *
     * @param sessionId    Session ID
     * @param chunkId      Chunk ID
     * @param videoPath    Local video file path
     * @param analysisMode Analysis mode (full/sliding_window)
     * @param windowSize   Window size in seconds
     * @param windowStep   Step size in seconds
     * @return List of WindowInfo with path and time information
     */
    public List<WindowInfo> processVideo(String sessionId, Long chunkId, String videoPath,
                                          String analysisMode, int windowSize, int windowStep) {
        try {
            ProcessRequest request = ProcessRequest.newBuilder()
                    .setSessionId(sessionId)
                    .setChunkId(chunkId)
                    .setVideoPath(videoPath)
                    .setAnalysisMode(analysisMode)
                    .setWindowSize(windowSize)
                    .setWindowStep(windowStep)
                    .build();

            log.info("Calling ProcessVideo gRPC: sessionId={}, chunkId={}, mode={}",
                    sessionId, chunkId, analysisMode);

            ProcessResponse response = blockingStub.processVideo(request);

            if (response.getError() != null && !response.getError().isEmpty()) {
                throw new GrpcException("ProcessVideo failed: " + response.getError());
            }

            List<WindowInfo> windows = response.getWindowsList();
            log.info("ProcessVideo completed: {} windows created", windows.size());

            return windows;

        } catch (Exception e) {
            log.error("Failed to call ProcessVideo gRPC: {}", e.getMessage());
            throw new GrpcException("Failed to call ProcessVideo gRPC", e);
        }
    }

    /**
     * Call AnalyzeVideo RPC to analyze video using AI API (streaming response)
     *
     * @param sessionId     Session ID
     * @param windowIndex   Window index
     * @param videoUrl      MinIO presigned URL
     * @param aiModel       AI model name (qwen/gemini)
     * @param context       Previous window result
     * @param startOffset   Start time offset
     * @param endOffset     End time offset
     * @param analysisMode  Analysis mode (full/sliding_window)
     * @param onChunk       Callback for each streaming chunk
     * @return CompletableFuture with full content
     */
    public CompletableFuture<String> analyzeVideo(String sessionId, int windowIndex,
                                                    String videoUrl, String aiModel,
                                                    String context, Double startOffset,
                                                    Double endOffset, String analysisMode,
                                                    String userMemory, Consumer<String> onChunk) {
        CompletableFuture<String> future = new CompletableFuture<>();
        StringBuilder fullContent = new StringBuilder();

        try {
            AnalysisRequest request = AnalysisRequest.newBuilder()
                    .setSessionId(sessionId)
                    .setWindowIndex(windowIndex)
                    .setVideoUrl(videoUrl)
                    .setAiModel(aiModel)
                    .setContext(context != null ? context : "")
                    .setStartOffset(startOffset.intValue())
                    .setEndOffset(endOffset.intValue())
                    .setAnalysisMode(analysisMode)
                    .setUserMemory(userMemory != null ? userMemory : "")
                    .build();

            log.info("Calling AnalyzeVideo gRPC: sessionId={}, windowIndex={}, model={}",
                    sessionId, windowIndex, aiModel);
            log.info("🚀 [URL-TRACK] Sending to ai-service via gRPC: sessionId={}, windowIndex={}, videoUrl={}",
                    sessionId, windowIndex, videoUrl);

            asyncStub.analyzeVideo(request, new StreamObserver<AnalysisResponse>() {
                @Override
                public void onNext(AnalysisResponse response) {
                    if (response.getError() != null && !response.getError().isEmpty()) {
                        log.error("AnalyzeVideo error in stream: {}", response.getError());
                        future.completeExceptionally(new GrpcException(response.getError()));
                        return;
                    }

                    String content = response.getContent();
                    fullContent.append(content);

                    // Call callback for each chunk
                    if (onChunk != null) {
                        onChunk.accept(content);
                    }

                    if (response.getIsFinal()) {
                        log.info("AnalyzeVideo completed: sessionId={}, windowIndex={}",
                                sessionId, windowIndex);
                    }
                }

                @Override
                public void onError(Throwable t) {
                    log.error("AnalyzeVideo gRPC error: {}", t.getMessage());
                    future.completeExceptionally(new GrpcException("AnalyzeVideo failed", t));
                }

                @Override
                public void onCompleted() {
                    log.debug("AnalyzeVideo stream completed");
                    future.complete(fullContent.toString());
                }
            });

        } catch (Exception e) {
            log.error("Failed to call AnalyzeVideo gRPC: {}", e.getMessage());
            future.completeExceptionally(new GrpcException("Failed to call AnalyzeVideo gRPC", e));
        }

        return future;
    }

    /**
     * Synchronous version of analyzeVideo (waits for completion)
     */
    public String analyzeVideoSync(String sessionId, int windowIndex, String videoUrl,
                                    String aiModel, String context, Double startOffset,
                                    Double endOffset, String analysisMode,
                                    String userMemory, Consumer<String> onChunk) {
        try {
            return analyzeVideo(sessionId, windowIndex, videoUrl, aiModel, context,
                    startOffset, endOffset, analysisMode, userMemory, onChunk).get(5, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.error("AnalyzeVideo sync failed: {}", e.getMessage());
            throw new GrpcException("AnalyzeVideo sync failed", e);
        }
    }

    /**
     * Extract tail (last N seconds) from a video
     *
     * @param videoPath  Input video file path
     * @param outputPath Output file path for tail
     * @param duration   Duration to extract in seconds
     * @return Path to extracted tail file
     */
    public String extractTail(String videoPath, String outputPath, int duration) {
        try {
            ExtractTailRequest request = ExtractTailRequest.newBuilder()
                    .setVideoPath(videoPath)
                    .setOutputPath(outputPath)
                    .setDuration(duration)
                    .build();

            log.info("Calling ExtractTail gRPC: video={}, duration={}s", videoPath, duration);

            ExtractTailResponse response = blockingStub.extractTail(request);

            if (response.getError() != null && !response.getError().isEmpty()) {
                throw new GrpcException("ExtractTail failed: " + response.getError());
            }

            log.info("ExtractTail completed: output={}", response.getOutputPath());
            return response.getOutputPath();

        } catch (Exception e) {
            log.error("Failed to call ExtractTail gRPC: {}", e.getMessage());
            throw new GrpcException("Failed to call ExtractTail gRPC", e);
        }
    }

    /**
     * Extract a specific time segment from video
     *
     * @param videoPath  Input video file path
     * @param outputPath Output file path for segment
     * @param startTime  Start time in seconds
     * @param endTime    End time in seconds
     * @return Path to extracted segment file
     */
    public String extractSegment(String videoPath, String outputPath, Double startTime, Double endTime) {
        try {
            ExtractSegmentRequest request = ExtractSegmentRequest.newBuilder()
                    .setVideoPath(videoPath)
                    .setOutputPath(outputPath)
                    .setStartTime(startTime.floatValue())
                    .setEndTime(endTime.floatValue())
                    .build();

            log.info("Calling ExtractSegment gRPC: video={}, range=[{}s, {}s]", videoPath, startTime, endTime);

            ExtractSegmentResponse response = blockingStub.extractSegment(request);

            if (response.getError() != null && !response.getError().isEmpty()) {
                throw new GrpcException("ExtractSegment failed: " + response.getError());
            }

            log.info("ExtractSegment completed: output={}", response.getOutputPath());
            return response.getOutputPath();

        } catch (Exception e) {
            log.error("Failed to call ExtractSegment gRPC: {}", e.getMessage());
            throw new GrpcException("Failed to call ExtractSegment gRPC", e);
        }
    }

    /**
     * Get video duration using FFmpeg
     *
     * @param videoPath Video file path
     * @return Duration in seconds
     */
    public Double getVideoDuration(String videoPath) {
        try {
            GetVideoDurationRequest request = GetVideoDurationRequest.newBuilder()
                    .setVideoPath(videoPath)
                    .build();

            log.info("Calling GetVideoDuration gRPC: video={}", videoPath);

            GetVideoDurationResponse response = blockingStub.getVideoDuration(request);

            if (response.getError() != null && !response.getError().isEmpty()) {
                throw new GrpcException("GetVideoDuration failed: " + response.getError());
            }

            Double duration = (double) response.getDuration();
            log.info("GetVideoDuration completed: duration={}s", duration);
            return duration;

        } catch (Exception e) {
            log.error("Failed to call GetVideoDuration gRPC: {}", e.getMessage());
            throw new GrpcException("Failed to call GetVideoDuration gRPC", e);
        }
    }

    /**
     * Concatenate multiple videos into one
     *
     * @param videoPaths List of video file paths to concatenate (in order)
     * @param outputPath Output file path for concatenated video
     * @return Path to concatenated video
     */
    public String concatVideos(List<String> videoPaths, String outputPath) {
        try {
            ConcatVideosRequest request = ConcatVideosRequest.newBuilder()
                    .addAllVideoPaths(videoPaths)
                    .setOutputPath(outputPath)
                    .build();

            log.info("Calling ConcatVideos gRPC: {} videos", videoPaths.size());

            ConcatVideosResponse response = blockingStub.concatVideos(request);

            if (response.getError() != null && !response.getError().isEmpty()) {
                throw new GrpcException("ConcatVideos failed: " + response.getError());
            }

            log.info("ConcatVideos completed: output={}", response.getOutputPath());
            return response.getOutputPath();

        } catch (Exception e) {
            log.error("Failed to call ConcatVideos gRPC: {}", e.getMessage());
            throw new GrpcException("Failed to call ConcatVideos gRPC", e);
        }
    }

    /**
     * Generate session title based on analysis results
     *
     * @param sessionId Session ID
     * @param analysisResults List of refined analysis results
     * @param userMemory User memory JSON string
     * @param aiModel AI model name
     * @return Generated title
     */
    public String generateTitle(String sessionId, List<String> analysisResults,
                                String userMemory, String aiModel) {
        try {
            log.info("Calling GenerateTitle gRPC: session={}, model={}, results_count={}",
                    sessionId, aiModel, analysisResults.size());

            GenerateTitleRequest request = GenerateTitleRequest.newBuilder()
                    .setSessionId(sessionId)
                    .addAllAnalysisResults(analysisResults)
                    .setUserMemory(userMemory != null ? userMemory : "")
                    .setAiModel(aiModel)
                    .build();

            GenerateTitleResponse response = blockingStub
                    .withDeadlineAfter(180, TimeUnit.SECONDS)
                    .generateTitle(request);

            if (response.getError() != null && !response.getError().isEmpty()) {
                throw new GrpcException("GenerateTitle failed: " + response.getError());
            }

            log.info("GenerateTitle completed: title={}", response.getTitle());
            return response.getTitle();

        } catch (Exception e) {
            log.error("Failed to call GenerateTitle gRPC: {}", e.getMessage());
            throw new GrpcException("Failed to call GenerateTitle gRPC", e);
        }
    }

    /**
     * Refine analysis result by fixing obvious errors
     *
     * @param sessionId Session ID
     * @param windowIndex Window index
     * @param rawContent Raw analysis result
     * @param videoDuration Total video duration
     * @param userMemory User memory JSON string
     * @param aiModel AI model name
     * @return Refined analysis result
     */
    public String refineAnalysis(String sessionId, int windowIndex, String rawContent,
                                 double videoDuration, String userMemory, String aiModel) {
        try {
            log.info("Calling RefineAnalysis gRPC: session={}, window={}, model={}",
                    sessionId, windowIndex, aiModel);

            VideoMetadata metadata = VideoMetadata.newBuilder()
                    .setVideoDuration(videoDuration)
                    .build();

            RefineAnalysisRequest request = RefineAnalysisRequest.newBuilder()
                    .setSessionId(sessionId)
                    .setWindowIndex(windowIndex)
                    .setRawContent(rawContent)
                    .setMetadata(metadata)
                    .setUserMemory(userMemory != null ? userMemory : "")
                    .setAiModel(aiModel)
                    .build();

            RefineAnalysisResponse response = blockingStub
                    .withDeadlineAfter(180, TimeUnit.SECONDS)
                    .refineAnalysis(request);

            if (response.getError() != null && !response.getError().isEmpty()) {
                throw new GrpcException("RefineAnalysis failed: " + response.getError());
            }

            log.info("RefineAnalysis completed: length={}", response.getRefinedContent().length());
            return response.getRefinedContent();

        } catch (Exception e) {
            log.error("Failed to call RefineAnalysis gRPC: {}", e.getMessage());
            throw new GrpcException("Failed to call RefineAnalysis gRPC", e);
        }
    }

    /**
     * Extract user memory from analysis results
     *
     * @param sessionId Session ID
     * @param analysisResults List of refined analysis results
     * @param currentMemory Current user memory JSON string
     * @param aiModel AI model name
     * @return Extracted new memory JSON string
     */
    public String extractUserMemory(String sessionId, List<String> analysisResults,
                                    String currentMemory, String aiModel) {
        try {
            log.info("Calling ExtractUserMemory gRPC: session={}, model={}, results_count={}",
                    sessionId, aiModel, analysisResults.size());

            ExtractUserMemoryRequest request = ExtractUserMemoryRequest.newBuilder()
                    .setSessionId(sessionId)
                    .addAllAnalysisResults(analysisResults)
                    .setCurrentMemory(currentMemory != null ? currentMemory : "{}")
                    .setAiModel(aiModel)
                    .build();

            ExtractUserMemoryResponse response = blockingStub
                    .withDeadlineAfter(180, TimeUnit.SECONDS)
                    .extractUserMemory(request);

            if (response.getError() != null && !response.getError().isEmpty()) {
                throw new GrpcException("ExtractUserMemory failed: " + response.getError());
            }

            log.info("ExtractUserMemory completed: length={}", response.getNewMemory().length());
            return response.getNewMemory();

        } catch (Exception e) {
            log.error("Failed to call ExtractUserMemory gRPC: {}", e.getMessage());
            throw new GrpcException("Failed to call ExtractUserMemory gRPC", e);
        }
    }
}
