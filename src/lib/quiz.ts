import { prisma } from "./prisma";
import type { Session } from "./auth";
import { sessionIdentity, visiblePolicyIdsFor } from "./consumption";

const QUESTIONS_PER_DAY = 5;

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Returns today's quiz set for the session, generating it on first request of the day. */
export async function getOrCreateTodaysQuiz(session: Session) {
  const { userId, vendorUserId } = sessionIdentity(session);
  const today = startOfDay();

  const existing = await prisma.quizAssignment.findMany({
    where: { userId, vendorUserId, date: today },
    include: { question: { include: { options: true, policy: true } }, answeredOption: true },
    orderBy: { order: "asc" },
  });
  if (existing.length > 0) return existing.map(toClientAssignment);

  const policyIds = await visiblePolicyIdsFor(session);
  const pool = await prisma.quizQuestion.findMany({
    where: { policyId: { in: policyIds }, active: true },
    include: { options: true, policy: true },
  });
  if (pool.length === 0) return [];

  const picked = shuffle(pool).slice(0, Math.min(QUESTIONS_PER_DAY, pool.length));
  const assignments = [];
  for (let i = 0; i < picked.length; i++) {
    const q = picked[i];
    const shuffledOptionIds = shuffle(q.options.map((o) => o.id));
    const assignment = await prisma.quizAssignment.create({
      data: {
        date: today,
        questionId: q.id,
        userId,
        vendorUserId,
        shuffledOptionIds: JSON.stringify(shuffledOptionIds),
        order: i + 1,
      },
      include: { question: { include: { options: true, policy: true } }, answeredOption: true },
    });
    assignments.push(assignment);
  }
  return assignments.map(toClientAssignment);
}

function toClientAssignment(a: {
  id: string;
  order: number;
  question: { id: string; questionText: string; sectionAnchor: string | null; explanation: string | null; policy: { slug: string; title: string }; options: { id: string; text: string }[] };
  shuffledOptionIds: string;
  answeredOptionId: string | null;
  isCorrect: boolean | null;
}) {
  const order: string[] = JSON.parse(a.shuffledOptionIds);
  const optionsById = new Map(a.question.options.map((o) => [o.id, o]));
  return {
    assignmentId: a.id,
    order: a.order,
    questionText: a.question.questionText,
    policySlug: a.question.policy.slug,
    policyTitle: a.question.policy.title,
    sectionAnchor: a.question.sectionAnchor,
    options: order.map((id) => ({ id, text: optionsById.get(id)?.text ?? "" })),
    answered: a.answeredOptionId !== null,
    answeredOptionId: a.answeredOptionId,
    isCorrect: a.isCorrect,
    explanation: a.answeredOptionId ? a.question.explanation : null,
  };
}

export async function submitQuizAnswer(session: Session, assignmentId: string, optionId: string) {
  const { userId, vendorUserId } = sessionIdentity(session);
  const assignment = await prisma.quizAssignment.findFirstOrThrow({
    where: { id: assignmentId, userId, vendorUserId },
    include: { question: { include: { options: true, policy: true } } },
  });
  if (assignment.answeredOptionId) {
    throw new Error("Question already answered");
  }
  const option = assignment.question.options.find((o) => o.id === optionId);
  if (!option) throw new Error("Invalid option");

  const updated = await prisma.quizAssignment.update({
    where: { id: assignmentId },
    data: { answeredOptionId: optionId, isCorrect: option.isCorrect, answeredAt: new Date() },
    include: { question: { include: { options: true, policy: true } }, answeredOption: true },
  });
  return toClientAssignment(updated);
}
