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

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "start_time_offset")
    private Integer startTimeOffset;

    @Column(name = "end_time_offset")
    private Integer endTimeOffset;

    @Column(name = "video_path", length = 500)
    private String videoPath;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
