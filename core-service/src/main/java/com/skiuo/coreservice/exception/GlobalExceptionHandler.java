package com.skiuo.coreservice.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(StorageException.class)
    public ResponseEntity<Map<String, Object>> handleStorageException(StorageException e) {
        log.error("Storage exception: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Storage error", e.getMessage());
    }

    @ExceptionHandler(GrpcException.class)
    public ResponseEntity<Map<String, Object>> handleGrpcException(GrpcException e) {
        log.error("gRPC exception: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, "AI service error", e.getMessage());
    }

    @ExceptionHandler(VideoProcessingException.class)
    public ResponseEntity<Map<String, Object>> handleVideoProcessingException(VideoProcessingException e) {
        log.error("Video processing exception: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Video processing error", e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(IllegalArgumentException e) {
        log.error("Illegal argument: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, "Invalid request", e.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceededException(MaxUploadSizeExceededException e) {
        log.error("File size exceeds limit: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.PAYLOAD_TOO_LARGE, "File too large",
                "Uploaded file exceeds maximum size limit");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception e) {
        log.error("Unexpected exception: {}", e.getMessage(), e);
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error",
                "An unexpected error occurred");
    }

    private ResponseEntity<Map<String, Object>> buildErrorResponse(HttpStatus status, String error, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", System.currentTimeMillis());
        body.put("status", status.value());
        body.put("error", error);
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}
