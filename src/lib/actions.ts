import { api, type Lesson, type Quiz } from "./api";

export async function startLesson(opts: {
  learnerId: string;
  subject: string;
  topic?: string;
  duration?: number;
  extraNote?: string;
  level?: string;
  bookId?: string;
  topicId?: string;
}): Promise<Lesson> {
  const data = await api<{ lesson: Lesson }>("/lessons/generate", {
    method: "POST",
    json: { ...opts, learnerId: opts.learnerId },
  });
  return data.lesson;
}

export async function startQuiz(opts: {
  learnerId: string;
  subject: string;
  topic?: string;
  count?: number;
  level?: string;
  bookId?: string;
  topicId?: string;
}): Promise<Quiz> {
  const data = await api<{ quiz: Quiz }>("/quizzes/generate", {
    method: "POST",
    json: { ...opts, learnerId: opts.learnerId },
  });
  return data.quiz;
}
