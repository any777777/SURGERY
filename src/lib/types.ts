export type StudyFigure = {
  id: string;
  page: number;
  path: string;
  width?: number;
  height?: number;
};

export type AnswerOption = {
  key: string;
  text: string;
};

export type StudyQuestion = {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  number: number;
  page: number;
  groupContext: string;
  stem: string;
  options: AnswerOption[];
  answer: string | null;
  answers: string[];
  answerText: string;
  explanation: string;
  answerPage: number | null;
  figures: StudyFigure[];
};

export type StudyChapter = {
  id: string;
  number: number;
  title: string;
  authors: string;
  expectedQuestions: number;
  questions: StudyQuestion[];
};

export type StudyQbank = {
  meta: {
    title: string;
    subtitle: string;
    generatedAt?: string;
    pageCount?: number;
    chapterCount: number;
    questionCount: number;
    completeQuestionTarget?: number;
  };
  figures: StudyFigure[];
  chapters: StudyChapter[];
};
