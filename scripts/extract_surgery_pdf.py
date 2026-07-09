from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pdfplumber


DEFAULT_PDF = Path(r"C:\Users\user\Downloads\Telegram Desktop\surgery mcqs .pdf")
ROOT = Path(__file__).resolve().parents[1]
DATA_OUT = ROOT / "data" / "private" / "surgery-qbank.json"
REPORT_OUT = ROOT / "reports" / "surgery-extraction-report.json"
ASSET_DIR = ROOT / "public" / "study-assets" / "private"


@dataclass(frozen=True)
class ChapterSpec:
    number: int
    title: str
    authors: str
    question_pdf_start: int
    answer_pdf_start: int
    expected_questions: int


CHAPTERS: list[ChapterSpec] = [
    ChapterSpec(1, "Surgical Critical Care / Pre- and Postoperative Care", "Nanakram Agarwal and Akella Chendrasekhar", 19, 35, 108),
    ChapterSpec(2, "Skin, Soft Tissue, and Breast", "Aloyious Smith and Andrew Ashikari", 49, 59, 50),
    ChapterSpec(3, "Endocrine, Head, and Neck", "Alan S. Berkower and Prakashchandra M. Rao", 65, 84, 92),
    ChapterSpec(4, "Cardiac and Thoracic", "Marshall O. Kramer and E. A. Bonfils-Roberts", 97, 107, 30),
    ChapterSpec(5, "Stomach, Duodenum, and Esophagus", "Soula Privolous and Max Goldberg", 115, 132, 97),
    ChapterSpec(6, "Small and Large Intestines and Appendix", "Evelyn Irizarry and Nicholas A. Balsano", 145, 162, 90),
    ChapterSpec(7, "Pancreas, Biliary Tract, Liver, and Spleen", "Valerie L. Katz and Akella Chendrasekhar", 175, 192, 99),
    ChapterSpec(8, "Hernia", "Max Goldberg and Nanakram Agarwal", 207, 211, 21),
    ChapterSpec(9, "Male and Female Genitourinary Systems", "Sean Fullerton and Albert Samadi", 215, 227, 59),
    ChapterSpec(10, "Vascular", "Nilesh N. Balar and Mayank V. Patel", 235, 245, 59),
    ChapterSpec(11, "Neurosurgery", "Kamran Tabaddor", 255, 268, 58),
    ChapterSpec(12, "Trauma", "C. Gene Cayten and Rao R. Ivatury", 279, 299, 87),
    ChapterSpec(13, "Pediatric Surgery", "Tyr Ohling Wilbanks and Meno Leuders", 311, 318, 34),
    ChapterSpec(14, "Practice Test", "James E. Barone and C. Gene Cayten", 325, 341, 100),
]


def normalize_symbols(text: str) -> str:
    text = text.replace("\ufb01", "fi").replace("\ufb02", "fl")
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u00a0", " ")
    text = re.sub(r"(\d)\ufffdF\b", r"\1 degrees F", text)
    text = re.sub(r"(\d)\ufffd(\d)", r"\1-\2", text)
    text = re.sub(r"([A-Za-z])\ufffd([A-Za-z])", r"\1'\2", text)
    text = text.replace("\ufffd", "'")
    return text


def strip_instruction_fragments(text: str) -> str:
    patterns = [
        r"\b(?:Each set|set|of matching questions) in this section consists of a list of lettered options followed by several numbered items\..*$",
        r"\bof matching questions in this section consists of a list of lettered options followed by several numbered items\..*$",
        r"\bFor each numbered item, select the appropriate lettered option(?:\(s\))?.*$",
        r"\bEach lettered option may be selected once, more than once, or not at all\..*$",
        r"\bFor each patient below, select the most likely diagnosis\..*$",
        r"\bSelect the most likely diagnosis for the patients below\..*$",
        r"\bthe numbered item in this section is followed by five answers\. Select the ONE lettered answer that is BEST in each case\..*$",
    ]
    for pattern in patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    return text


