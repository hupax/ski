// Updated MediaRecorder hook that uses Zustand stores
import { useRef, useCallback, useEffect } from 'react'
import { VideoRecorderService } from '../services/mediaRecorder'
import { uploadVideoChunk } from '../services/apiClient'
import { RecordingState } from '../types'
import type { RecordingConfig } from '../types'
import { useRecordingStore, useSessionStore } from '../stores'

/**
 * Custom hook for managing MediaRecorder and video upload with stores
 */
export function useMediaRecorderWithStore(config: RecordingConfig) {
  const {
    state,
    setState,
    stream,
    setStream,
    sessionId,
    setSessionId,
    chunkIndex,
    setChunkIndex,
    incrementChunkIndex,
    setError,
    reset,
  } = useRecordingStore()

  const { addSession, updateSession } = useSessionStore()

  const recorderRef = useRef<VideoRecorderService | null>(null)
  const sessionIdRef = useRef<number | null>(null)
  const chunkIndexRef = useRef<number>(0)
  const lastChunkUploadRef = useRef<Promise<void> | null>(null)

  // Sync refs with store state
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    chunkIndexRef.current = chunkIndex
  }, [chunkIndex])

  // Initialize recorder service
  useEffect(() => {
    if (!recorderRef.current) {
      recorderRef.current = new VideoRecorderService()
    }

    return () => {
      if (recorderRef.current) {
        recorderRef.current.cleanup()
        recorderRef.current = null
      }
    }
  }, [])

  /**
   * Handle video chunk upload
   */
  const handleChunkUpload = useCallback(
    async (blob: Blob, duration: number, isLastChunk: boolean = false) => {
      const currentChunkIndex = chunkIndexRef.current
      const currentSessionId = sessionIdRef.current

      const uploadPromise = (async () => {
        try {
          console.log(`Uploading chunk ${currentChunkIndex}, sessionId=${currentSessionId}...`)

          const response = await uploadVideoChunk({
            file: blob,
            sessionId: currentSessionId || undefined,
            chunkIndex: currentChunkIndex,
            aiModel: config.aiModel,
            analysisMode: config.analysisMode,
            keepVideo: config.keepVideo,
            storageType: config.storageType,
            duration,
            isLastChunk,
          })

          // Update session ID from first chunk response
          if (!currentSessionId && response.sessionId) {
            setSessionId(response.sessionId)

            // Add session to store
            addSession({
              id: response.sessionId,
              userId: 0, // Will be set by backend from token
              status: 'RECORDING',
              aiModel: config.aiModel,
              analysisMode: config.analysisMode,
              keepVideo: config.keepVideo,
              startTime: new Date().toISOString(),
              totalChunks: 0,
              analyzedChunks: 0,
            })

            console.log('Session created:', response.sessionId)
          }

          // Increment chunk index
          incrementChunkIndex()

          // Update session with new chunk count
          if (response.sessionId) {
            updateSession(response.sessionId, {
              totalChunks: currentChunkIndex + 1,
            })
          }

          console.log(`Chunk ${currentChunkIndex} uploaded successfully to session ${response.sessionId}`)
        } catch (err) {
          console.error(`Failed to upload chunk ${currentChunkIndex}:`, err)
          setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      })()

      lastChunkUploadRef.current = uploadPromise
      return uploadPromise
    },
    [config, setSessionId, incrementChunkIndex, setError, addSession, updateSession]
  )

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    if (!recorderRef.current) {
      setError('Recorder not initialized')
      return
    }

    try {
      setState(RecordingState.REQUESTING_PERMISSION)

      // Request media stream
      const mediaStream = await recorderRef.current.requestCameraAccess()
      setStream(mediaStream)
      setState(RecordingState.READY)

      // Start recording
      recorderRef.current.startRecording({
        onDataAvailable: handleChunkUpload,
        onError: (error) => {
          console.error('Recording error:', error)
          setError(error.message)
          setState(RecordingState.ERROR)
        },
        onStop: () => {
          console.log('Recording stopped')
        }
      })
      setState(RecordingState.RECORDING)

      console.log('Recording started')
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError(err instanceof Error ? err.message : 'Failed to start recording')
      setState(RecordingState.ERROR)
    }
  }, [setState, setStream, setError, handleChunkUpload])

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return

    try {
      setState(RecordingState.STOPPED)

      // Stop the recorder (triggers final chunk upload with isLastChunk=true)
      await recorderRef.current.stopRecording()

      // Wait for the last chunk upload to complete
      if (lastChunkUploadRef.current) {
        await lastChunkUploadRef.current
      }

      // Update session status
      if (sessionId) {
        updateSession(sessionId, {
          status: 'ANALYZING',
          endTime: new Date().toISOString(),
        })
      }

      console.log('Recording stopped and finalized')

      // Cleanup
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
        setStream(null)
      }
    } catch (err) {
      console.error('Failed to stop recording:', err)
      setError(err instanceof Error ? err.message : 'Failed to stop recording')
    }
  }, [setState, sessionId, stream, setStream, setError, updateSession])

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (!recorderRef.current) return

    try {
      recorderRef.current.pauseRecording()
      setState(RecordingState.PAUSED)
      console.log('Recording paused')
    } catch (err) {
      console.error('Failed to pause recording:', err)
      setError(err instanceof Error ? err.message : 'Failed to pause recording')
    }
  }, [setState, setError])

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (!recorderRef.current) return

    try {
      recorderRef.current.resumeRecording()
      setState(RecordingState.RECORDING)
      console.log('Recording resumed')
    } catch (err) {
      console.error('Failed to resume recording:', err)
      setError(err instanceof Error ? err.message : 'Failed to resume recording')
    }
  }, [setState, setError])

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  }
}
