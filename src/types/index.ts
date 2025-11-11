// User roles
export type UserRole = 'student' | 'teacher' | 'admin';

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

// Video interface
export interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl?: string;
  duration: number; // in seconds
  uploadedBy: string; // user ID
  uploadedAt: Date;
  courseId?: string;
}

// Learning progress
export interface LearningProgress {
  id: string;
  userId: string;
  videoId: string;
  watchTime: number; // in seconds
  completed: boolean;
  lastWatchedAt: Date;
}

// Assignment
export interface Assignment {
  id: string;
  videoId: string;
  title: string;
  description: string;
  dueDate?: Date;
  createdBy: string; // teacher ID
  createdAt: Date;
}

// Student submission
export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string;
  audioUrl?: string; // URL to audio recording
  submittedAt: Date;
  score?: number;
  feedback?: string;
  gradedBy?: string; // teacher ID
  gradedAt?: Date;
}

// Weekly/Monthly stats
export interface StudentStats {
  userId: string;
  period: 'week' | 'month';
  startDate: Date;
  endDate: Date;
  totalWatchTime: number; // in seconds
  videosCompleted: number;
  assignmentsSubmitted: number;
  averageScore?: number;
}

// Course (optional grouping)
export interface Course {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  createdAt: Date;
}
