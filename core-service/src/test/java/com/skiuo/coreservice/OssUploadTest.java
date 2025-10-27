package com.skiuo.coreservice;

import com.skiuo.coreservice.service.OssService;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

@SpringBootTest
@Slf4j
public class OssUploadTest {

    @Autowired
    private OssService ossService;

    @Test
    public void testUploadAndAccessUrl() {
        try {
            // 1. 上传文件
            String localFilePath = "/Users/hupax/Downloads/IMG_3973.JPG";
            String objectName = "test/IMG_3973.JPG";

            log.info("===== Step 1: Uploading file =====");
            log.info("Local file: {}", localFilePath);
            log.info("Object name: {}", objectName);

            String uploadedObjectName = ossService.uploadFile(localFilePath, objectName);
            log.info("Upload successful: {}", uploadedObjectName);

            // 2. 生成presigned URL
            log.info("\n===== Step 2: Generating presigned URL =====");
            String presignedUrl = ossService.generatePublicUrl(uploadedObjectName);
            log.info("Presigned URL: {}", presignedUrl);

            // 3. 尝试访问URL
            log.info("\n===== Step 3: Testing URL access =====");
            URL url = new URL(presignedUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            int responseCode = connection.getResponseCode();
            log.info("Response code: {}", responseCode);
            log.info("Response message: {}", connection.getResponseMessage());
            log.info("Content type: {}", connection.getContentType());
            log.info("Content length: {}", connection.getContentLength());

            if (responseCode == 200) {
                log.info("\n✅ SUCCESS! URL is accessible");
                log.info("You can open this URL in browser:");
                log.info("{}", presignedUrl);
            } else {
                log.error("\n❌ FAILED! Response code: {}", responseCode);
                // 读取错误响应
                BufferedReader errorReader = new BufferedReader(
                    new InputStreamReader(connection.getErrorStream())
                );
                StringBuilder errorResponse = new StringBuilder();
                String line;
                while ((line = errorReader.readLine()) != null) {
                    errorResponse.append(line).append("\n");
                }
                errorReader.close();
                log.error("Error response:\n{}", errorResponse.toString());
            }

            connection.disconnect();

            // 4. 清理测试文件（可选）
            log.info("\n===== Step 4: Cleanup (optional) =====");
            log.info("Test completed. If you want to delete the test file, uncomment the next line:");
            // ossService.deleteObject(uploadedObjectName);
            // log.info("Test file deleted: {}", uploadedObjectName);

        } catch (Exception e) {
            log.error("Test failed with exception", e);
            throw new RuntimeException(e);
        }
    }
}
