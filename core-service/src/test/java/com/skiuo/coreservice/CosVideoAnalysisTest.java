package com.skiuo.coreservice;

import com.skiuo.coreservice.service.CosService;
import com.skiuo.coreservice.service.GrpcClientService;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 完整集成测试：上传视频到COS -> 获取URL -> AI分析
 */
@SpringBootTest
@Slf4j
public class CosVideoAnalysisTest {

    @Autowired
    private CosService cosService;

    @Autowired
    private GrpcClientService grpcClientService;

    @Test
    public void testCosUploadAndAiAnalysis() {
        try {
            // ===== Step 1: 上传视频到COS =====
            String localFilePath = "/Users/hupax/Downloads/test.webm";
            String objectName = "test/integration_test_" + System.currentTimeMillis() + ".webm";

            log.info("╔══════════════════════════════════════════════════════╗");
            log.info("║         Step 1: Uploading video to COS              ║");
            log.info("╚══════════════════════════════════════════════════════╝");
            log.info("Local file: {}", localFilePath);
            log.info("Object name: {}", objectName);

            String uploadedObjectName = cosService.uploadFile(localFilePath, objectName);
            log.info("✅ Upload successful: {}", uploadedObjectName);

            // ===== Step 2: 生成公共URL =====
            log.info("\n╔══════════════════════════════════════════════════════╗");
            log.info("║         Step 2: Generating public URL               ║");
            log.info("╚══════════════════════════════════════════════════════╝");

            String videoUrl = cosService.generatePublicUrl(uploadedObjectName);
            log.info("Video URL: {}", videoUrl);

            // ===== Step 3: 验证URL可访问性 =====
            log.info("\n╔══════════════════════════════════════════════════════╗");
            log.info("║         Step 3: Testing URL accessibility           ║");
            log.info("╚══════════════════════════════════════════════════════╝");

            URL url = new URL(videoUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("HEAD");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            int responseCode = connection.getResponseCode();
            log.info("Response code: {}", responseCode);
            log.info("Content type: {}", connection.getContentType());
            log.info("Content length: {} bytes", connection.getContentLength());

            if (responseCode == 200) {
                log.info("✅ URL is accessible");
            } else {
                log.error("❌ URL not accessible! Response code: {}", responseCode);
                throw new RuntimeException("URL not accessible");
            }
            connection.disconnect();

            // ===== Step 4: 调用AI服务分析视频 =====
            log.info("\n╔══════════════════════════════════════════════════════╗");
            log.info("║         Step 4: Calling AI service for analysis     ║");
            log.info("╚══════════════════════════════════════════════════════╝");

            String sessionId = "test-session-" + System.currentTimeMillis();
            int windowIndex = 0;
            String aiModel = "qwen";
            String context = "";
            int startOffset = 0;
            int endOffset = 30; // 假设30秒视频

            log.info("Session ID: {}", sessionId);
            log.info("AI Model: {}", aiModel);
            log.info("Window Index: {}", windowIndex);
            log.info("Time Range: {}s - {}s", startOffset, endOffset);
            log.info("\nCalling gRPC service...");

            AtomicInteger streamCount = new AtomicInteger(0);

            String result = grpcClientService.analyzeVideoSync(
                sessionId,
                windowIndex,
                videoUrl,
                aiModel,
                context,
                startOffset,
                endOffset,
                content -> {
                    // 流式结果回调
                    int count = streamCount.incrementAndGet();
                    log.info("📥 Streaming result #{}: {}", count, content.substring(0, Math.min(100, content.length())) + "...");
                }
            );

            // ===== Step 5: 显示分析结果 =====
            log.info("\n╔══════════════════════════════════════════════════════╗");
            log.info("║         Step 5: Analysis Results                     ║");
            log.info("╚══════════════════════════════════════════════════════╝");
            log.info("Received {} streaming updates", streamCount.get());
            log.info("\n📊 Final Analysis Result:");
            log.info("─────────────────────────────────────────────────────");
            log.info("{}", result);
            log.info("─────────────────────────────────────────────────────");
            log.info("Result length: {} characters", result.length());

            // ===== Step 6: 清理测试文件 =====
            log.info("\n╔══════════════════════════════════════════════════════╗");
            log.info("║         Step 6: Cleanup (optional)                   ║");
            log.info("╚══════════════════════════════════════════════════════╝");
            log.info("Test completed successfully! 🎉");
            log.info("If you want to delete the test file, uncomment the next line:");
            log.info("Object name: {}", uploadedObjectName);

            // Uncomment to delete test file:
            // cosService.deleteObject(uploadedObjectName);
            // log.info("✅ Test file deleted from COS");

        } catch (Exception e) {
            log.error("❌ Test failed with exception", e);
            throw new RuntimeException(e);
        }
    }

    /**
     * 单独测试COS上传功能
     */
    @Test
    public void testCosUploadOnly() {
        try {
            String localFilePath = "/Users/hupax/Downloads/test.webm";
            String objectName = "test/upload_only_test_" + System.currentTimeMillis() + ".webm";

            log.info("Testing COS upload...");
            log.info("Local file: {}", localFilePath);
            log.info("Object name: {}", objectName);

            String uploadedObjectName = cosService.uploadFile(localFilePath, objectName);
            log.info("✅ Upload successful: {}", uploadedObjectName);

            String videoUrl = cosService.generatePublicUrl(uploadedObjectName);
            log.info("✅ Video URL: {}", videoUrl);

            // 验证URL
            URL url = new URL(videoUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("HEAD");
            int responseCode = connection.getResponseCode();
            connection.disconnect();

            log.info("✅ URL accessible: HTTP {}", responseCode);

            if (responseCode != 200) {
                throw new RuntimeException("URL not accessible: " + responseCode);
            }

        } catch (Exception e) {
            log.error("❌ Test failed", e);
            throw new RuntimeException(e);
        }
    }
}
