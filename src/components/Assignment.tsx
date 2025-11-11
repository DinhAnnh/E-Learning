import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { SubmissionAttachment } from '../types';

export interface AssignmentSubmissionPayload {
  content: string;
  files: File[];
  audioBlob?: Blob;
  audioFileName?: string;
}

interface AssignmentProps {
  assignmentId: string;
  title: string;
  description: string;
  onSubmit: (payload: AssignmentSubmissionPayload) => void;
  isSubmitting?: boolean;
  existingSubmission?: {
    submittedAt: Date;
    score?: number;
    feedback?: string;
    attachments?: SubmissionAttachment[];
    audioUrl?: string;
  } | null;
}

export const Assignment: React.FC<AssignmentProps> = ({
  assignmentId,
  title,
  description,
  onSubmit,
  isSubmitting = false,
  existingSubmission,
}) => {
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `recording-${new Date().toISOString()}.webm`;
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAudioFileName(fileName);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioFileName(null);
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((file) => file.name));
      const merged = [...prev];
      files.forEach((file) => {
        if (!existingNames.has(file.name)) {
          merged.push(file);
        }
      });
      return merged;
    });
    event.target.value = '';
  };

  const removeFile = (fileName: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.name !== fileName));
  };

  const handleSubmit = () => {
    if (!content.trim() && !audioBlob && selectedFiles.length === 0) {
      alert('Vui lòng nhập nội dung, tải tệp hoặc ghi âm trả lời');
      return;
    }

    onSubmit({
      content,
      files: selectedFiles,
      audioBlob: audioBlob || undefined,
      audioFileName: audioFileName ?? undefined,
    });

    // Reset form
    setContent('');
    deleteRecording();
    setSelectedFiles([]);
  };

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Text input */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Câu trả lời của bạn
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition resize-none"
          rows={6}
          placeholder="Nhập câu trả lời của bạn..."
        />
      </div>

      {/* File upload */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Tệp đính kèm (tùy chọn)
        </label>
        <div className="flex flex-col gap-4">
          <label
            htmlFor={`assignment-${assignmentId}-files`}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white border-2 border-dashed border-blue-200 rounded-xl text-blue-600 font-semibold cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828M8 17l9-9" />
            </svg>
            Chọn tệp tải lên
            <input
              id={`assignment-${assignmentId}-files`}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
          </label>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              {selectedFiles.map((file) => (
                <div
                  key={`${file.name}-${file.lastModified}`}
                  className="flex items-center justify-between px-4 py-2 bg-blue-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-semibold text-blue-700">{file.name}</p>
                    <p className="text-xs text-blue-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={() => removeFile(file.name)}
                    className="p-2 rounded-full hover:bg-blue-100 text-blue-600"
                    title="Xóa tệp"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audio recording */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Ghi âm trả lời (tùy chọn)
        </label>

        <div className="flex items-center gap-3 flex-wrap">
          {!isRecording && !audioBlob && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold shadow-lg transition-all duration-300 hover:scale-105"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Bắt đầu ghi âm
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-full font-semibold shadow-lg transition-all duration-300 animate-pulse"
            >
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              Dừng ghi âm
            </button>
          )}

          {audioBlob && audioUrl && (
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <audio src={audioUrl} controls className="flex-1 h-12 rounded-lg" />
              <button
                onClick={deleteRecording}
                className="p-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition"
                title="Xóa ghi âm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {existingSubmission && (
        <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6">
          <h4 className="text-lg font-semibold text-green-800 mb-3">Bài nộp gần nhất</h4>
          <p className="text-sm text-green-700 mb-2">
            Đã nộp lúc: {existingSubmission.submittedAt.toLocaleString('vi-VN')}
          </p>
          {existingSubmission.score !== undefined && (
            <p className="text-sm text-green-700 mb-2">Điểm: {existingSubmission.score.toFixed(1)}</p>
          )}
          {existingSubmission.feedback && (
            <p className="text-sm text-green-700 mb-3">Nhận xét: {existingSubmission.feedback}</p>
          )}
          {existingSubmission.attachments && existingSubmission.attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-green-800">Tệp đã nộp:</p>
              {existingSubmission.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {attachment.name}
                </a>
              ))}
            </div>
          )}
          {existingSubmission.audioUrl && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-green-800 mb-2">Ghi âm đã nộp:</p>
              <audio src={existingSubmission.audioUrl} controls className="w-full" />
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full font-bold shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
        </button>
      </div>
    </motion.div>
  );
};
