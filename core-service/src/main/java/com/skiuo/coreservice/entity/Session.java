package com.skiuo.coreservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private SessionStatus status;

    @Column(name = "ai_model", length = 50)
    private String aiModel;

    @Column(name = "analysis_mode", length = 20)
    @Enumerated(EnumType.STRING)
    private AnalysisMode analysisMode;

    @Column(name = "keep_video")
    private Boolean keepVideo;

    @Column(name = "storage_type", length = 20)
    private String storageType;

    // For master video + sliding window support
    @Column(name = "master_video_path", length = 500)
    private String masterVideoPath;  // Path to the continuously growing master video

    @Column(name = "last_window_start_time")
    private Double lastWindowStartTime;  // Start time of the last analyzed window (seconds), initial: -windowStep

    @Column(name = "current_video_length")
    private Double currentVideoLength;  // Current total length of master video (seconds), initial: 0.0

    @Column(name = "title", length = 50)
    private String title;  // AI-generated session title (<=10 chars)

    @Column(name = "video_duration")
    private Double videoDuration;  // Total video duration from FFmpeg (seconds)

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = SessionStatus.RECORDING;
        }
        if (keepVideo == null) {
            keepVideo = false;
        }
        if (storageType == null) {
            storageType = "cos";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum SessionStatus {
        RECORDING,
        ANALYZING,
        COMPLETED,
        FAILED
    }

    public enum AnalysisMode {
        FULL,
        SLIDING_WINDOW
    }
}
