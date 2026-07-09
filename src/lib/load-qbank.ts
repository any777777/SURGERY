import "server-only";

import fs from "node:fs";
import path from "node:path";

import { demoQbank } from "@/data/demo-qbank";
import type { StudyQbank } from "@/lib/types";

export function loadQbank(): StudyQbank {
  const privateDataPath = path.join(process.cwd(), "data", "private", "surgery-qbank.json");

  if (!fs.existsSync(privateDataPath)) {
    return demoQbank;
  }

  const raw = fs.readFileSync(privateDataPath, "utf8");
  return JSON.parse(raw) as StudyQbank;
}