def clean_group_context(text: str) -> str:
    text = re.sub(r"^Questions?\s+\d+\s*(?:[-]|through|to|and)\s*\d+\b", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^Question\s+\d+\b", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^The responses for questions\s+\d+\s*[-]\s*\d+\s+are the same\.", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^The response options for items\s+\d+\s*[-]\s*\d+\s+are the same\.", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"^you will be required to select one answer for each item in the set\.", "", text, flags=re.IGNORECASE).strip()
    return strip_instruction_fragments(text).strip()


def compact_text(parts: list[str] | str) -> str:
    if isinstance(parts, str):
        text = parts
    else:
        text = " ".join(part.strip() for part in parts if part and part.strip())
    text = normalize_symbols(text)
    text = re.sub(r"([A-Za-z])- ([a-z])", r"\1\2", text)
    text = re.sub(r"\bPCO\s*,", "PCO2,", text)
    text = re.sub(r"\bPO\s*,", "PO2,", text)
    text = re.sub(r"\bHCO\s*,", "HCO3,", text)
    text = re.sub(r"\bSaO\s*,", "SaO2,", text)
    text = re.sub(r"\bHCO\s+3\b", "HCO3", text)
    text = re.sub(r"\bSaO\s+2\b", "SaO2", text)
    text = re.sub(r"\bPCO\s+2\b", "PCO2", text)
    text = re.sub(r"\bPO\s+2\b", "PO2", text)
    text = re.sub(r"\bD\s*W\s+5\b", "D5W", text)
    text = re.sub(r"\bD\s*W\s+10\b", "D10W", text)
    text = re.sub(r"\s+", " ", text)
    text = strip_instruction_fragments(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def is_noise_line(raw: str) -> bool:
    line = compact_text(raw)
    if not line:
        return True
    if re.fullmatch(r"(?:\d\s*){1,4}", line):
        return True
    if re.match(r"^(Questions|Answers):\s*\d", line, re.IGNORECASE):
        return True
    if re.match(r"^\d+\s+\d+:\s+", line):
        return True
    if re.match(r"^\d+\s+14:\s+Practice Test", line):
        return True
    if re.fullmatch(r"\d+", line):
        return True
    if re.match(r"^CHAPTER\s+\d+", line, re.IGNORECASE):
        return True
    if line in {"Questions", "Answers and Explanations"}:
        return True
    if "AAnnsswweerrss" in raw:
        return True
    if line.startswith("DIRECTIONS"):
        return True
    if line.startswith("Copyright "):
        return True
    if "Click here for terms of use" in line:
        return True
    if line == "This page intentionally left blank":
        return True
    return False


def page_column_lines(page: pdfplumber.page.Page, page_number: int) -> list[tuple[int, str]]:
    x0, top, x1, bottom = page.bbox
    mid = (x0 + x1) / 2
    lines: list[tuple[int, str]] = []
    for bbox in ((x0, top, mid, bottom), (mid, top, x1, bottom)):
        text = page.crop(bbox).extract_text(x_tolerance=1, y_tolerance=3) or ""
        for raw in text.splitlines():
            if not is_noise_line(raw):
                lines.append((page_number, compact_text(raw)))
    return lines


def chapter_page_end(chapter_index: int, total_pages: int) -> int:
    if chapter_index + 1 < len(CHAPTERS):
        return CHAPTERS[chapter_index + 1].question_pdf_start - 1
    return total_pages


def collect_lines(pdf: pdfplumber.PDF, start: int, end: int) -> list[tuple[int, str]]:
    lines: list[tuple[int, str]] = []
    for page_number in range(start, end + 1):
        lines.extend(page_column_lines(pdf.pages[page_number - 1], page_number))
    return lines


def split_options_from_context(text: str) -> tuple[str, list[dict[str, str]]]:
    matches = list(re.finditer(r"\(([A-Ja-j])\)\s*", text))
    if len(matches) < 5:
        return text, []
    options: list[dict[str, str]] = []
    context = text[: matches[0].start()].strip()
    for idx, match in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        value = text[match.end() : end].strip()
        options.append({"key": match.group(1).upper(), "text": compact_text(value)})
    return context, options


def parse_group_heading(line: str) -> tuple[int, int] | None:
    normalized = line.replace(" through ", "-").replace(" to ", "-").replace(" and ", "-")
    match = re.match(r"^Questions?\s+(\d+)\s*[-]\s*(\d+)\b", normalized, re.IGNORECASE)
    if match:
        return int(match.group(1)), int(match.group(2))
    match = re.match(r"^The responses for questions\s+(\d+)\s*[-]\s*(\d+)\s+are\b", normalized, re.IGNORECASE)
    if match:
        return int(match.group(1)), int(match.group(2))
    match = re.match(r"^The response options for items\s+(\d+)\s*[-]\s*(\d+)\s+are\b", normalized, re.IGNORECASE)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None


def parse_questions(lines: list[tuple[int, str]], chapter: ChapterSpec) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    current_option: str | None = None
    active_group: dict[str, Any] | None = None
    pending_heading: dict[str, Any] | None = None

    def finish_current() -> None:
        nonlocal current, current_option
        if not current:
            return
        options = [
            {"key": item["key"], "text": compact_text(item["parts"])}
            for item in current.pop("option_parts")
            if compact_text(item["parts"])
        ]
        group_context = compact_text(current.pop("group_parts", []))
        group_text, shared_options = split_options_from_context(group_context)
        group_text = clean_group_context(group_text)
        if not options and shared_options:
            options = shared_options
        current["groupContext"] = group_text
        current["stem"] = compact_text(current.pop("stem_parts"))
        current["options"] = options
        if 1 <= current["number"] <= chapter.expected_questions:
            questions.append(current)
        current = None
        current_option = None

    def begin_question(number: int, page_number: int, stem: str) -> None:
        nonlocal current, current_option, active_group
        finish_current()
        group_parts: list[str] = []
        if active_group and active_group["start"] <= number <= active_group["end"]:
            group_parts = list(active_group["parts"])
        elif active_group and number > active_group["end"]:
            active_group = None
        current = {
            "id": f"c{chapter.number}-q{number}",
            "chapterNumber": chapter.number,
            "chapterTitle": chapter.title,
            "number": number,
            "page": page_number,
            "stem_parts": [stem] if stem else [],
            "group_parts": group_parts,
            "option_parts": [],
            "answer": None,
            "answers": [],
            "answerText": "",
            "explanation": "",
            "answerPage": None,
            "figures": [],
        }
        current_option = None

    for page_number, line in lines:
        if pending_heading:
            option_after_heading = re.match(r"^\(([A-Ja-j])\)\s*(.*)", line)
            if option_after_heading:
                finish_current()
                active_group = {
                    "start": pending_heading["number"],
                    "end": pending_heading["number"],
                    "parts": [pending_heading["line"], line],
                }
                pending_heading = None
                continue
            begin_question(pending_heading["number"], pending_heading["page"], line)
            pending_heading = None
            continue

        group_range = parse_group_heading(line)
        if group_range:
            finish_current()
            active_group = {"start": group_range[0], "end": group_range[1], "parts": [line]}
            continue

        question_match = re.match(r"^(\d{1,3})\.\s+(.*)", line)
        single_question_match = re.match(r"^Question\s+(\d{1,3})\b\.?\s*(.*)", line, re.IGNORECASE)
        if not question_match and single_question_match:
            if not single_question_match.group(2).strip():
                pending_heading = {
                    "number": int(single_question_match.group(1)),
                    "page": page_number,
                    "line": line,
                }
                continue
            question_match = single_question_match
        if question_match:
            number = int(question_match.group(1))
            if current and number > current["number"] + 1:
                if current_option and current["option_parts"]:
                    current["option_parts"][-1]["parts"].append(line)
                else:
                    current["stem_parts"].append(line)
                continue
            begin_question(number, page_number, question_match.group(2))
            continue

        if active_group and current is None:
            active_group["parts"].append(line)
            continue

        option_match = re.match(r"^\(([A-Ja-j])\)\s*(.*)", line)
        if current and option_match:
            current["option_parts"].append({"key": option_match.group(1).upper(), "parts": [option_match.group(2)]})
            current_option = option_match.group(1).upper()
            continue

        if current:
            if current_option and current["option_parts"]:
                current["option_parts"][-1]["parts"].append(line)
            else:
                current["stem_parts"].append(line)

    finish_current()
    deduped: dict[int, dict[str, Any]] = {}
    for question in questions:
        deduped[question["number"]] = question
    return [deduped[number] for number in sorted(deduped)]


def parse_answers(lines: list[tuple[int, str]], chapter: ChapterSpec) -> dict[int, dict[str, Any]]:
    answers: dict[int, dict[str, Any]] = {}
    current_number: int | None = None
    current_key = ""
    current_page: int | None = None
    explanation_parts: list[str] = []

    def finish_answer() -> None:
        nonlocal current_number, current_key, current_page, explanation_parts
        if current_number is None:
            return
        if 1 <= current_number <= chapter.expected_questions:
            answers[current_number] = {
                "answer": current_key,
                "answers": re.findall(r"[A-J]", current_key),
                "answerPage": current_page,
                "explanation": compact_text(explanation_parts),
            }
        current_number = None
        current_key = ""
        current_page = None
        explanation_parts = []

    for page_number, line in lines:
        match = re.match(r"^(\d{1,3})\.\s*\(([A-J](?:\s*,\s*[A-J])*)\)\s*(.*)", line)
        if match:
            finish_answer()
            current_number = int(match.group(1))
            current_key = ", ".join(re.findall(r"[A-J]", match.group(2)))
            current_page = page_number
            explanation_parts = [match.group(3)]
            continue
        if current_number is not None:
            explanation_parts.append(line)

    finish_answer()
    return answers


def extract_figures(pdf: pdfplumber.PDF) -> list[dict[str, Any]]:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    figures: list[dict[str, Any]] = []
    for stale in ASSET_DIR.glob("*.png"):
        stale.unlink()
    for page_number, page in enumerate(pdf.pages, start=1):
        if page_number < CHAPTERS[0].question_pdf_start:
            continue
        image_index = 0
        for image in page.images:
            width = float(image.get("width", 0) or (image["x1"] - image["x0"]))
            height = float(image.get("height", 0) or (image["bottom"] - image["top"]))
            if width < 70 or height < 45:
                continue
            image_index += 1
            filename = f"page-{page_number:03d}-figure-{image_index:02d}.png"
            target = ASSET_DIR / filename
            try:
                bbox = (
                    max(page.bbox[0], image["x0"]),
                    max(page.bbox[1], image["top"]),
                    min(page.bbox[2], image["x1"]),
                    min(page.bbox[3], image["bottom"]),
                )
                page.crop(bbox).to_image(resolution=180).save(target)
            except Exception as exc:  # noqa: BLE001
                figures.append(
                    {
                        "id": f"p{page_number}-figure-{image_index}",
                        "page": page_number,
                        "path": "",
                        "error": str(exc),
                    }
                )
                continue
            figures.append(
                {
                    "id": f"p{page_number}-figure-{image_index}",
                    "page": page_number,
                    "path": f"/study-assets/private/{filename}",
                    "width": round(width, 2),
                    "height": round(height, 2),
                }
            )
    return figures


def attach_answers_and_figures(
    questions: list[dict[str, Any]],
    answers: dict[int, dict[str, Any]],
    figures: list[dict[str, Any]],
) -> None:
    figures_by_page: dict[int, list[dict[str, Any]]] = {}
    for figure in figures:
        if figure.get("path"):
            figures_by_page.setdefault(int(figure["page"]), []).append(figure)

    for question in questions:
        answer = answers.get(question["number"])
        if answer:
            question["answer"] = answer["answer"]
            question["answers"] = answer["answers"]
            question["answerPage"] = answer["answerPage"]
            question["explanation"] = answer["explanation"]
            answer_texts: list[str] = []
            for option in question["options"]:
                if option["key"] in question["answers"]:
                    answer_texts.append(f"{option['key']}. {option['text']}")
            question["answerText"] = "; ".join(answer_texts)

        searchable = f"{question.get('groupContext', '')} {question['stem']} {question.get('explanation', '')}".lower()
        if any(token in searchable for token in ("fig.", "figure", "ct scan", "x-ray", "radiograph", "image")):
            seen: set[str] = set()
            for page in (question.get("page"), question.get("answerPage")):
                if not page:
                    continue
                for figure in figures_by_page.get(int(page), []):
                    if figure["id"] not in seen:
                        question["figures"].append(figure)
                        seen.add(figure["id"])


def build_qbank(pdf_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    with pdfplumber.open(str(pdf_path)) as pdf:
        figures = extract_figures(pdf)
        chapters: list[dict[str, Any]] = []
        report_chapters: list[dict[str, Any]] = []

        for index, spec in enumerate(CHAPTERS):
            question_lines = collect_lines(pdf, spec.question_pdf_start, spec.answer_pdf_start - 1)
            answer_end = chapter_page_end(index, len(pdf.pages))
            answer_lines = collect_lines(pdf, spec.answer_pdf_start, answer_end)
            questions = parse_questions(question_lines, spec)
            answers = parse_answers(answer_lines, spec)
            attach_answers_and_figures(questions, answers, figures)

            present_numbers = {question["number"] for question in questions}
            answer_numbers = set(answers)
            missing_questions = [n for n in range(1, spec.expected_questions + 1) if n not in present_numbers]
            missing_answers = [n for n in range(1, spec.expected_questions + 1) if n not in answer_numbers]
            no_options = [question["number"] for question in questions if len(question["options"]) < 2]
            no_explanation = [question["number"] for question in questions if not question.get("explanation")]
            replacement_marks = sum(
                (question.get("stem", "") + question.get("groupContext", "") + question.get("explanation", "")).count("\ufffd")
                for question in questions
            )

            chapters.append(
                {
                    "id": f"chapter-{spec.number}",
                    "number": spec.number,
                    "title": spec.title,
                    "authors": spec.authors,
                    "expectedQuestions": spec.expected_questions,
                    "questions": questions,
                }
            )
            report_chapters.append(
                {
                    "chapter": spec.number,
                    "title": spec.title,
                    "expectedQuestions": spec.expected_questions,
                    "extractedQuestions": len(questions),
                    "extractedAnswers": len(answers),
                    "missingQuestions": missing_questions,
                    "missingAnswers": missing_answers,
                    "questionsWithFewerThanTwoOptions": no_options,
                    "questionsWithoutExplanation": no_explanation,
                    "replacementMarksRemaining": replacement_marks,
                }
            )

        total_expected = sum(chapter.expected_questions for chapter in CHAPTERS)
        total_questions = sum(len(chapter["questions"]) for chapter in chapters)
        total_answers = sum(
            1
            for chapter in chapters
            for question in chapter["questions"]
            if question.get("answer") and question.get("explanation")
        )
        qbank = {
            "meta": {
                "title": "Surgery Qbank",
                "subtitle": "Focused practice for medical students",
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "pageCount": len(pdf.pages),
                "chapterCount": len(chapters),
                "questionCount": total_questions,
                "completeQuestionTarget": total_expected,
            },
            "figures": figures,
            "chapters": chapters,
        }
        report = {
            "generatedAt": qbank["meta"]["generatedAt"],
            "pdf": str(pdf_path),
            "pageCount": len(pdf.pages),
            "expectedQuestions": total_expected,
            "extractedQuestions": total_questions,
            "questionsWithAnswers": total_answers,
            "figures": len([figure for figure in figures if figure.get("path")]),
            "chapters": report_chapters,
        }
    return qbank, report


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract the private surgery study qbank from the local PDF.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--out", type=Path, default=DATA_OUT)
    parser.add_argument("--report", type=Path, default=REPORT_OUT)
    args = parser.parse_args()

    if not args.pdf.exists():
        raise FileNotFoundError(f"PDF not found: {args.pdf}")

    qbank, report = build_qbank(args.pdf)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(qbank, ensure_ascii=False, indent=2), encoding="utf-8")
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("expectedQuestions", "extractedQuestions", "questionsWithAnswers", "figures")}, indent=2))


if __name__ == "__main__":
    main()
