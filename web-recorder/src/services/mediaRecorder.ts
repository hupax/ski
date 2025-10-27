import { RECORDING_CONFIG } from '../config/constants';

export interface MediaRecorderOptions {
  onDataAvailable: (blob: Blob, duration: number) => void;
  onError: (error: Error) => void;
  onStop?: () => void;
}

/**
 * MediaRecorder wrapper for video recording
 */
export class VideoRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private lastChunkTime: number = 0;
  private chunkIntervalId: number | null = null;
  private currentOptions: MediaRecorderOptions | null = null;

  // Track actual recording time (excluding paused time)
  private recordingStartTime: number = 0;
  private accumulatedRecordingTime: number = 0; // ms
  private pauseStartTime: number = 0;

  /**
   * Request camera permission and get media stream
   */
  async requestCameraAccess(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: RECORDING_CONFIG.VIDEO_CONSTRAINTS,
        audio: true,
      });

      this.stream = stream;
      console.log('Camera access granted');
      return stream;
    } catch (error) {
      console.error('Failed to access camera:', error);
      throw new Error('Camera access denied or not available');
    }
  }

  /**
   * Start recording
   */
  startRecording(options: MediaRecorderOptions): void {
    if (!this.stream) {
      throw new Error('No media stream available. Call requestCameraAccess() first.');
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.warn('Recording already in progress');
      return;
    }

    try {
      this.currentOptions = options;
      this.startSingleRecordingSession();

      // Set up interval to restart recording every CHUNK_DURATION
      this.chunkIntervalId = setInterval(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          console.log('Stopping recorder to generate complete chunk...');
          this.mediaRecorder.stop();
          // Recording will restart in onstop handler
        }
      }, RECORDING_CONFIG.CHUNK_DURATION);

      console.log(`Recording started with automatic chunk generation every ${RECORDING_CONFIG.CHUNK_DURATION}ms`);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to initialize MediaRecorder');
    }
  }

  /**
   * Start a single recording session (internal method)
   */
  private startSingleRecordingSession(): void {
    if (!this.stream || !this.currentOptions) {
      throw new Error('Stream or options not available');
    }

    // Create MediaRecorder without timeslice
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      RECORDING_CONFIG.RECORDER_OPTIONS
    );

    if (this.startTime === 0) {
      this.startTime = Date.now();
    }

    // Reset recording time tracking for this chunk
    this.recordingStartTime = Date.now();
    this.accumulatedRecordingTime = 0;
    this.pauseStartTime = 0;

    // Handle data available event (triggered when stop() is called)
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        // Calculate actual recording duration (excluding paused time)
        const now = Date.now();
        let actualRecordingTime = this.accumulatedRecordingTime;

        // Add time from last resume/start to now (if not currently paused)
        if (this.pauseStartTime === 0) {
          actualRecordingTime += (now - this.recordingStartTime);
        }

        const duration = Math.round(actualRecordingTime / 1000); // Duration in seconds

        console.log(`Complete chunk available: ${event.data.size} bytes, actual duration: ${duration}s (excluding paused time)`);
        this.currentOptions!.onDataAvailable(event.data, duration);
      }
    };

    // Handle errors
    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      this.currentOptions!.onError(new Error('Recording error occurred'));
      this.cleanup();
    };

    // Handle stop event - restart recording automatically
    this.mediaRecorder.onstop = () => {
      console.log('Recording session stopped');

      // Only restart if we have an active interval (not manually stopped)
      if (this.chunkIntervalId) {
        console.log('Restarting recording for next chunk...');
        this.startSingleRecordingSession();
      } else if (this.currentOptions?.onStop) {
        this.currentOptions.onStop();
      }
    };

    // Start recording WITHOUT timeslice - will only trigger ondataavailable on stop()
    this.mediaRecorder.start();
    console.log('Single recording session started');
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    // Clear the interval first to prevent automatic restart
    if (this.chunkIntervalId) {
      clearInterval(this.chunkIntervalId);
      this.chunkIntervalId = null;
      console.log('Chunk interval cleared');
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      console.log('Recording stopped');
    }

    this.currentOptions = null;
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // Accumulate recording time before pausing
      const now = Date.now();
      this.accumulatedRecordingTime += (now - this.recordingStartTime);
      this.pauseStartTime = now;

      // Clear chunk interval timer
      if (this.chunkIntervalId) {
        clearInterval(this.chunkIntervalId);
        this.chunkIntervalId = null;
        console.log('Chunk interval cleared due to pause');
      }

      this.mediaRecorder.pause();
      console.log(`Recording paused (accumulated: ${Math.round(this.accumulatedRecordingTime / 1000)}s)`);
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      const now = Date.now();
      this.recordingStartTime = now;
      this.pauseStartTime = 0;

      this.mediaRecorder.resume();

      // Calculate remaining time until next chunk
      const targetChunkDuration = RECORDING_CONFIG.CHUNK_DURATION;
      const remainingTime = targetChunkDuration - this.accumulatedRecordingTime;

      if (remainingTime > 0) {
        // Restart timer with remaining time
        this.chunkIntervalId = setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.log('Chunk duration reached, stopping recorder...');
            this.mediaRecorder.stop();
          }
        }, remainingTime);

        console.log(`Recording resumed (remaining: ${Math.round(remainingTime / 1000)}s until next chunk)`);
      } else {
        // Accumulated time already exceeds chunk duration, stop immediately
        console.log('Accumulated time exceeds chunk duration, stopping immediately');
        this.mediaRecorder.stop();
      }
    }
  }

  /**
   * Release all resources
   */
  cleanup(): void {
    // Clear chunk interval
    if (this.chunkIntervalId) {
      clearInterval(this.chunkIntervalId);
      this.chunkIntervalId = null;
    }

    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.currentOptions = null;
    console.log('VideoRecorderService cleanup complete');
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    if (!this.mediaRecorder) {
      return 'inactive';
    }
    return this.mediaRecorder.state;
  }

  /**
   * Get current media stream
   */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Check if browser supports MediaRecorder
   */
  static isSupported(): boolean {
    return !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  /**
   * Check if specific MIME type is supported
   */
  static isMimeTypeSupported(mimeType: string): boolean {
    return MediaRecorder.isTypeSupported(mimeType);
  }
}
