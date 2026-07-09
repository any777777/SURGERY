import { StudyApp } from "@/components/study-app";
import { loadQbank } from "@/lib/load-qbank";

export default function Home() {
  const qbank = loadQbank();

  return <StudyApp qbank={qbank} />;
}
