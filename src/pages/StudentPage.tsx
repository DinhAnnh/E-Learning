import { useState } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { Assignment } from '../components/Assignment';

// Mock data
const mockVideo = {
  id: 'video-1',
  title: 'Bài 1: Giới thiệu về React',
  description: 'Tìm hiểu về React - thư viện JavaScript phổ biến cho xây dựng giao diện người dùng',
  url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  duration: 596,
};

const mockAssignment = {
  id: 'assignment-1',
  title: 'Bài tập: Giải thích về React Components',
  description: 'Hãy giải thích bằng lời của bạn về React Components là gì và tại sao chúng quan trọng. Bạn có thể viết câu trả lời hoặc ghi âm.',
};

export const StudentPage = () => {
  const [watchTime, setWatchTime] = useState(0);

  const handleProgressUpdate = (time: number) => {
    setWatchTime(time);
    // TODO: Save to Firebase
    console.log('Watch time updated:', time);
  };

  const handleSubmitAssignment = (content: string, audioBlob?: Blob) => {
    console.log('Assignment submitted:', { content, hasAudio: !!audioBlob });
    // TODO: Upload to Firebase Storage and save to Firestore
    alert('Bài tập đã được nộp thành công!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">E-Learning Academy</h1>
                <p className="text-sm text-gray-600">Học sinh</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-green-700">
                  {Math.floor(watchTime / 60)}p {watchTime % 60}s
                </span>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Video info */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{mockVideo.title}</h2>
          <p className="text-gray-600 text-lg">{mockVideo.description}</p>
        </div>

        {/* Video player */}
        <div className="mb-8">
          <VideoPlayer
            videoUrl={mockVideo.url}
            videoId={mockVideo.id}
            onProgressUpdate={handleProgressUpdate}
          />
        </div>

        {/* Assignment */}
        <div>
          <Assignment
            assignmentId={mockAssignment.id}
            title={mockAssignment.title}
            description={mockAssignment.description}
            onSubmit={handleSubmitAssignment}
          />
        </div>
      </main>
    </div>
  );
};
