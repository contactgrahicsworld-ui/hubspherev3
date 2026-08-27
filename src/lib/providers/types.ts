/**
 * Provider abstraction interfaces.
 * Every provider must implement these interfaces.
 * TypeScript interfaces only (no implementations in Phase 1).
 */

export type ProviderStatus =
  | 'CONFIGURED'
  | 'NOT_CONFIGURED'
  | 'HEALTHY'
  | 'UNHEALTHY'
  | 'DISABLED';

export interface ProviderInfo {
  providerId: string;
  providerName: string;
  category: string;
  capabilities: string[];
  status: ProviderStatus;
  priority: number;
  lastCheckAt?: Date;
}

// ============================================
// AI PROVIDER
// ============================================

export interface AIResponse {
  content: string;
  model: string;
  providerId: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  getInfo(): ProviderInfo;
  chatCompletion(prompt: string, context?: Record<string, unknown>): Promise<AIResponse>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// SPEECH-TO-TEXT PROVIDER
// ============================================

export interface TranscriptionResult {
  text: string;
  confidence: number;
  providerId: string;
  language?: string;
}

export interface SpeechToTextProvider {
  getInfo(): ProviderInfo;
  transcribe(audioBuffer: ArrayBuffer, options?: Record<string, unknown>): Promise<TranscriptionResult>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// TEXT-TO-SPEECH PROVIDER
// ============================================

export interface TTSResult {
  audioBuffer: ArrayBuffer;
  format: string;
  providerId: string;
}

export interface TextToSpeechProvider {
  getInfo(): ProviderInfo;
  synthesize(text: string, options?: Record<string, unknown>): Promise<TTSResult>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// TRANSLATION PROVIDER
// ============================================

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  providerId: string;
}

export interface TranslationProvider {
  getInfo(): ProviderInfo;
  translate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResult>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// TELEPHONY PROVIDER
// ============================================

export interface CallResult {
  callId: string;
  status: string;
  providerId: string;
}

export interface CallStatusResult {
  callId: string;
  status: string;
  duration?: number;
  recordingUrl?: string;
}

export interface TelephonyProvider {
  getInfo(): ProviderInfo;
  initiateCall(to: string, from?: string): Promise<CallResult>;
  endCall(callId: string): Promise<void>;
  getCallStatus(callId: string): Promise<CallStatusResult>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// CALL RECORDING PROVIDER
// ============================================

export interface RecordingResult {
  recordingId: string;
  url?: string;
  status: string;
  providerId: string;
}

export interface CallRecordingProvider {
  getInfo(): ProviderInfo;
  startRecording(callId: string): Promise<void>;
  stopRecording(callId: string): Promise<RecordingResult>;
  getRecordingStatus(callId: string): Promise<string>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// MESSAGING PROVIDER
// ============================================

export interface MessageResult {
  messageId: string;
  status: string;
  providerId: string;
}

export interface MessagingProvider {
  getInfo(): ProviderInfo;
  sendMessage(
    to: string,
    message: string,
    channel: 'whatsapp' | 'sms' | 'email'
  ): Promise<MessageResult>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// STORAGE PROVIDER
// ============================================

export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  private?: boolean;
}

export interface StorageUploadResult {
  key: string;
  url?: string;
  size: number;
  providerId: string;
}

export interface StorageProvider {
  getInfo(): ProviderInfo;
  upload(key: string, data: Buffer, options?: StorageUploadOptions): Promise<StorageUploadResult>;
  download(key: string): Promise<Buffer>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// NOTIFICATION PROVIDER
// ============================================

export interface NotificationResult {
  notificationId: string;
  status: string;
  providerId: string;
}

export interface NotificationProvider {
  getInfo(): ProviderInfo;
  send(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<NotificationResult>;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

// ============================================
// UNION TYPE (for registry getProvider return)
// ============================================

export interface BaseProvider {
  getInfo(): ProviderInfo;
  isConfigured(): boolean;
  healthCheck(): Promise<boolean>;
}

export type AnyProvider =
  | AIProvider
  | SpeechToTextProvider
  | TextToSpeechProvider
  | TranslationProvider
  | TelephonyProvider
  | CallRecordingProvider
  | MessagingProvider
  | StorageProvider
  | NotificationProvider;
