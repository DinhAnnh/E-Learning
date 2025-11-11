import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { VideoPlayer } from '../components/VideoPlayer';
import {
  Assignment as AssignmentComponent,
  type AssignmentSubmissionPayload,
} from '../components/Assignment';
import { useAuth } from '../contexts/AuthContent';
import { db, storage } from '../config/firebase';
import type {
  Assignment,
  Submission,
  SubmissionAttachment,
  Video,
} from '../types';

interface AssignmentSubmissionMap {
  [assignmentId: string]: Submission;
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

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

export const StudentPage = () => {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmissionMap>({});
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [storedWatchTime, setStoredWatchTime] = useState(0);
  const [currentWatchTime, setCurrentWatchTime] = useState(0);
  const [submittingAssignments, setSubmittingAssignments] = useState<Record<string, boolean>>({});
  const lastSyncedWatchTimeRef = useRef(0);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const videosRef = collection(db, 'videos');
    const videosQuery = query(videosRef, orderBy('uploadedAt', 'desc'));

    const unsubscribe = onSnapshot(videosQuery, (snapshot) => {
      const fetchedVideos: Video[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.id ?? docSnap.id,
          title: data.title ?? 'Video học tập',
          description: data.description ?? '',
          url: data.url,
          thumbnailUrl: data.thumbnailUrl ?? undefined,
          duration: data.duration ?? 0,
          uploadedBy: data.uploadedBy ?? data.teacherId ?? '',
          uploadedAt: toDate(data.uploadedAt),
          courseId: data.courseId ?? undefined,
          teacherId: data.teacherId ?? data.uploadedBy ?? '',
        } satisfies Video;
      });

      setVideos(fetchedVideos);
      setLoadingVideos(false);

      if (fetchedVideos.length > 0) {
        const isCurrentVideoAvailable = fetchedVideos.some(
          (video) => video.id === selectedVideoId,
        );
        if (!selectedVideoId || !isCurrentVideoAvailable) {
          setSelectedVideoId(fetchedVideos[0].id);
        }
      }
    });

    return unsubscribe;
  }, [currentUser, selectedVideoId]);

  useEffect(() => {
    if (!selectedVideoId) {
      setAssignments([]);
      setLoadingAssignments(false);
      return;
    }

    const assignmentsRef = collection(db, 'assignments');
    const assignmentsQuery = query(
      assignmentsRef,
      where('videoId', '==', selectedVideoId),
      orderBy('createdAt', 'asc'),
    );

    setLoadingAssignments(true);

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
          teacherId: data.teacherId ?? data.createdBy,
        } satisfies Assignment;
      });

      setAssignments(fetchedAssignments);
      setLoadingAssignments(false);
    });

    return unsubscribe;
  }, [selectedVideoId]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const submissionsRef = collection(db, 'submissions');
    const submissionsQuery = query(
      submissionsRef,
      where('studentId', '==', currentUser.id),
      orderBy('submittedAt', 'desc'),
    );

    const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      const submissionByAssignment: AssignmentSubmissionMap = {};

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        submissionByAssignment[data.assignmentId] = {
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
          studentName: data.studentName ?? currentUser.name,
          studentEmail: data.studentEmail ?? currentUser.email,
        } satisfies Submission;
      });

      setSubmissions(submissionByAssignment);
    });

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !selectedVideoId) {
      setStoredWatchTime(0);
      setCurrentWatchTime(0);
      return;
    }

    const progressDocRef = doc(
      db,
      'watchProgress',
      `${currentUser.id}_${selectedVideoId}`,
    );

    const unsubscribe = onSnapshot(progressDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const time = data.watchTime ?? 0;
        setStoredWatchTime(time);
        setCurrentWatchTime(time);
        lastSyncedWatchTimeRef.current = time;
      } else {
        setStoredWatchTime(0);
        setCurrentWatchTime(0);
        lastSyncedWatchTimeRef.current = 0;
      }
    });

    return unsubscribe;
  }, [currentUser, selectedVideoId]);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? null,
    [videos, selectedVideoId],
  );

  const saveProgress = useCallback(
    async (watchTime: number) => {
      if (!currentUser || !selectedVideo) {
        return;
      }

      const progressDocRef = doc(
        db,
        'watchProgress',
        `${currentUser.id}_${selectedVideo.id}`,
      );

      try {
        await setDoc(
          progressDocRef,
          {
            id: `${currentUser.id}_${selectedVideo.id}`,
            studentId: currentUser.id,
            studentName: currentUser.name,
            studentEmail: currentUser.email,
            videoId: selectedVideo.id,
            videoTitle: selectedVideo.title,
            teacherId: selectedVideo.teacherId,
            watchTime,
            completed:
              selectedVideo.duration > 0
                ? watchTime >= selectedVideo.duration
                : false,
            lastWatchedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (error) {
        console.error('Failed to save watch progress', error);
      }
    },
    [currentUser, selectedVideo],
  );

  const handleProgressUpdate = useCallback(
    (time: number) => {
      setCurrentWatchTime(time);
      if (!currentUser || !selectedVideo) {
        return;
      }

      if (time - lastSyncedWatchTimeRef.current < 5) {
        return;
      }

      lastSyncedWatchTimeRef.current = time;
      void saveProgress(time);
    },
    [currentUser, saveProgress, selectedVideo],
  );

  const handleSubmitAssignment = useCallback(
    async (assignmentId: string, payload: AssignmentSubmissionPayload) => {
      if (!currentUser) {
        return;
      }

      const assignment = assignments.find((item) => item.id === assignmentId);
      if (!assignment) {
        alert('Không tìm thấy thông tin bài tập.');
        return;
      }

      setSubmittingAssignments((prev) => ({ ...prev, [assignmentId]: true }));

      const submissionDocRef = doc(collection(db, 'submissions'));
      const attachments: SubmissionAttachment[] = [];

      try {
        for (const file of payload.files) {
          const attachmentId = createId();
          const storagePath = `submissions/${assignmentId}/${currentUser.id}/${submissionDocRef.id}/${file.name}`;
          const fileRef = ref(storage, storagePath);
          await uploadBytes(fileRef, file);
          const downloadUrl = await getDownloadURL(fileRef);
          attachments.push({
            id: attachmentId,
            name: file.name,
            downloadUrl,
            contentType: file.type,
            size: file.size,
          });
        }

        let audioUrl: string | undefined;
        let audioStoragePath: string | undefined;
        if (payload.audioBlob) {
          const audioPath = `submissions/${assignmentId}/${currentUser.id}/${submissionDocRef.id}/${
            payload.audioFileName ?? `audio-${Date.now()}.webm`
          }`;
          const audioRef = ref(storage, audioPath);
          await uploadBytes(audioRef, payload.audioBlob, {
            contentType: 'audio/webm',
          });
          audioUrl = await getDownloadURL(audioRef);
          audioStoragePath = audioPath;
        }

        await setDoc(submissionDocRef, {
          id: submissionDocRef.id,
          assignmentId,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentEmail: currentUser.email,
          content: payload.content,
          attachments,
          audioUrl,
          audioStoragePath,
          submittedAt: serverTimestamp(),
          teacherId: assignment.teacherId,
        });

        alert('Bài tập đã được nộp thành công!');
      } catch (error) {
        console.error('Failed to submit assignment', error);
        alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.');
      } finally {
        setSubmittingAssignments((prev) => ({ ...prev, [assignmentId]: false }));
      }
    },
    [assignments, currentUser],
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}p ${secs.toString().padStart(2, '0')}s`;
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
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
                <p className="text-sm text-gray-600">Học sinh: {currentUser.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-green-700">
                  {formatTime(currentWatchTime)}
                </span>
              </div>
              <div className="p-2 bg-gray-100 rounded-lg text-gray-600 font-semibold">
                {currentUser.email}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {loadingVideos ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-600">
            Đang tải danh sách bài học...
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-600">
            Hiện chưa có video học tập nào. Vui lòng quay lại sau.
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[320px,1fr]">
            <aside className="space-y-4">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Danh sách bài học
                </h2>
                <div className="space-y-3">
                  {videos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => setSelectedVideoId(video.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        video.id === selectedVideoId
                          ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-md'
                          : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <p className="font-semibold">{video.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Cập nhật: {video.uploadedAt.toLocaleDateString('vi-VN')}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Tiến độ học tập</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Thời gian đã học: <span className="font-semibold">{formatTime(storedWatchTime)}</span>
                </p>
                {selectedVideo?.duration ? (
                  <p className="text-sm text-gray-600">
                    Hoàn thành: <span className="font-semibold">{Math.min(100, Math.round((storedWatchTime / selectedVideo.duration) * 100))}%</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    Video chưa có thông tin thời lượng. Vui lòng xem đến hết bài để được tính hoàn thành.
                  </p>
                )}
              </div>
            </aside>

            <section className="space-y-8">
              {selectedVideo && (
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">
                    {selectedVideo.title}
                  </h2>
                  {selectedVideo.description && (
                    <p className="text-gray-600 text-lg mb-6">
                      {selectedVideo.description}
                    </p>
                  )}
                  <VideoPlayer
                    videoUrl={selectedVideo.url}
                    videoId={selectedVideo.id}
                    initialWatchTime={storedWatchTime}
                    onProgressUpdate={handleProgressUpdate}
                  />
                </div>
              )}

              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-gray-900">Bài tập</h3>
                {loadingAssignments ? (
                  <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-600">
                    Đang tải bài tập...
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-600">
                    Chưa có bài tập cho video này. Hãy hoàn thành việc xem video để cập nhật mới nhất.
                  </div>
                ) : (
                  assignments.map((assignment) => (
                    <AssignmentComponent
                      key={assignment.id}
                      assignmentId={assignment.id}
                      title={assignment.title}
                      description={assignment.description}
                      onSubmit={(payload) => handleSubmitAssignment(assignment.id, payload)}
                      isSubmitting={submittingAssignments[assignment.id] ?? false}
                      existingSubmission={submissions[assignment.id] ?? null}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
