import { useState } from 'react';
import { motion } from 'framer-motion';

// Mock data
const mockStudents = [
  {
    id: '1',
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@email.com',
    totalWatchTime: 7200, // 2 hours in seconds
    videosCompleted: 5,
    assignmentsSubmitted: 4,
    averageScore: 8.5,
  },
  {
    id: '2',
    name: 'Trần Thị B',
    email: 'tranthib@email.com',
    totalWatchTime: 10800, // 3 hours
    videosCompleted: 7,
    assignmentsSubmitted: 6,
    averageScore: 9.2,
  },
  {
    id: '3',
    name: 'Lê Văn C',
    email: 'levanc@email.com',
    totalWatchTime: 5400, // 1.5 hours
    videosCompleted: 3,
    assignmentsSubmitted: 3,
    averageScore: 7.8,
  },
];

const mockSubmissions = [
  {
    id: 's1',
    studentName: 'Nguyễn Văn A',
    assignmentTitle: 'Bài tập: React Components',
    content: 'React Components là những khối xây dựng cơ bản của ứng dụng React...',
    submittedAt: new Date('2025-11-09T10:30:00'),
    score: null,
    feedback: null,
  },
  {
    id: 's2',
    studentName: 'Trần Thị B',
    assignmentTitle: 'Bài tập: React Components',
    content: 'Components giúp chia nhỏ giao diện thành các phần có thể tái sử dụng...',
    submittedAt: new Date('2025-11-09T14:20:00'),
    score: null,
    feedback: null,
  },
];

export const TeacherPage = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'submissions'>('students');
  const [gradingSubmission, setGradingSubmission] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}p`;
  };

  const handleGrade = (submissionId: string) => {
    console.log('Grading submission:', { submissionId, score, feedback });
    // TODO: Save to Firebase
    alert('Đã chấm điểm thành công!');
    setGradingSubmission(null);
    setScore('');
    setFeedback('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">E-Learning Academy</h1>
                <p className="text-sm text-gray-600">Giáo viên</p>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'students'
                ? 'bg-white text-green-600 shadow-lg'
                : 'text-gray-600 hover:bg-white/50'
            }`}
          >
            Danh sách học sinh
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'submissions'
                ? 'bg-white text-green-600 shadow-lg'
                : 'text-gray-600 hover:bg-white/50'
            }`}
          >
            Bài tập chờ chấm
          </button>
        </div>

        {/* Students list */}
        {activeTab === 'students' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-green-500 to-teal-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Học sinh</th>
                    <th className="px-6 py-4 text-left font-semibold">Thời gian học</th>
                    <th className="px-6 py-4 text-left font-semibold">Video hoàn thành</th>
                    <th className="px-6 py-4 text-left font-semibold">Bài nộp</th>
                    <th className="px-6 py-4 text-left font-semibold">Điểm TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mockStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{student.name}</p>
                          <p className="text-sm text-gray-500">{student.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{formatTime(student.totalWatchTime)}</td>
                      <td className="px-6 py-4 text-gray-700">{student.videosCompleted}</td>
                      <td className="px-6 py-4 text-gray-700">{student.assignmentsSubmitted}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          student.averageScore >= 9 ? 'bg-green-100 text-green-700' :
                          student.averageScore >= 8 ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {student.averageScore.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Submissions list */}
        {activeTab === 'submissions' && (
          <div className="space-y-6">
            {mockSubmissions.map((submission) => (
              <motion.div
                key={submission.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-xl p-8"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{submission.assignmentTitle}</h3>
                    <p className="text-gray-600">Học sinh: {submission.studentName}</p>
                    <p className="text-sm text-gray-500">
                      Nộp lúc: {submission.submittedAt.toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <p className="text-gray-700 leading-relaxed">{submission.content}</p>
                </div>

                {gradingSubmission === submission.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Điểm (0-10)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                        placeholder="Nhập điểm..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nhận xét
                      </label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none resize-none"
                        rows={4}
                        placeholder="Nhập nhận xét..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleGrade(submission.id)}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition"
                      >
                        Lưu điểm
                      </button>
                      <button
                        onClick={() => {
                          setGradingSubmission(null);
                          setScore('');
                          setFeedback('');
                        }}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setGradingSubmission(submission.id)}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold shadow-lg transition"
                  >
                    Chấm điểm
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
