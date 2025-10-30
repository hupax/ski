package com.skiuo.coreservice.dto;

import com.skiuo.coreservice.entity.AnalysisRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisRecordResponse {
    private Long id;
    private Long sessionId;
    private Long chunkId;
    private Integer windowIndex;
    private String content;
    private Double startTimeOffset;
    private Double endTimeOffset;
    private LocalDateTime createdAt;

    public static AnalysisRecordResponse fromEntity(AnalysisRecord record) {
        return AnalysisRecordResponse.builder()
                .id(record.getId())
                .sessionId(record.getSessionId())
                .chunkId(record.getChunkId())
                .windowIndex(record.getWindowIndex())
                .content(record.getContent())
                .startTimeOffset(record.getStartTimeOffset())
                .endTimeOffset(record.getEndTimeOffset())
                .createdAt(record.getCreatedAt())
                .build();
    }

    public static List<AnalysisRecordResponse> fromEntities(List<AnalysisRecord> records) {
        return records.stream()
                .map(AnalysisRecordResponse::fromEntity)
                .collect(Collectors.toList());
    }
}
