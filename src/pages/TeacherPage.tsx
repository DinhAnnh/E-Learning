import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from 'firebase/storage';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContent';
import { db, storage } from '../config/firebase';
import type {
  Assignment,
  Submission,
  SubmissionAttachment,
  Video,
} from '../types';

interface WatchProgressRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  videoId: string;
  videoTitle: string;
  watchTime: number;
  completed: boolean;
  lastWatchedAt: Date;
}

interface SummaryRow {
  userId: string;
  studentName: string;
  studentEmail: string;
  totalWatchTime: number;
  videosCompleted: number;
  assignmentsSubmitted: number;
  averageScore: number | null;
}

const toDate = (value: unknown): Date => {
  if (!value) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    // @ts-expect-error Firebase Timestamp
    return value.toDate();
  }
  return new Date(value as string);
};

const formatDuration = (seconds: number): string => {
  if (!seconds) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatWatchTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${mins}p`;
  }
  if (mins > 0) {
    return `${mins}p ${secs.toString().padStart(2, '0')}s`;
  }
  return `${secs}s`;
};

const buildSummary = (
  progress: WatchProgressRecord[],
  submissions: Submission[],
  days: number,
): SummaryRow[] => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  interface MutableSummary extends SummaryRow {
    totalScore: number;
    gradedCount: number;
  }

  const summaries = new Map<string, MutableSummary>();

  progress
    .filter((record) => record.lastWatchedAt >= start)
    .forEach((record) => {
      const existing = summaries.get(record.studentId) ?? {
        userId: record.studentId,
        studentName: record.studentName,
        studentEmail: record.studentEmail,
        totalWatchTime: 0,
        videosCompleted: 0,
        assignmentsSubmitted: 0,
        averageScore: null,
        totalScore: 0,
        gradedCount: 0,
      };

      existing.totalWatchTime += record.watchTime;
      if (record.completed) {
        existing.videosCompleted += 1;
      }
      summaries.set(record.studentId, existing);
    });

  submissions
    .filter((submission) => submission.submittedAt >= start)
    .forEach((submission) => {
      const existing = summaries.get(submission.studentId) ?? {
        userId: submission.studentId,
        studentName: submission.studentName,
        studentEmail: submission.studentEmail,
        totalWatchTime: 0,
        videosCompleted: 0,
        assignmentsSubmitted: 0,
        averageScore: null,
        totalScore: 0,
        gradedCount: 0,
      };

      existing.assignmentsSubmitted += 1;
      if (typeof submission.score === 'number') {
        existing.totalScore += submission.score;
        existing.gradedCount += 1;
      }

      summaries.set(submission.studentId, existing);
    });

  return Array.from(summaries.values()).map((summary) => ({
    userId: summary.userId,
    studentName: summary.studentName,
    studentEmail: summary.studentEmail,
    totalWatchTime: summary.totalWatchTime,
    videosCompleted: summary.videosCompleted,
    assignmentsSubmitted: summary.assignmentsSubmitted,
    averageScore:
      summary.gradedCount > 0
        ? parseFloat((summary.totalScore / summary.gradedCount).toFixed(2))
        : null,
  }));
};

const getVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';

    videoElement.onloadedmetadata = () => {
      window.URL.revokeObjectURL(videoElement.src);
      resolve(videoElement.duration || 0);
    };

    videoElement.onerror = () => {
      resolve(0);
    };

    videoElement.src = URL.createObjectURL(file);
  });

export const TeacherPage = () => {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [progressRecords, setProgressRecords] = useState<WatchProgressRecord[]>([]);

  const [uploadTask, setUploadTask] = useState<UploadTask | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [assignmentVideoId, setAssignmentVideoId] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDescription, setAssignmentDescription] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState('');

  const [gradingSubmission, setGradingSubmission] = useState<string | null>(null);
  const [gradingScore, setGradingScore] = useState('');
  const [gradingFeedback, setGradingFeedback] = useState('');

  const assignmentsLookup = useMemo(() => {
    const map = new Map<string, Assignment>();
    assignments.forEach((assignment) => {
      map.set(assignment.id, assignment);
    });
    return map;
  }, [assignments]);

  useEffect(() => {
    if (videos.length > 0 && !assignmentVideoId) {
      setAssignmentVideoId(videos[0].id);
    }
  }, [videos, assignmentVideoId]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const videosRef = collection(db, 'videos');
    const videosQuery = query(
      videosRef,
      where('teacherId', '==', currentUser.id),
      orderBy('uploadedAt', 'desc'),
    );

    const unsubscribe = onSnapshot(videosQuery, (snapshot) => {
      const fetchedVideos: Video[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.id ?? docSnap.id,
          title: data.title,
          description: data.description ?? '',
          url: data.url,
          thumbnailUrl: data.thumbnailUrl ?? undefined,
          duration: data.duration ?? 0,
          uploadedBy: data.uploadedBy ?? currentUser.id,
          uploadedAt: toDate(data.uploadedAt),
          courseId: data.courseId ?? undefined,
          teacherId: data.teacherId ?? currentUser.id,
        } satisfies Video;
      });
      setVideos(fetchedVideos);
    });

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const assignmentsRef = collection(db, 'assignments');
    const assignmentsQuery = query(
      assignmentsRef,
      where('teacherId', '==', currentUser.id),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(assignmentsQuery, (snapshot) => {
      const fetchedAssignments: Assignment[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.id ?? docSnap.id,
          videoId: data.videoId,
          title: data.title,
          description: data.description,
          dueDate: data.dueDate ? toDate(data.dueDate) : undefined,
          createdBy: data.createdBy,
          createdAt: toDate(data.createdAt),
          teacherId: data.teacherId ?? currentUser.id,
        } satisfies Assignment;
      });
      setAssignments(fetchedAssignments);
    });

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const submissionsRef = collection(db, 'submissions');
    const submissionsQuery = query(
      submissionsRef,
      where('teacherId', '==', currentUser.id),
      orderBy('submittedAt', 'desc'),
    );

    const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      const fetchedSubmissions: Submission[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.id ?? docSnap.id,
          assignmentId: data.assignmentId,
          studentId: data.studentId,
          content: data.content ?? '',
          audioUrl: data.audioUrl ?? undefined,
          audioStoragePath: data.audioStoragePath ?? undefined,
          attachments: Array.isArray(data.attachments)
            ? (data.attachments as SubmissionAttachment[])
            : undefined,
          submittedAt: toDate(data.submittedAt),
          score: typeof data.score === 'number' ? data.score : undefined,
          feedback: data.feedback ?? undefined,
          gradedBy: data.gradedBy ?? undefined,
          gradedAt: data.gradedAt ? toDate(data.gradedAt) : undefined,
          teacherId: data.teacherId,
          studentName: data.studentName ?? 'Học sinh',
          studentEmail: data.studentEmail ?? '',
        } satisfies Submission;
      });
      setSubmissions(fetchedSubmissions);
    });

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const progressRef = collection(db, 'watchProgress');
    const progressQuery = query(
      progressRef,
      where('teacherId', '==', currentUser.id),
    );

    const unsubscribe = onSnapshot(progressQuery, (snapshot) => {
      const records: WatchProgressRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.id ?? docSnap.id,
          studentId: data.studentId,
          studentName: data.studentName ?? 'Học sinh',
          studentEmail: data.studentEmail ?? '',
          videoId: data.videoId,
          videoTitle: data.videoTitle ?? '',
          watchTime: data.watchTime ?? 0,
          completed: Boolean(data.completed),
          lastWatchedAt: toDate(data.lastWatchedAt),
        } satisfies WatchProgressRecord;
      });
      setProgressRecords(records);
    });

    return unsubscribe;
  }, [currentUser]);

  const weeklySummary = useMemo(
    () => buildSummary(progressRecords, submissions, 7),
    [progressRecords, submissions],
  );

  const monthlySummary = useMemo(
    () => buildSummary(progressRecords, submissions, 30),
    [progressRecords, submissions],
  );

  const resetVideoForm = () => {
    setVideoTitle('');
    setVideoDescription('');
    setVideoFile(null);
    setUploadProgress(0);
    if (uploadTask) {
      if (uploadTask.snapshot.state === 'running') {
        uploadTask.cancel();
      }
      setUploadTask(null);
    }
  };

  const handleUploadVideo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUser || !videoFile || !videoTitle.trim()) {
      alert('Vui lòng nhập đầy đủ thông tin video và chọn tệp.');
      return;
    }

    try {
      const duration = await getVideoDuration(videoFile).catch(() => 0);
      const storagePath = `videos/${currentUser.id}/${Date.now()}-${videoFile.name}`;
      const storageRef = ref(storage, storagePath);
      const task = uploadBytesResumable(storageRef, videoFile);
      setUploadTask(task);

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snapshot) => {
            setUploadProgress(
              Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            );
          },
          (error) => {
            reject(error);
          },
          () => {
            resolve();
          },
        );
      });

      const downloadUrl = await getDownloadURL(task.snapshot.ref);
      const videoDocRef = doc(collection(db, 'videos'));

      await setDoc(videoDocRef, {
        id: videoDocRef.id,
        title: videoTitle,
        description: videoDescription,
        url: downloadUrl,
        duration: Math.round(duration),
        uploadedBy: currentUser.id,
        uploadedAt: serverTimestamp(),
        teacherId: currentUser.id,
        storagePath,
      });

      alert('Tải lên video thành công!');
      setUploadTask(null);
      setUploadProgress(0);
      resetVideoForm();
    } catch (error) {
      console.error('Upload video failed', error);
      alert('Không thể tải lên video. Vui lòng thử lại.');
    }
  };

  const handleCreateAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUser || !assignmentVideoId || !assignmentTitle.trim()) {
      alert('Vui lòng chọn video và nhập tiêu đề bài tập.');
      return;
    }

    const selectedVideo = videos.find((video) => video.id === assignmentVideoId);
    if (!selectedVideo) {
      alert('Video được chọn không tồn tại.');
      return;
    }

    try {
      const assignmentDocRef = await addDoc(collection(db, 'assignments'), {
        videoId: assignmentVideoId,
        title: assignmentTitle,
        description: assignmentDescription,
        dueDate: assignmentDueDate
          ? Timestamp.fromDate(new Date(assignmentDueDate))
          : null,
        createdBy: currentUser.id,
        createdAt: serverTimestamp(),
        teacherId: currentUser.id,
        videoTitle: selectedVideo.title,
      });

      await updateDoc(assignmentDocRef, { id: assignmentDocRef.id });

      alert('Đã tạo bài tập mới thành công!');
      setAssignmentTitle('');
      setAssignmentDescription('');
      setAssignmentDueDate('');
    } catch (error) {
      console.error('Create assignment failed', error);
      alert('Không thể tạo bài tập. Vui lòng thử lại.');
    }
  };

  const handleOpenGrading = (submission: Submission) => {
    setGradingSubmission(submission.id);
    setGradingScore(
      submission.score !== undefined ? submission.score.toString() : '',
    );
    setGradingFeedback(submission.feedback ?? '');
  };

  const handleGradeSubmission = async () => {
    if (!currentUser || !gradingSubmission) {
      return;
    }

    const numericScore = parseFloat(gradingScore);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 10) {
      alert('Điểm phải nằm trong khoảng 0-10.');
      return;
    }

    try {
      const submissionDocRef = doc(db, 'submissions', gradingSubmission);
      await updateDoc(submissionDocRef, {
        score: numericScore,
        feedback: gradingFeedback,
        gradedAt: serverTimestamp(),
        gradedBy: currentUser.id,
      });

      alert('Đã lưu điểm và nhận xét.');
      setGradingSubmission(null);
      setGradingScore('');
      setGradingFeedback('');
    } catch (error) {
      console.error('Failed to grade submission', error);
      alert('Không thể lưu điểm. Vui lòng thử lại.');
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50">
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
                <p className="text-sm text-gray-600">Giáo viên: {currentUser.name}</p>
              </div>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg text-gray-600 font-semibold">
              {currentUser.email}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tải lên video mới</h2>
          <form className="space-y-4" onSubmit={handleUploadVideo}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tiêu đề video
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(event) => setVideoTitle(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition"
                  placeholder="Nhập tiêu đề"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tệp video
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mô tả
              </label>
              <textarea
                value={videoDescription}
                onChange={(event) => setVideoDescription(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition resize-none"
                rows={3}
                placeholder="Mô tả nội dung video..."
              />
            </div>
            {uploadTask && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Đang tải lên...</span>
                  <span className="font-semibold text-green-600">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-teal-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={resetVideoForm}
                className="px-6 py-3 rounded-xl bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition"
              >
                Xóa thông tin
              </button>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-60"
                disabled={!videoFile || !videoTitle.trim()}
              >
                Tải lên video
              </button>
            </div>
          </form>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tạo bài tập cho học sinh</h2>
          <form className="space-y-4" onSubmit={handleCreateAssignment}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chọn video
                </label>
                <select
                  value={assignmentVideoId}
                  onChange={(event) => setAssignmentVideoId(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition"
                >
                  <option value="">-- Chọn video --</option>
                  {videos.map((video) => (
                    <option key={video.id} value={video.id}>
                      {video.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Hạn nộp (tùy chọn)
                </label>
                <input
                  type="date"
                  value={assignmentDueDate}
                  onChange={(event) => setAssignmentDueDate(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tiêu đề bài tập
              </label>
              <input
                type="text"
                value={assignmentTitle}
                onChange={(event) => setAssignmentTitle(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition"
                placeholder="Nhập tiêu đề bài tập"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nội dung yêu cầu
              </label>
              <textarea
                value={assignmentDescription}
                onChange={(event) => setAssignmentDescription(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition resize-none"
                rows={4}
                placeholder="Mô tả chi tiết yêu cầu bài tập..."
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-teal-600 text-white font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-60"
                disabled={!assignmentVideoId || !assignmentTitle.trim()}
              >
                Tạo bài tập
              </button>
            </div>
          </form>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="px-8 py-6 bg-gradient-to-r from-green-500 to-teal-600">
            <h2 className="text-2xl font-bold text-white">Danh sách video đã tải lên</h2>
          </div>
          {videos.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              Bạn chưa tải lên video nào.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{video.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Tải lên: {video.uploadedAt.toLocaleString('vi-VN')}
                    </p>
                    {video.description && (
                      <p className="text-sm text-gray-600 mt-2 max-w-2xl">
                        {video.description}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Thời lượng: {formatDuration(video.duration)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Bài tập học sinh đã nộp</h2>
          {submissions.length === 0 ? (
            <div className="text-center text-gray-600">
              Chưa có bài nộp nào.
            </div>
          ) : (
            <div className="space-y-6">
              {submissions.map((submission) => (
                <motion.div
                  key={submission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-gray-100 rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {assignmentsLookup.get(submission.assignmentId)?.title ?? 'Bài tập'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Học sinh: {submission.studentName} ({submission.studentEmail})
                      </p>
                      {assignmentsLookup.get(submission.assignmentId)?.dueDate && (
                        <p className="text-xs text-gray-500">
                          Hạn nộp: {assignmentsLookup
                            .get(submission.assignmentId)!
                            .dueDate!.toLocaleDateString('vi-VN')}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Nộp lúc: {submission.submittedAt.toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="text-sm text-gray-600">
                      {submission.score !== undefined ? (
                        <p className="font-semibold text-green-600">
                          Điểm: {submission.score.toFixed(1)}
                        </p>
                      ) : (
                        <p className="text-yellow-600 font-semibold">Chưa chấm</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-5 mb-4">
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                      {submission.content || 'Học sinh không nhập nội dung văn bản.'}
                    </p>
                  </div>

                  {submission.attachments && submission.attachments.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-800 mb-2">
                        Tệp đính kèm:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {submission.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828M8 17l9-9" />
                            </svg>
                            {attachment.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {submission.audioUrl && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-800 mb-2">Ghi âm:</p>
                      <audio controls src={submission.audioUrl} className="w-full" />
                    </div>
                  )}

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
                          value={gradingScore}
                          onChange={(event) => setGradingScore(event.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nhận xét
                        </label>
                        <textarea
                          value={gradingFeedback}
                          onChange={(event) => setGradingFeedback(event.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none resize-none"
                          rows={4}
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleGradeSubmission}
                          className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition"
                        >
                          Lưu điểm
                        </button>
                        <button
                          onClick={() => {
                            setGradingSubmission(null);
                            setGradingScore('');
                            setGradingFeedback('');
                          }}
                          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenGrading(submission)}
                      className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold shadow-lg transition"
                    >
                      {submission.score !== undefined ? 'Cập nhật điểm' : 'Chấm điểm'}
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid gap-6 md:grid-cols-2"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tổng kết tuần</h2>
            {weeklySummary.length === 0 ? (
              <p className="text-sm text-gray-600">Chưa có dữ liệu trong tuần này.</p>
            ) : (
              <div className="space-y-4">
                {weeklySummary.map((summary) => (
                  <div key={`${summary.userId}-week`} className="border border-gray-100 rounded-xl p-4">
                    <p className="font-semibold text-gray-900">{summary.studentName}</p>
                    <p className="text-xs text-gray-500 mb-2">{summary.studentEmail}</p>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Thời gian học: {formatWatchTime(summary.totalWatchTime)}</p>
                      <p>Video hoàn thành: {summary.videosCompleted}</p>
                      <p>Bài nộp: {summary.assignmentsSubmitted}</p>
                      <p>
                        Điểm trung bình:{' '}
                        {summary.averageScore !== null ? summary.averageScore : 'Chưa có'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tổng kết tháng</h2>
            {monthlySummary.length === 0 ? (
              <p className="text-sm text-gray-600">Chưa có dữ liệu trong tháng này.</p>
            ) : (
              <div className="space-y-4">
                {monthlySummary.map((summary) => (
                  <div key={`${summary.userId}-month`} className="border border-gray-100 rounded-xl p-4">
                    <p className="font-semibold text-gray-900">{summary.studentName}</p>
                    <p className="text-xs text-gray-500 mb-2">{summary.studentEmail}</p>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Thời gian học: {formatWatchTime(summary.totalWatchTime)}</p>
                      <p>Video hoàn thành: {summary.videosCompleted}</p>
                      <p>Bài nộp: {summary.assignmentsSubmitted}</p>
                      <p>
                        Điểm trung bình:{' '}
                        {summary.averageScore !== null ? summary.averageScore : 'Chưa có'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
};
