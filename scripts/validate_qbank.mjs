import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "data", "private", "surgery-qbank.json");
const reportPath = path.join(root, "reports", "surgery-extraction-report.json");
const expectedQuestions = 984;
const expectedChapters = 14;
const expectedFigures = 81;

const instructionPatterns = [
  /For each numbered item/i,
  /Each lettered option may be selected/i,
  /matching questions in this section/i,
  /DIRECTIONS/i,
  /^Questions?\s+\d+\s*(?:-|through|to|and)\s*\d+\b/i,
  /Click here for terms of use/i,
];

function fail(message) {
  failures.push(message);
}

function textFields(question) {
  return [question.groupContext, question.stem, question.answerText, question.explanation].filter(Boolean);
}

if (!fs.existsSync(dataPath)) {
  console.log("Private qbank is not present; full material validation skipped.");
  process.exit(0);
}

const qbank = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : null;
const failures = [];
const seenQuestionIds = new Set();
const allQuestions = qbank.chapters.flatMap((chapter) => chapter.questions);

if (qbank.chapters.length !== expectedChapters) {
  fail(`Expected ${expectedChapters} chapters, found ${qbank.chapters.length}.`);
}

if (allQuestions.length !== expectedQuestions) {
  fail(`Expected ${expectedQuestions} questions, found ${allQuestions.length}.`);
}

if (qbank.meta.questionCount !== allQuestions.length) {
  fail(`Meta questionCount ${qbank.meta.questionCount} does not match ${allQuestions.length}.`);
}

if (qbank.meta.completeQuestionTarget !== expectedQuestions) {
  fail(`Meta completeQuestionTarget ${qbank.meta.completeQuestionTarget} does not match ${expectedQuestions}.`);
}

for (const chapter of qbank.chapters) {
  if (chapter.questions.length !== chapter.expectedQuestions) {
    fail(`Chapter ${chapter.number} expected ${chapter.expectedQuestions} questions, found ${chapter.questions.length}.`);
  }

  for (let number = 1; number <= chapter.expectedQuestions; number += 1) {
    if (!chapter.questions.some((question) => question.number === number)) {
      fail(`Chapter ${chapter.number} is missing question ${number}.`);
    }
  }

  for (const question of chapter.questions) {
    if (seenQuestionIds.has(question.id)) {
      fail(`Duplicate question id ${question.id}.`);
    }
    seenQuestionIds.add(question.id);

    if (!question.stem?.trim()) {
      fail(`${question.id} has an empty stem.`);
    }

    if (question.options.length < 2) {
      fail(`${question.id} has fewer than two answer choices.`);
    }

    if (!question.answers.length) {
      fail(`${question.id} has no extracted answer key.`);
    }

    if (!question.explanation?.trim()) {
      fail(`${question.id} has no explanation.`);
    }

    const optionKeys = new Set(question.options.map((option) => option.key));
    for (const key of question.answers) {
      if (!optionKeys.has(key)) {
        fail(`${question.id} answer ${key} is not present in its options.`);
      }
    }

    for (const option of question.options) {
      if (!option.text?.trim()) {
        fail(`${question.id} option ${option.key} is empty.`);
      }
    }

    for (const value of textFields(question)) {
      if (value.includes("\uFFFD")) {
        fail(`${question.id} contains a replacement character.`);
      }
      for (const pattern of instructionPatterns) {
        if (pattern.test(value)) {
          fail(`${question.id} contains leftover instruction text: ${pattern}.`);
        }
      }
    }

    for (const figure of question.figures) {
      const publicPath = figure.path.replace(/^\//, "");
      if (!fs.existsSync(path.join(root, "public", publicPath))) {
        fail(`${question.id} references a missing figure: ${figure.path}.`);
      }
    }
  }
}

const figuresWithPaths = qbank.figures.filter((figure) => figure.path);
if (figuresWithPaths.length !== expectedFigures) {
  fail(`Expected ${expectedFigures} extracted figures, found ${figuresWithPaths.length}.`);
}

for (const figure of figuresWithPaths) {
  const publicPath = figure.path.replace(/^\//, "");
  if (!fs.existsSync(path.join(root, "public", publicPath))) {
    fail(`Missing extracted figure: ${figure.path}.`);
  }
}

if (report) {
  if (report.expectedQuestions !== expectedQuestions || report.extractedQuestions !== expectedQuestions) {
    fail("Extraction report question totals do not match the expected full material count.");
  }

  if (report.questionsWithAnswers !== expectedQuestions) {
    fail("Extraction report answer total does not match the expected full material count.");
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      chapters: qbank.chapters.length,
      questions: allQuestions.length,
      answered: allQuestions.filter((question) => question.answers.length && question.explanation).length,
      figures: figuresWithPaths.length,
    },
    null,
    2,
  ),
);
