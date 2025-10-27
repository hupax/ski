package com.skiuo.coreservice.dto;

import lombok.Data;

@Data
public class VideoUploadRequest {
    private Long sessionId;
    private Long userId;
    private Integer chunkIndex;
    private String aiModel;
    private String analysisMode;
    private Boolean keepVideo;
    private Integer duration;
}
