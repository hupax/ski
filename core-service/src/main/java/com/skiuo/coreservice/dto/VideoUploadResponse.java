package com.skiuo.coreservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoUploadResponse {
    private Long sessionId;
    private Long chunkId;
    private String status;
    private String message;
}
