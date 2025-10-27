package com.skiuo.coreservice.controller;

import com.skiuo.coreservice.config.VideoConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Configuration API for frontend
 */
@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
@Slf4j
public class ConfigController {

    private final VideoConfig videoConfig;

    /**
     * Get video processing configuration
     * Used by frontend to synchronize with backend settings
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getConfig() {
        Map<String, Object> config = new HashMap<>();

        // Video processing parameters
        config.put("windowSize", videoConfig.getWindowSize());
        config.put("windowStep", videoConfig.getWindowStep());

        // Calculate recommended chunk duration
        // Formula: chunk = windowSize + n * windowStep
        // We use n=2 for good overlap coverage
        int recommendedChunkDuration = videoConfig.getWindowSize() + (2 * videoConfig.getWindowStep());
        config.put("recommendedChunkDuration", recommendedChunkDuration);

        log.debug("Config requested: windowSize={}, windowStep={}, recommendedChunkDuration={}",
                videoConfig.getWindowSize(), videoConfig.getWindowStep(), recommendedChunkDuration);

        return ResponseEntity.ok(config);
    }
}
