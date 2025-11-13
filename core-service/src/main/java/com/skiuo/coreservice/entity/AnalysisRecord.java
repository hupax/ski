package com.skiuo.coreservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "analysis_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "chunk_id")
    private Long chunkId;

    @Column(name = "window_index")
    private Integer windowIndex;

    @Column(name = "raw_content", columnDefinition = "TEXT")
    private String rawContent;  // AI raw analysis result

    @Column(name = "refined_content", nullable = false, columnDefinition = "TEXT")
    private String refinedContent;  // AI refined analysis result (displayed to frontend)

    @Column(name = "start_time_offset")
    private Double startTimeOffset;

    @Column(name = "end_time_offset")
    private Double endTimeOffset;

    @Column(name = "video_path", length = 500)
    private String videoPath;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
